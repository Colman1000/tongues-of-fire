import { Hono } from "hono";
import { db } from "@/db";
import { jobs, systemCredits, translatedFiles } from "@/db/schema";
import { and, inArray, not, eq } from "drizzle-orm";
import { storageService } from "@/services/storage";
import { logAuditEvent } from "@/services/audit";

const app = new Hono();

// --- NEW: Endpoint to get details for a single job ---
app.get("/:id", async (c) => {
  const jobId = parseInt(c.req.param("id"), 10);
  if (isNaN(jobId)) {
    return c.json({ error: "Invalid job ID." }, 400);
  }

  // Use a relational query to fetch the job and all its associated files
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
    with: {
      files: true, // This will include the nested array of translated files
    },
  });

  if (!job) {
    return c.json({ error: "Job not found." }, 404);
  }

  // --- THE FIX IS HERE: Calculate the correct total credits ---
  const totalCreditsUsed = job.files
    .filter((file) => file.language !== "en") // Exclude the 'en' file
    .reduce((sum, file) => sum + file.creditsUsed, 0); // Sum the rest

  // Construct a new response object with the added field
  const response = {
    ...job,
    totalCreditsUsed,
  };

  return c.json(response);
});

// --- NEW: Endpoint to append languages to existing jobs ---
app.patch("/append-languages", async (c) => {
  const { jobIds, languages } = await c.req.json<{
    jobIds: number[];
    languages: string[];
  }>();

  if (
    !jobIds ||
    !Array.isArray(jobIds) ||
    jobIds.length === 0 ||
    !languages ||
    !Array.isArray(languages) ||
    languages.length === 0
  ) {
    return c.json(
      { error: "Invalid or empty 'jobIds' or 'languages' array." },
      400,
    );
  }

  const [creditsRecord] = await db.select().from(systemCredits).limit(1);
  let availableUnits = creditsRecord?.availableUnits ?? 0;

  const updatedJobs = [];
  const skippedJobs = [];

  for (const jobId of jobIds) {
    // Get the job and its original 'en' file for cost estimation
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
      with: {
        files: {
          where: eq(translatedFiles.language, "en"),
        },
      },
    });

    if (!job) {
      skippedJobs.push({ jobId, reason: "Job not found." });
      continue;
    }

    const sourceFile = job.files[0];
    if (!sourceFile) {
      skippedJobs.push({
        jobId,
        reason: "Source file for cost estimation not found.",
      });
      continue;
    }

    // Determine which languages are actually new
    const existingLangs = new Set(job.targetLanguages);
    const newLangsToAdd = languages.filter((lang) => !existingLangs.has(lang));

    if (newLangsToAdd.length === 0) {
      skippedJobs.push({
        jobId,
        reason: "All requested languages already exist.",
      });
      continue;
    }

    // Estimate cost for only the new languages
    const estimatedCost = sourceFile.creditsUsed * newLangsToAdd.length;

    if (availableUnits < estimatedCost) {
      skippedJobs.push({
        jobId,
        reason: `Insufficient credits. Required: ~${estimatedCost}, Available: ${availableUnits}`,
      });
      continue;
    }

    // If all checks pass, update the job
    const updatedTargetLanguages = [...job.targetLanguages, ...newLangsToAdd];
    await db
      .update(jobs)
      .set({
        targetLanguages: updatedTargetLanguages,
        status: "batched", // Re-batch the job for processing
      })
      .where(eq(jobs.id, jobId));

    // Deduct estimated cost from our running total for this request
    availableUnits -= estimatedCost;
    updatedJobs.push({ jobId, addedLanguages: newLangsToAdd });
  }

  const { sub: actor } = c.get("jwtPayload");
  for (const job of updatedJobs) {
    await logAuditEvent({
      actor,
      action: "JOB_LANGUAGES_APPENDED",
      details: { jobId: job.jobId, addedLanguages: job.addedLanguages },
    });
  }

  return c.json({
    message: "Append languages operation completed.",
    updated: updatedJobs,
    skipped: skippedJobs,
  });
});

// --- EXISTING: Endpoint to delete jobs ---
app.delete("/", async (c) => {
  const { jobIds } = await c.req.json<{ jobIds: number[] }>();

  if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
    return c.json({ error: "Invalid or empty 'jobIds' array." }, 400);
  }

  // 1. Find all jobs that are NOT currently processing
  const jobsToDelete = await db.query.jobs.findMany({
    where: and(inArray(jobs.id, jobIds), not(eq(jobs.status, "processing"))),
    with: {
      files: true, // Also fetch associated files
    },
  });

  if (jobsToDelete.length === 0) {
    return c.json({
      message: "No valid jobs to delete.",
      deleted: [],
      skipped: jobIds,
    });
  }

  const deletedIds = jobsToDelete.map((j) => j.id);
  const skippedIds = jobIds.filter((id) => !deletedIds.includes(id));

  // 2. Collect all unique file paths associated with the jobs
  const pathsToDelete = new Set<string>();
  for (const job of jobsToDelete) {
    pathsToDelete.add(job.originalPath);
    pathsToDelete.add(job.sourceSrtPath);
    for (const file of job.files) {
      pathsToDelete.add(file.path);
    }
  }

  // 3. Attempt to delete all files from cloud storage
  const deletePromises = Array.from(pathsToDelete).map((path) =>
    storageService.deleteFile(path),
  );
  await Promise.allSettled(deletePromises);

  // 4. Delete the jobs from the database.
  await db.delete(jobs).where(inArray(jobs.id, deletedIds));

  const { sub: actor } = c.get("jwtPayload");
  if (deletedIds.length > 0) {
    await logAuditEvent({
      actor,
      action: "JOB_DELETED",
      details: { deletedIds },
    });
  }

  return c.json({
    message: "Delete operation completed.",
    deleted: deletedIds,
    skipped: skippedIds,
  });
});

export default app;
