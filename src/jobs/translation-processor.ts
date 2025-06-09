import { db } from "@/db";
import { jobs, translatedFiles, logs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { storageService } from "@/services/storage";
import { translator } from "@/services/translation";
import type * as deepl from "deepl-node";
import { mkdir, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function processJob() {
  const [job] = await db.transaction(async (tx) => {
    const [jobToProcess] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.status, "batched"))
      .limit(1);

    if (!jobToProcess) return [];

    await tx
      .update(jobs)
      .set({ status: "processing" })
      .where(eq(jobs.id, jobToProcess.id));
    return [jobToProcess];
  });

  if (!job) {
    return; // No job to process
  }

  console.log(`Processing job ID: ${job.id}`);
  const tempDir = path.join(process.cwd(), `temp-job-${job.id}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const srtBuffer = await storageService.downloadFile(job.sourceSrtPath);
    const localSourceSrt = path.join(tempDir, "source.srt");
    await writeFile(localSourceSrt, srtBuffer);

    const translatePromises = job.targetLanguages.map(async (lang) => {
      const localVtt = path.join(tempDir, `${lang}.vtt`);

      // --- THE FIX IS HERE ---
      // The deepl-node library expects file paths (strings), not BunFile objects.
      // We pass the string variables directly.
      await translator.translateDocument(
        localSourceSrt,
        localVtt,
        null, // sourceLang (null for auto-detect)
        lang as deepl.TargetLanguageCode,
      );

      const remoteVttPath = `processed/${job.id}/${lang}.vtt`;
      // We still use Bun.file() here because it's great for reading a file
      // to upload its contents.
      const translatedFileBuffer = await Bun.file(localVtt).arrayBuffer();
      await storageService.uploadFile(remoteVttPath, translatedFileBuffer);
      await db
        .insert(translatedFiles)
        .values({ jobId: job.id, language: lang, path: remoteVttPath });
    });

    await Promise.all(translatePromises);

    const usage = await translator.getUsage();
    if (usage.character) {
      await db
        .insert(logs)
        .values({ jobId: job.id, creditsUsed: usage.character.count });
    }

    await db
      .update(jobs)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(jobs.id, job.id));
    console.log(`Job ID: ${job.id} completed successfully.`);
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    await db.update(jobs).set({ status: "failed" }).where(eq(jobs.id, job.id));
    await db
      .insert(logs)
      .values({ jobId: job.id, message: (error as Error).message });
  } finally {
    await rmdir(tempDir, { recursive: true }).catch(console.error);
  }
}

async function main() {
  console.log("Translation processor started. Checking for jobs...");
  while (true) {
    await processJob();
    await new Promise((resolve) => setTimeout(resolve, 10000)); // 10-second interval
  }
}

main().catch(console.error);
