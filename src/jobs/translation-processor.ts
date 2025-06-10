import { db } from "@/db";
import { jobs, translatedFiles, logs, systemCredits } from "@/db/schema";
import { and, eq, sql, sum } from "drizzle-orm";
import { storageService } from "@/services/storage";
import { translator } from "@/services/translation";
import type * as deepl from "deepl-node";
import { mkdir, rmdir, writeFile } from "fs/promises";
import path from "path";
import { calculateSubtitleDuration, calculateCredits } from "@/utils/subtitle";
import { logAuditEvent } from "@/services/audit";
import { srtToVtt } from "@/services/file-converter"; // 1. Import the converter

async function processJob() {
  // 1. Find the next available job
  const [jobToProcess] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "batched"))
    .limit(1);

  if (!jobToProcess) {
    return; // No job to process
  }

  // --- INTELLIGENT PRE-FLIGHT CHECKS ---
  // ... (This entire section remains the same and is correct) ...
  const existingFiles = await db
    .select({ language: translatedFiles.language })
    .from(translatedFiles)
    .where(eq(translatedFiles.jobId, jobToProcess.id));
  const existingLangs = new Set(existingFiles.map((f) => f.language));
  const languagesToTranslate = jobToProcess.targetLanguages.filter(
    (lang) => !existingLangs.has(lang),
  );
  if (languagesToTranslate.length === 0) {
    console.log(
      `Job ${jobToProcess.id}: No new languages to translate. Marking as complete.`,
    );
    await db
      .update(jobs)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(jobs.id, jobToProcess.id));
    return;
  }
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
  const estimatedCostForNewWork =
    originalFile.creditsUsed * languagesToTranslate.length;
  const [creditsRecord] = await db.select().from(systemCredits).limit(1);
  const availableUnits = creditsRecord?.availableUnits ?? 0;
  if (availableUnits < estimatedCostForNewWork) {
    console.log(
      `Insufficient credits for job ${jobToProcess.id}. Required for new languages: ~${estimatedCostForNewWork}, Available: ${availableUnits}. Skipping.`,
    );
    return;
  }

  // --- PROCEED WITH PROCESSING (ALL CHECKS PASSED) ---
  await db
    .update(jobs)
    .set({ status: "processing" })
    .where(eq(jobs.id, jobToProcess.id));

  console.log(
    `Processing job ID: ${jobToProcess.id}. New languages: [${languagesToTranslate.join(", ")}]`,
  );
  const tempDir = path.join(process.cwd(), `temp-job-${jobToProcess.id}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const srtBuffer = await storageService.downloadFile(
      jobToProcess.sourceSrtPath,
    );
    const localSourceSrt = path.join(tempDir, "source.srt");
    await writeFile(localSourceSrt, srtBuffer);

    // Execute translation promises for ONLY the new languages
    const translatePromises = languagesToTranslate.map(async (lang) => {
      // 2. Define a temporary path for the translated SRT file from DeepL
      const localTranslatedSrt = path.join(tempDir, `${lang}.srt`);

      await translator.translateDocument(
        localSourceSrt,
        localTranslatedSrt, // Output the translated SRT here
        null,
        lang as deepl.TargetLanguageCode,
      );

      // 3. Read the SRT content that DeepL just created
      const translatedSrtContent = await Bun.file(localTranslatedSrt).text();

      // 4. Convert the SRT content to VTT format
      const translatedVttContent = srtToVtt(translatedSrtContent);

      // 5. Perform all subsequent operations on the correct VTT content
      const duration = calculateSubtitleDuration(translatedVttContent);
      const credits = calculateCredits(duration);

      const remoteVttPath = `processed/${jobToProcess.id}/${lang}.vtt`;
      const translatedVttBuffer = Buffer.from(translatedVttContent);

      // 6. Upload the VTT buffer to cloud storage
      await storageService.uploadFile(remoteVttPath, translatedVttBuffer);

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
    if (estimatedCostForNewWork > 0) {
      await db
        .update(systemCredits)
        .set({
          availableUnits: sql`${systemCredits.availableUnits} - ${estimatedCostForNewWork}`,
        })
        .where(eq(systemCredits.id, 1));
    }

    // Finally, mark the job as completed
    await db
      .update(jobs)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(jobs.id, jobToProcess.id));

    console.log(
      `Job ID: ${jobToProcess.id} completed successfully. Deducted ${estimatedCostForNewWork} credits for this run.`,
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

    await logAuditEvent({
      actor: "system",
      action: "JOB_FAILED",
      details: {
        jobId: jobToProcess.id,
        error: (error as Error).message,
      },
    });
  } finally {
    await rmdir(tempDir, { recursive: true }).catch(console.error);
  }
}

async function main() {
  const intervalSeconds = parseInt(
    process.env.JOB_WORKER_INTERVAL_SECONDS || "20",
    10,
  );
  const intervalMilliseconds = intervalSeconds * 1000;

  console.log(
    `Translation processor started. Checking for jobs every ${intervalSeconds} seconds...`,
  );

  while (true) {
    await processJob();
    await new Promise((resolve) => setTimeout(resolve, intervalMilliseconds));
  }
}

main().catch(console.error);
