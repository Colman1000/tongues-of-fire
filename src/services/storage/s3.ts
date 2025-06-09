import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageService } from "./index";

// --- AWS SDK Client for Pre-signing URLs ---
const awsS3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

// --- Bun's Native S3 Client for Server-Side Operations ---
const bunS3Client = new Bun.S3Client({
  region: process.env.AWS_REGION!,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  bucket: BUCKET_NAME,
});

export const s3Service: StorageService = {
  // Use AWS SDK for pre-signed URLs
  getSignedUploadUrl: (key, contentType) => {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(awsS3Client, command, { expiresIn: 600 });
  },

  // Use AWS SDK for pre-signed URLs
  getSignedDownloadUrl: (key) => {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    return getSignedUrl(awsS3Client, command, { expiresIn: 600 });
  },

  // Use Bun's native client for performance on the backend
  uploadFile: async (key, body) => {
    await bunS3Client.write(key, body);
  },

  // Use Bun's native client for performance on the backend
  downloadFile: async (key) => {
    const response = await bunS3Client.file(key).arrayBuffer();
    return Buffer.from(response);
  },

  // Use Bun's native client for performance on the backend
  deleteFile: async (key) => {
    await bunS3Client.delete(key);
  },
};
