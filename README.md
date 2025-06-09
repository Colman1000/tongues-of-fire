### **LLM Instruction Document: Backend for SRT/VTT File Translation Service**

Below are the detailed instructions to create a backend application for translating subtitle files (`.srt` and `.vtt`) using DeepL.

#### **1. Core Technology Stack**

*   **Runtime:** Bun.js
*   **Framework:** Hono
*   **Database:** Bun SQLite with Drizzle ORM
*   **File Storage:** A swappable module for AWS S3 or Cloudflare R2.
*   **Deployment:** Docker container on an AWS EC2 instance.

#### **2. Project Structure**

Create a standard project structure for a Hono application.

```bash
.
├── src
│   ├── db
│   │   ├── migrations
│   │   ├── schema.ts
│   │   └── index.ts
│   ├── routes
│   │   ├── index.ts
│   │   ├── upload.ts
│   │   ├── process.ts
│   │   ├── report.ts
│   │   └── download.ts
│   ├── services
│   │   ├── storage
│   │   │   ├── index.ts
│   │   │   ├── s3.ts
│   │   │   └── r2.ts
│   │   ├── translation.ts
│   │   └── file-converter.ts
│   ├── jobs
│   │   └── translation-processor.ts
│   ├── index.ts
│   └── types.ts
├── .env.example
├── .gitignore
├── Dockerfile
├── bun.lockb
├── package.json
└── tsconfig.json
```

#### **3. Database Setup (Drizzle ORM with Bun SQLite)**

In `src/db/schema.ts`, define the database schema using Drizzle ORM.

*   **`jobs` table:**
    *   `id`: Primary Key (autoincrement)
    *   `name`: Text, not null
    *   `originalPath`: Text, not null (Path to the original uploaded file)
    *   `sourceSrtPath`: Text, not null (Path to the `.srt` file used for translation)
    *   `status`: Text, with possible values: 'pending', 'batched', 'processing', 'completed', 'failed'. Default to 'pending'.
    *   `targetLanguages`: JSON array of strings (e.g., `['fr', 'de', 'pt']`)
    *   `completedAt`: Integer (Unix timestamp), nullable
    *   `createdAt`: Integer (Unix timestamp), default to current time
    *   `updatedAt`: Integer (Unix timestamp), default to current time

*   **`translatedFiles` table:**
    *   `id`: Primary Key (autoincrement)
    *   `jobId`: Foreign key referencing `jobs.id`
    *   `language`: Text, not null (e.g., 'en', 'fr')
    *   `path`: Text, not null (Path to the translated `.vtt` file)
    *   `createdAt`: Integer (Unix timestamp), default to current time

*   **`logs` table:**
    *   `id`: Primary Key (autoincrement)
    *   `jobId`: Foreign key referencing `jobs.id`
    *   `creditsUsed`: Integer, nullable
    *   `message`: Text
    *   `createdAt`: Integer (Unix timestamp), default to current time

#### **4. File Storage Abstraction (S3/R2)**

Create a swappable file storage service in `src/services/storage/`.

*   **`src/services/storage/index.ts`**: This file will export the correct storage client based on an environment variable (`STORAGE_PROVIDER`).
*   **`src/services/storage/s3.ts`**: Implements the S3 client using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
*   **`src/services/storage/r2.ts`**: Implements the R2 client (which is S3-compatible).
*   The service should expose the following methods:
    *   `getSignedUploadUrl(fileName: string, contentType: string): Promise<string>`
    *   `getSignedDownloadUrl(filePath: string): Promise<string>`
    *   `uploadFile(filePath: string, file: Buffer): Promise<void>`
    *   `downloadFile(filePath: string): Promise<Buffer>`
    *   `deleteFile(filePath: string): Promise<void>`

Use `Bun.file()` for reading local files before uploading them.

#### **5. API Endpoints (Hono)**

Implement the following API endpoints.

##### **5.1. `[SRT UPLOAD]` - `POST /upload/signed-url`**

*   **Request Body:**
    ```json
    {
      "files": ["Attending Grace.srt", "Messaging.vtt"]
    }
    ```
*   **Logic:**
    1.  For each filename in the `files` array, generate a unique key for the object storage (e.g., `uploads/translate/<uuid>/${fileName}`).
    2.  Use the file storage service to generate a pre-signed upload URL for each file.
    3.  The content type should be validated to be either `text/srt` or `text/vtt`.
*   **Response Body:**
    ```json
    {
      "urls": [
        {
          "fileName": "Attending Grace.srt",
          "uploadUrl": "https://s3.amazonaws.com/..."
        },
        {
          "fileName": "Messaging.vtt",
          "uploadUrl": "https://s3.amazonaws.com/..."
        }
      ]
    }
    ```

##### **5.2. `[SRT PROCESSING]` - `POST /process`**

*   **Request Body:**
    ```json
    {
      "languages": ["fr", "de", "pt"],
      "files": {
        "Attending Grace": "uploads/translate/.../Attending Grace.srt",
        "Messaging": "uploads/translate/.../Messaging.vtt"
      }
    }
    ```
*   **Logic:**
    1.  Iterate through the `files` object. For each entry:
    2.  Create a new record in the `jobs` table with the `name`, `originalPath`, `targetLanguages`, and a status of `'batched'`.
    3.  Download the original file from the storage provider using the provided path.
    4.  **File Conversion:**
        *   If the uploaded file is `.srt`:
            *   The `sourceSrtPath` in the `jobs` table is the `originalPath`.
            *   Convert the `.srt` file to `.vtt` using a utility function.
            *   Upload this new `.vtt` file to storage (e.g., `processed/<jobId>/english.vtt`).
            *   Create an entry in the `translatedFiles` table for the English (`en`) version with the path to this new `.vtt` file.
        *   If the uploaded file is `.vtt`:
            *   Convert the `.vtt` file to `.srt`.
            *   Upload the new `.srt` file to storage (e.g., `processed/<jobId>/source.srt`).
            *   Set the `sourceSrtPath` in the `jobs` table to the path of this new `.srt` file.
            *   Create an entry in the `translatedFiles` table for the English (`en`) version with the `originalPath`.
    5.  Clean up any temporary local files created during conversion.
*   **Response:** Return a `202 Accepted` status with the newly created job IDs.

##### **5.3. `[Report]` - `GET /report`**

*   **Logic:**
    1.  Query the database to get all jobs.
    2.  Join with the `translatedFiles` and `logs` tables to aggregate the required information.
    3.  This endpoint will be called frequently, so ensure the query is optimized. Consider pagination.
*   **Response Body:**
    ```json
    {
      "jobs": [
        {
          "jobId": 1,
          "jobName": "Attending Grace",
          "languages": ["en", "fr", "de", "pt"],
          "createdAt": "2025-06-09T16:45:50.000Z",
          "status": "completed",
          "creditsUsed": 1250
        }
      ]
    }
    ```

##### **5.4. `[Download]` - `POST /download`**

*   **Request Body:**
    ```json
    {
      "jobs": [1, 3, 22]
    }
    ```
*   **Logic:**
    1.  Create a temporary local directory.
    2.  For each `jobId` in the request:
        *   Query the `translatedFiles` table to get all associated file paths for that job.
        *   Create a subdirectory named after the `job.name`.
        *   Download all the `.vtt` files for that job into this subdirectory.
    3.  Use a library like `zip.js` or a Bun-native equivalent to zip the entire temporary directory.
    4.  Upload the final zip file to a `downloads` folder in your storage provider.
    5.  Generate a pre-signed download URL for the zip file.
    6.  **Crucially, clean up the temporary local directory and the created zip file.**
*   **Response Body:**
    ```json
    {
      "downloadUrl": "https://s3.amazonaws.com/..."
    }
    ```

#### **6. Background Translation Process**

This will be a separate, long-running process.

*   **`src/jobs/translation-processor.ts`**:
    1.  This script will run on a loop (e.g., every 10 seconds).
    2.  Query the database for jobs with the status `'batched'`.
    3.  Pick one job and update its status to `'processing'`.
    4.  Retrieve the `sourceSrtPath` and `targetLanguages` for the job.
    5.  Download the source `.srt` file locally.
    6.  Use `Promise.all` to send translation requests to the DeepL API for all target languages concurrently.
        *   Instantiate the `deepl-node` translator as shown in the prompt.
        *   For each language, call `translator.translateDocument()`. The input is the local source `.srt` file, and the output should be a temporary local `.vtt` file (e.g., `temp/<jobId>/french.vtt`).
    7.  After all translations are complete:
        *   Upload each translated `.vtt` file to your storage provider (e.g., `processed/<jobId>/french.vtt`).
        *   Create a new record in the `translatedFiles` table for each successfully translated file.
        *   Log the total credits used in the `logs` table.
        *   Update the job's status to `'completed'`.
    8.  Implement robust error handling. If a translation fails, log the error and potentially set the job status to `'failed'`.
    9.  Ensure all temporary local files are deleted after the process is finished for a job.

#### **7. File Conversion Utility**

*   **`src/services/file-converter.ts`**:
    *   Create two functions: `srtToVtt(srtContent: string): string` and `vttToSrt(vttContent: string): string`.
    *   These functions will handle the string manipulation required to convert between the two subtitle formats. The primary difference is the timestamp format (`00:00:00,000` in `.srt` vs. `00:00:00.000` in `.vtt`) and the `WEBVTT` header in `.vtt` files.

#### **8. Dockerization**

Create a `Dockerfile` to containerize the application.

```dockerfile
# Use the official Bun image
FROM oven/bun:1.0

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and bun.lockb
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the app
CMD ["bun", "run", "src/index.ts"]
```

#### **9. Environment Variables**

Define the necessary environment variables in `.env.example`.

```
# Server
PORT=3000

# Database
DATABASE_URL="file:./dev.db"

# DeepL API
DEEPL_KEY="your_deepl_api_key"

# Storage Provider ('s3' or 'r2')
STORAGE_PROVIDER="s3"

# AWS S3
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
S3_BUCKET_NAME="..."

# Cloudflare R2
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="..."
```
