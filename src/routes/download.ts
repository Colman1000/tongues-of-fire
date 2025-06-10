import { Hono } from "hono";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { storageService } from "@/services/storage";
import JSZip from "jszip";
import { logAuditEvent } from "@/services/audit";

const app = new Hono();

app.post("/", async (c) => {
  const { jobIds }: { jobIds: number[] } = await c.req.json();

  if (!jobIds?.length) {
    return c.json({ error: "Invalid or empty 'jobIds' array." }, 400);
  }

  try {
    const jobsToDownload = await db.query.jobs.findMany({
      where: inArray(jobs.id, jobIds),
      with: { files: true },
    });

    const downloadPromises = jobsToDownload.flatMap((job) =>
      job.files.map((file) =>
        storageService.downloadFile(file.path).then((buffer) => ({
          jobName: job.name,
          language: file.language,
          buffer,
        })),
      ),
    );

    const downloadedFiles = await Promise.all(downloadPromises);

    const zip = new JSZip();
    // CORRECTED TYPE: A folder context is a JSZip instance, not a JSZipObject.
    const jobFolders: Record<string, JSZip> = {};

    for (const fileData of downloadedFiles) {
      const sanitizedJobName = fileData.jobName.replace(/[/\\?%*:|"<>]/g, "-");

      if (!jobFolders[sanitizedJobName]) {
        // zip.folder() returns a new JSZip instance scoped to that folder.
        jobFolders[sanitizedJobName] = zip.folder(sanitizedJobName)!;
      }

      const jobFolder = jobFolders[sanitizedJobName];
      const fileName = `${sanitizedJobName}.${fileData.language}.vtt`;
      // This now works because jobFolder is correctly typed as JSZip.
      jobFolder.file(fileName, fileData.buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipFileName = `downloads/translations-${Date.now()}.zip`;
    await storageService.uploadFile(zipFileName, zipBuffer);

    const downloadUrl = await storageService.getSignedDownloadUrl(zipFileName);

    const { sub: actor } = c.get("jwtPayload");
    await logAuditEvent({
      actor,
      action: "JOB_DOWNLOADED",
      details: { jobIds },
    });

    return c.json({ downloadUrl });
  } catch (error) {
    console.error("Failed to create zip archive:", error);
    return c.json({ error: "Failed to process download request." }, 500);
  }
});

export default app;
