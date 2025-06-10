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

  // 2. Determine what work actually needs to be done
  const existingFiles = await db
    .select({ language: translatedFiles.language })
    .from(translatedFiles)
    .where(eq(translatedFiles.jobId, jobToProcess.id));
  const existingLangs = new Set(existingFiles.map((f) => f.language));

  const languagesToTranslate = jobToProcess.targetLanguages.filter(
    (lang) => !existingLangs.has(lang),
  );

  // 3. Handle the edge case where no new work is needed
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

  // 4. Get the cost-per-language from the original 'en' file
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

  // 5. Calculate the ACCURATE estimated cost for ONLY the new work
  const estimatedCostForNewWork =
    originalFile.creditsUsed * languagesToTranslate.length;

  // 6. Perform the credit check against the accurate cost
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

    // 7. Execute translation promises for ONLY the new languages
    const translatePromises = languagesToTranslate.map(async (lang) => {
      const localVtt = path.join(tempDir, `${lang}.vtt`);

      await translator.translateDocument(
        localSourceSrt,
        localVtt,
        null,
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

    // --- CREDIT DEDUCTION (THE FIX IS HERE) ---
    // We deduct the pre-calculated cost of the work we just completed.
    // This is more efficient and avoids the TypeScript error.
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

    // Log the job failure
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
  console.log("Translation processor started. Checking for jobs...");
  while (true) {
    await processJob();
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

main().catch(console.error);
