# **Subtitle Translation Service API Documentation**

This document provides detailed information about the API endpoints for the Subtitle Translation Service.

## **Base URL**

All API endpoints are prefixed with `/api`. The base URL for a local development environment is:

`http://localhost:3000/api`

## **Authentication**

No authentication is required for the current version of this API.

---

## **Endpoints**

The typical workflow is as follows:
1.  Get pre-signed URLs for your files using `POST /upload/signed-url`.
2.  Upload your files directly to the cloud storage using the provided URLs.
3.  Create translation jobs using `POST /process`.
4.  Check the status of your jobs using `GET /report`.
5.  Once jobs are complete, download the results using `POST /download`.

---

### **1. Get Pre-signed Upload URLs**

Generates secure, temporary URLs that allow a client to upload subtitle files directly to the cloud storage provider (S3 or R2). This avoids proxying large files through the API server.

*   **Endpoint:** `POST /upload/signed-url`
*   **Description:** Requests one or more pre-signed URLs for uploading `.srt` or `.vtt` files.

#### **Request Body**

| Field | Type           | Description                               | Required |
| :---- | :------------- | :---------------------------------------- | :------- |
| `files` | `string[]`     | An array of filenames you intend to upload. | Yes      |

**Example Request (`curl`)**
```bash
curl -X POST http://localhost:3000/api/upload/signed-url \
-H "Content-Type: application/json" \
-d '{
  "files": ["Attending Grace.srt", "Messaging.vtt", "invalid-file.txt"]
}'
```

#### **Success Response (`200 OK`)**

Returns a list of objects, each containing the original filename, a unique path for the file in storage, and the pre-signed `uploadUrl`. If a file has an invalid extension, its `uploadUrl` will be empty and an `error` message will be present.

```json
{
  "urls": [
    {
      "fileName": "Attending Grace.srt",
      "uploadUrl": "https://your-bucket.s3.amazonaws.com/uploads/translate/uuid-1/.../Attending%20Grace.srt?X-Amz-Algorithm=...",
      "path": "uploads/translate/uuid-1/Attending Grace.srt"
    },
    {
      "fileName": "Messaging.vtt",
      "uploadUrl": "https://your-bucket.s3.amazonaws.com/uploads/translate/uuid-2/.../Messaging.vtt?X-Amz-Algorithm=...",
      "path": "uploads/translate/uuid-2/Messaging.vtt"
    },
    {
      "fileName": "invalid-file.txt",
      "uploadUrl": "",
      "path": "",
      "error": "Invalid file type. Only .srt and .vtt are supported."
    }
  ]
}
```

#### **Error Response (`400 Bad Request`)**

Returned if the `files` field is missing or not an array.

```json
{
  "error": "Invalid request: 'files' must be an array."
}
```

---

### **2. Create and Process Translation Jobs**

Initiates the translation process for the uploaded files. This endpoint is asynchronous; it creates the jobs and returns immediately with a `202 Accepted` status. The actual translation happens in the background.

*   **Endpoint:** `POST /process`
*   **Description:** Creates translation jobs for one or more uploaded files.

#### **Request Body**

| Field       | Type                | Description                                                                                             | Required |
| :---------- | :------------------ | :------------------------------------------------------------------------------------------------------ | :------- |
| `languages` | `string[]`          | An array of target language codes (e.g., `'fr'`, `'de'`, `'pt'`).                                         | Yes      |
| `files`     | `Record<string, string>` | An object where each key is a friendly name for the job and the value is the `path` from the previous step. | Yes      |

**Example Request (`curl`)**
```bash
curl -X POST http://localhost:3000/api/process \
-H "Content-Type: application/json" \
-d '{
  "languages": ["fr", "de", "pt"],
  "files": {
    "Attending Grace": "uploads/translate/uuid-1/Attending Grace.srt",
    "Messaging": "uploads/translate/uuid-2/Messaging.vtt"
  }
}'
```

#### **Success Response (`202 Accepted`)**

Returns a confirmation message and an array of the `jobIds` that were created and batched for processing.

```json
{
  "message": "Jobs batched for processing.",
  "jobIds": [1, 2]
}
```

#### **Error Response (`400 Bad Request`)**

Returned if `languages` or `files` are missing or empty.

```json
{
  "error": "Missing languages or files"
}
```

---

### **3. Get Job Report**

Retrieves a summary of all translation jobs, including their status and metadata.

*   **Endpoint:** `GET /report`
*   **Description:** Fetches a list of all jobs in the system.

**Example Request (`curl`)**
```bash
curl http://localhost:3000/api/report
```

#### **Success Response (`200 OK`)**

Returns an object containing a list of all jobs. The `languages` array includes `'en'` for the original file plus all target languages.

```json
{
  "jobs": [
    {
      "jobId": 2,
      "jobName": "Messaging",
      "languages": ["en", "fr", "de", "pt"],
      "createdAt": "2025-06-10T10:30:00.000Z",
      "status": "processing",
      "creditsUsed": null
    },
    {
      "jobId": 1,
      "jobName": "Attending Grace",
      "languages": ["en", "fr", "de", "pt"],
      "createdAt": "2025-06-10T10:29:55.000Z",
      "status": "completed",
      "creditsUsed": 1250
    }
  ]
}
```

---

### **4. Download Translated Files**

Generates a pre-signed download URL for a `.zip` archive containing all the translated `.vtt` files for one or more specified jobs.

*   **Endpoint:** `POST /download`
*   **Description:** Creates a zip archive of translated files and provides a URL to download it.

#### **Request Body**

| Field   | Type       | Description                               | Required |
| :------ | :--------- | :---------------------------------------- | :------- |
| `jobIds`  | `number[]` | An array of job IDs to include in the zip. | Yes      |

**Example Request (`curl`)**
```bash
curl -X POST http://localhost:3000/api/download \
-H "Content-Type: application/json" \
-d '{
  "jobIds": [1, 22]
}'
```

#### **Success Response (`200 OK`)**

Returns a single pre-signed URL to download the generated zip file.

```json
{
  "downloadUrl": "https://your-bucket.s3.amazonaws.com/downloads/translations-1686393600000.zip?X-Amz-Algorithm=..."
}
```

#### **Error Response (`400 Bad Request`)**

Returned if the `jobIds` field is missing or not an array.

```json
{
  "error": "Invalid or empty 'jobIds' array."
}
```

#### **Error Response (`500 Internal Server Error`)**

Returned if an error occurs during the file download or zipping process on the server.

```json
{
  "error": "Failed to process download request."
}
```
