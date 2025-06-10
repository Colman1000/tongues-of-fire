import { db } from "@/db";
import { jobs, translatedFiles, logs, systemCredits } from "@/db/schema";
import { and, eq, sql, sum } from "drizzle-orm"; // 1. Import 'and'
import { storageService } from "@/services/storage";
import { translator } from "@/services/translation";
import type * as deepl from "deepl-node";
import { mkdir, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateSubtitleDuration, calculateCredits } from "@/utils/subtitle";

async function processJob() {
  // --- PRE-FLIGHT CREDIT CHECK ---
  const [jobToProcess] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "batched"))
    .limit(1);

  if (!jobToProcess) {
    return; // No job to process
  }

  // Get the system's current credit balance
  const [creditsRecord] = await db.select().from(systemCredits).limit(1);
  const availableUnits = creditsRecord?.availableUnits ?? 0;

  // Find the original 'en' file to estimate the cost
  // 2. --- THE FIX IS HERE ---
  // Combine multiple conditions using and() inside a single .where()
  const [originalFile] = await db
    .select()
    .from(translatedFiles)
    .where(
      and(
        eq(translatedFiles.jobId, jobToProcess.id),
        eq(translatedFiles.language, "en"),
      ),
    );

  if (!originalFile) {
    console.error(
      `Job ${jobToProcess.id} is batched but has no 'en' file. Marking as failed.`,
    );
    await db
      .update(jobs)
      .set({ status: "failed" })
      .where(eq(jobs.id, jobToProcess.id));
    return;
  }

  // Estimate the total cost for all target languages
  const estimatedCost =
    originalFile.creditsUsed * jobToProcess.targetLanguages.length;

  if (availableUnits < estimatedCost) {
    console.log(
      `Insufficient credits for job ${jobToProcess.id}. Required: ~${estimatedCost}, Available: ${availableUnits}. Skipping.`,
    );
    return; // Not enough credits, leave the job as 'batched' and try again later
  }

  // --- PROCEED WITH PROCESSING ---
  // Now that we've passed the credit check, we can mark the job as 'processing'
  await db
    .update(jobs)
    .set({ status: "processing" })
    .where(eq(jobs.id, jobToProcess.id));

  console.log(`Processing job ID: ${jobToProcess.id}`);
  const tempDir = path.join(process.cwd(), `temp-job-${jobToProcess.id}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const srtBuffer = await storageService.downloadFile(
      jobToProcess.sourceSrtPath,
    );
    const localSourceSrt = path.join(tempDir, "source.srt");
    await writeFile(localSourceSrt, srtBuffer);

    const translatePromises = jobToProcess.targetLanguages.map(async (lang) => {
      const localVtt = path.join(tempDir, `${lang}.vtt`);

      await translator.translateDocument(
        localSourceSrt,
        localVtt,
        null, // sourceLang (null for auto-detect)
        lang as deepl.TargetLanguageCode,
      );

      const translatedContent = await Bun.file(localVtt).text();
      const duration = calculateSubtitleDuration(translatedContent);
      const credits = calculateCredits(duration);

      const remoteVttPath = `processed/${jobToProcess.id}/${lang}.vtt`;
      const translatedFileBuffer = await Bun.file(localVtt).arrayBuffer();
      await storageService.uploadFile(remoteVttPath, translatedFileBuffer);
      await db.insert(translatedFiles).values({
        jobId: jobToProcess.id,
        language: lang,
        path: remoteVttPath,
        subtitleDurationSeconds: duration,
        creditsUsed: credits,
      });
    });

    await Promise.all(translatePromises);

    // --- CREDIT DEDUCTION ---
    // Calculate the *actual* total credits used for this job
    const result = await db
      .select({
        totalCredits: sum(translatedFiles.creditsUsed),
      })
      .from(translatedFiles)
      .where(eq(translatedFiles.jobId, jobToProcess.id));

    const totalCreditsUsed = Number(result[0].totalCredits) || 0;

    // Atomically deduct the credits from the system balance
    await db
      .update(systemCredits)
      .set({
        availableUnits: sql`${systemCredits.availableUnits} - ${totalCreditsUsed}`,
      })
      .where(eq(systemCredits.id, 1)); // Assuming the credits record has ID 1

    // Finally, mark the job as completed
    await db
      .update(jobs)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(jobs.id, jobToProcess.id));

    console.log(
      `Job ID: ${jobToProcess.id} completed successfully. Deducted ${totalCreditsUsed} credits.`,
    );
  } catch (error) {
    console.error(`Error processing job ${jobToProcess.id}:`, error);
    await db
      .update(jobs)
      .set({ status: "failed" })
      .where(eq(jobs.id, jobToProcess.id));
    await db
      .insert(logs)
      .values({ jobId: jobToProcess.id, message: (error as Error).message });
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
