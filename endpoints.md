# **Subtitle Translation Service API Documentation**

This document provides detailed information about the API endpoints for the Subtitle Translation Service. The API allows for uploading subtitle files, managing translation jobs, and monitoring system resources, all protected by a robust authentication system.

## **Base URL**

All API endpoints are prefixed. The base URL for a local development environment is:

`http://ec2-54-87-136-3.compute-1.amazonaws.com`

## **Authentication**

This API uses **JWT (JSON Web Token)** for standard user authentication. Access is a two-step process:

1.  **Login:** First, you must send a `POST` request with your `username` and `password` to the `/auth/login` endpoint to receive a temporary access token.
2.  **Authenticated Requests:** For all subsequent requests to the `/api/*` endpoints, you must include this token in the `Authorization` header with the `Bearer` scheme.

The token is valid for **24 hours**.

---

## **Public Endpoints**

These endpoints do not require JWT authentication.

### **1. Login and Get Token**

*   **Endpoint:** `POST /auth/login`
*   **Description:** Authenticates with static credentials and returns a JWT. This is the first step for all API interactions.

#### **Request Body**

| Field      | Type     | Description      |
| :--------- | :------- | :--------------- |
| `username` | `string` | The API username. |
| `password` | `string` | The API password. |

**Example Request (`curl`)**
```bash
curl -X POST http://ec2-54-87-136-3.compute-1.amazonaws.com/auth/login \
-H "Content-Type: application/json" \
-d '{
  "username": "admin",
  "password": "your_strong_secret_password"
}'
```

#### **Success Response (`200 OK`)**

Returns the JWT access token.

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTY4NjM5MzYwMCwiZXhwIjoxNjg2NDgwMDAwfQ.some_signature_here"
}
```

#### **Error Response (`401 Unauthorized`)**

```json
{
  "error": "Invalid username or password"
}
```

---

## **Protected API Endpoints**

All endpoints below require the `Authorization: Bearer <YOUR_JWT_TOKEN>` header.

### **2. File Upload**

#### **Get Pre-signed Upload URLs**

*   **Endpoint:** `POST /api/upload/signed-url`
*   **Description:** Generates secure, temporary URLs that allow a client to upload subtitle files directly to cloud storage.

**Request Body**
| Field | Type | Description | Required |
| :---- | :--- | :--- | :--- |
| `files` | `string[]` | An array of filenames you intend to upload. | Yes |

**Example Request (`curl`)**
```bash
# Replace <YOUR_JWT_TOKEN> with the token from the login step
curl -X POST \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  http://ec2-54-87-136-3.compute-1.amazonaws.com/api/upload/signed-url \
  -d '{
    "files": ["Attending Grace.srt"]
  }'
```

**Success Response (`200 OK`)**
```json
{
  "urls": [
    {
      "fileName": "Attending Grace.srt",
      "uploadUrl": "https://your-bucket.s3.amazonaws.com/...",
      "path": "uploads/translate/uuid-1/Attending Grace.srt"
    }
  ]
}
```

---

### **3. Job Management**

#### **Create and Process Translation Jobs**

*   **Endpoint:** `POST /api/process`
*   **Description:** Creates translation jobs for one or more uploaded files. This is an asynchronous endpoint; the actual translation happens in the background.

**Request Body**
| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `languages` | `string[]` | An array of target language codes (e.g., `'fr'`, `'de'`). | Yes |
| `files` | `Record<string, string>` | An object where each key is a job name and the value is the `path` from the upload step. | Yes |

**Example Request (`curl`)**
```bash
curl -X POST \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  http://ec2-54-87-136-3.compute-1.amazonaws.com/api/process \
  -d '{
    "languages": ["fr", "de"],
    "files": {
      "Attending Grace": "uploads/translate/uuid-1/Attending Grace.srt"
    }
  }'
```

**Success Response (`202 Accepted`)**
```json
{
  "message": "Jobs batched for processing.",
  "jobIds": [1]
}
```

#### **Append Languages to Jobs**

*   **Endpoint:** `PATCH /api/jobs/append-languages`
*   **Description:** Adds new target languages to existing jobs and re-batches them. It intelligently skips languages that already exist and performs a credit check for the new work.

**Request Body**
| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `jobIds` | `number[]` | An array of job IDs to update. | Yes |
| `languages` | `string[]` | An array of language codes to add. | Yes |

**Example Request (`curl`)**
```bash
curl -X PATCH \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  http://ec2-54-87-136-3.compute-1.amazonaws.com/api/jobs/append-languages \
  -d '{
    "jobIds": [1, 2],
    "languages": ["es", "it"]
  }'
```

**Success Response (`200 OK`)**
```json
{
  "message": "Append languages operation completed.",
  "updated": [
    {
      "jobId": 1,
      "addedLanguages": ["es", "it"]
    }
  ],
  "skipped": [
    {
      "jobId": 2,
      "reason": "Insufficient credits. Required: ~1.0, Available: 0.8"
    }
  ]
}
```

#### **Delete Jobs**

*   **Endpoint:** `DELETE /api/jobs`
*   **Description:** Permanently deletes one or more jobs and their associated files. Jobs in `processing` status are ignored. **This action is irreversible.**

**Request Body**
| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `jobIds` | `number[]` | An array of job IDs to delete. | Yes |

**Example Request (`curl`)**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  http://ec2-54-87-136-3.compute-1.amazonaws.com/api/jobs \
  -d '{
    "jobIds": [1, 3, 5]
  }'
```

**Success Response (`200 OK`)**
```json
{
  "message": "Delete operation completed.",
  "deleted": [1, 5],
  "skipped": [3]
}
```

---

### **4. Reporting and Downloading**

#### **Get Job Report (with Pagination)**

*   **Endpoint:** `GET /api/report`
*   **Description:** Fetches a paginated, filterable, and sortable list of all jobs.

**Query Parameters**
| Parameter | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `page` | `number` | The page number to retrieve. | `1` |
| `pageSize` | `number` | The number of items per page. (Max: 100) | `10` |
| `search` | `string` | A search term to filter jobs by name. | `""` |
| `sortBy` | `string` | Column to sort by: `jobName`, `status`, `createdAt`. | `createdAt` |
| `sortOrder` | `string` | Sort direction: `asc`, `desc`. | `desc` |
| `filter[status]` | `string` | Comma-separated list of statuses to filter by. | `""` |

**Example Request (`curl`)**
```bash
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" "http://ec2-54-87-136-3.compute-1.amazonaws.com/api/report?search=Grace&filter[status]=completed,failed"
```

**Success Response (`200 OK`)**
```json
{
  "data": [
    {
      "jobId": 1,
      "jobName": "Attending Grace",
      "languages": ["en", "fr", "de"],
      "createdAt": "2025-06-10T10:29:55.000Z",
      "status": "completed",
      "creditsUsed": 1250
    }
  ],
  "meta": {
    "totalItems": 1,
    "currentPage": 1,
    "pageSize": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

#### **Download Translated Files**

*   **Endpoint:** `POST /api/download`
*   **Description:** Creates a zip archive of translated files and provides a URL to download it.

**Request Body**
| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `jobIds` | `number[]` | An array of job IDs to include in the zip. | Yes |

**Example Request (`curl`)**
```bash
curl -X POST \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  http://ec2-54-87-136-3.compute-1.amazonaws.com/api/download \
  -d '{
    "jobIds": [1, 22]
  }'
```

**Success Response (`200 OK`)**
```json
{
  "downloadUrl": "https://your-bucket.s3.amazonaws.com/..."
}
```

---

### **5. Dashboard and Credits**

#### **Get Dashboard Summary**

*   **Endpoint:** `GET /api/dashboard/summary`
*   **Description:** Retrieves a high-level summary of system statistics.

**Example Request (`curl`)**
```bash
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" http://ec2-54-87-136-3.compute-1.amazonaws.com/api/dashboard/summary
```

**Success Response (`200 OK`)**
```json
{
  "availableUnits": 9850.5,
  "totalJobs": 25,
  "processingJobs": 2,
  "completedJobs": 18
}
```

#### **Get Remaining Credits**

*   **Endpoint:** `GET /api/dashboard/credits/remaining`
*   **Description:** Retrieves the current available credit balance for the system.

**Example Request (`curl`)**
```bash
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" http://ec2-54-87-136-3.compute-1.amazonaws.com/api/dashboard/credits/remaining
```

**Success Response (`200 OK`)**
```json
{
  "availableUnits": 9850.5
}
```

---

## **Admin Endpoints**

These endpoints are for system administration and are protected by a separate, hardcoded `RECHARGE_SECRET_TOKEN`. They should not be exposed to regular users.

### **Recharge System Credits**

*   **Endpoint:** `POST /admin/recharge`
*   **Authentication:** Requires `Authorization: Bearer <RECHARGE_SECRET_TOKEN>` header.
*   **Description:** Adds a specified number of units to the system's total available credit balance.

#### **Request Body**

| Field | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `amount` | `number` | The number of credit units to add. Must be > 0. | Yes |

**Example Request (`curl`)**
```bash
curl -X POST \
  -H "Authorization: Bearer a_different_very_long_random_secret_token" \
  -H "Content-Type: application/json" \
  http://ec2-54-87-136-3.compute-1.amazonaws.com/admin/recharge \
  -d '{
    "amount": 5000
  }'
```

#### **Success Response (`200 OK`)**

```json
{
  "message": "Credits recharged successfully.",
  "newAvailableUnits": 14850.5
}
```
