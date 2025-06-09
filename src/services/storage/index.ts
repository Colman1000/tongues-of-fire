import { s3Service } from "./s3";
import { r2Service } from "./r2";

export interface StorageService {
  getSignedUploadUrl(key: string, contentType: string): Promise<string>;
  getSignedDownloadUrl(key: string): Promise<string>;
  uploadFile(key: string, body: Buffer | ArrayBuffer): Promise<void>;
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
}

const storageProvider = process.env.STORAGE_PROVIDER;

export const storageService: StorageService = (() => {
  if (storageProvider === "r2") {
    console.log("Using Cloudflare R2 storage provider.");
    return r2Service;
  }
  console.log("Defaulting to AWS S3 storage provider.");
  return s3Service;
})();
