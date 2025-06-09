import { Hono } from "hono";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { storageService } from "@/services/storage";
import JSZip from "jszip";
import path from "node:path";

const app = new Hono();

app.post("/", async (c) => {
  const { jobIds }: { jobIds: number[] } = await c.req.json();

  if (!jobIds?.length) {
    return c.json({ error: "Invalid or empty 'jobIds' array." }, 400);
  }

  const zip = new JSZip();

  try {
    const jobsToDownload = await db.query.jobs.findMany({
      where: inArray(jobs.id, jobIds),
      with: { files: true }, // Drizzle relation query
    });

    for (const job of jobsToDownload) {
      if (job.files.length > 0) {
        const jobFolder = zip.folder(job.name.replace(/[/\\?%*:|"<>]/g, "-"));
        for (const file of job.files) {
          const fileBuffer = await storageService.downloadFile(file.path);
          const fileName = `${job.name.replace(/[/\\?%*:|"<>]/g, "-")}.${file.language}.vtt`;
          jobFolder?.file(fileName, fileBuffer);
        }
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipFileName = `downloads/translations-${Date.now()}.zip`;
    await storageService.uploadFile(zipFileName, zipBuffer);

    const downloadUrl = await storageService.getSignedDownloadUrl(zipFileName);
    return c.json({ downloadUrl });
  } catch (error) {
    console.error("Failed to create zip archive:", error);
    return c.json({ error: "Failed to process download request." }, 500);
  }
});

export default app;
