import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import { storageService } from "@/services/storage";
import type { SignedUrlResponse } from "@/types";

const app = new Hono();

app.post("/signed-url", async (c) => {
  const { files } = await c.req.json<{ files: string[] }>();

  if (!files || !Array.isArray(files)) {
    return c.json({ error: "Invalid request: 'files' must be an array." }, 400);
  }

  const response: { urls: SignedUrlResponse[] } = { urls: [] };

  for (const fileName of files) {
    const fileExt = fileName.split(".").pop()?.toLowerCase();
    if (fileExt !== "srt" && fileExt !== "vtt") {
      response.urls.push({
        fileName,
        uploadUrl: "",
        path: "",
        error: "Invalid file type. Only .srt and .vtt are supported.",
      });
      continue;
    }

    const contentType = fileExt === "srt" ? "text/srt" : "text/vtt";
    const uniqueKey = `uploads/translate/${uuidv4()}/${fileName}`;
    const uploadUrl = await storageService.getSignedUploadUrl(
      uniqueKey,
      contentType,
    );
    response.urls.push({ fileName, uploadUrl, path: uniqueKey });
  }

  return c.json(response);
});

export default app;
