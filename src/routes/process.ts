import { Hono } from "hono";
import { db } from "@/db";
import { jobs, translatedFiles } from "@/db/schema";
import { storageService } from "@/services/storage";
import { srtToVtt, vttToSrt } from "@/services/file-converter";
import { eq } from "drizzle-orm";
import path from "node:path";

const app = new Hono();

app.post("/", async (c) => {
  const {
    languages,
    files,
  }: { languages: string[]; files: Record<string, string> } =
    await c.req.json();

  if (!languages?.length || !files || Object.keys(files).length === 0) {
    return c.json({ error: "Missing languages or files" }, 400);
  }

  const createdJobIds: number[] = [];

  for (const name in files) {
    const originalPath = files[name];
    const fileExt = path.extname(originalPath).toLowerCase();

    const [job] = await db
      .insert(jobs)
      .values({
        name,
        originalPath,
        sourceSrtPath: "", // Placeholder, updated below
        targetLanguages: languages,
        status: "pending", // Start as pending
      })
      .returning({ id: jobs.id });

    const jobId = job.id;
    createdJobIds.push(jobId);

    try {
      const fileContent = (
        await storageService.downloadFile(originalPath)
      ).toString("utf-8");

      let sourceSrtPath = "";
      if (fileExt === ".srt") {
        sourceSrtPath = originalPath;
        const vttPath = `processed/${jobId}/english.vtt`;
        await storageService.uploadFile(
          vttPath,
          Buffer.from(srtToVtt(fileContent)),
        );
        await db
          .insert(translatedFiles)
          .values({ jobId, language: "en", path: vttPath });
      } else if (fileExt === ".vtt") {
        sourceSrtPath = `processed/${jobId}/source.srt`;
        await storageService.uploadFile(
          sourceSrtPath,
          Buffer.from(vttToSrt(fileContent)),
        );
        await db
          .insert(translatedFiles)
          .values({ jobId, language: "en", path: originalPath });
      }

      await db
        .update(jobs)
        .set({ sourceSrtPath, status: "batched" })
        .where(eq(jobs.id, jobId));
    } catch (error) {
      console.error(`Failed to process file for job ${jobId}:`, error);
      await db.update(jobs).set({ status: "failed" }).where(eq(jobs.id, jobId));
    }
  }

  return c.json(
    { message: "Jobs batched for processing.", jobIds: createdJobIds },
    202,
  );
});

export default app;
