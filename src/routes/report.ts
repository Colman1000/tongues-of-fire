import { Hono } from "hono";
import { db } from "@/db";
import { jobs, translatedFiles } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import type { JobReport } from "@/types";

const app = new Hono();

app.get("/", async (c) => {
  const results = await db
    .select({
      jobId: jobs.id,
      jobName: jobs.name,
      languages: jobs.targetLanguages,
      createdAt: jobs.createdAt,
      status: jobs.status,
      creditsUsed: sql<number>`(SELECT SUM(${translatedFiles.creditsUsed}) FROM ${translatedFiles} WHERE ${translatedFiles.jobId} = ${jobs.id})`,
    })
    .from(jobs)
    .orderBy(desc(jobs.createdAt));

  const response: { jobs: JobReport[] } = {
    jobs: results.map((job) => ({
      ...job,
      // Add 'en' to the list of languages for the report
      languages: ["en", ...job.languages],
    })),
  };

  return c.json(response);
});

export default app;
