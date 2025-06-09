export interface SignedUrlResponse {
  fileName: string;
  uploadUrl: string;
  path: string;
  error?: string;
}

export interface JobReport {
  jobId: number;
  jobName: string;
  languages: string[];
  createdAt: Date | null;
  status: string;
  creditsUsed: number | null;
}
