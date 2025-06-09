import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageService } from "./index";

// Bun's native S3 client is available globally in the Bun runtime
const r2Client = new Bun.S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: "auto",
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

const credentials = {
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucket: BUCKET_NAME,
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, // Cloudflare R2
} as const;

// --- AWS SDK S3-Compatible Client for Pre-signing URLs ---
const awsR2Client = new S3Client({
  region: "auto",
  endpoint: credentials.endpoint,
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
  },
});

export const r2Service: StorageService = {
  getSignedUploadUrl: (key, contentType) => {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(awsR2Client, command, { expiresIn: 600 });
  },

  getSignedDownloadUrl: async (key) => {
    return Bun.S3Client.presign(key, {
      ...credentials,
      expiresIn: 600, // URL expires in 10 minutes
    });
  },

  // Use Bun's native client for performance on the backend
  uploadFile: async (key, body) => {
    await r2Client.write(key, body);
  },

  // Use Bun's native client for performance on the backend
  downloadFile: async (key) => {
    const response = await r2Client.file(key).arrayBuffer();
    return Buffer.from(response);
  },

  // Use Bun's native client for performance on the backend
  deleteFile: async (key) => {
    await r2Client.delete(key);
  },
};
