import { Hono } from "hono";
import { db } from "@/db";
import { jobs, systemCredits } from "@/db/schema";
import { eq, count } from "drizzle-orm";

const app = new Hono();

// Endpoint to get the remaining credits
app.get("/credits/remaining", async (c) => {
  const [creditsRecord] = await db.select().from(systemCredits).limit(1);
  const availableUnits = creditsRecord?.availableUnits ?? 0;
  return c.json({ availableUnits });
});

// Endpoint for the main dashboard summary
app.get("/summary", async (c) => {
  // Run all summary queries in parallel for performance
  const [
    creditsRecord,
    totalJobsResult,
    processingJobsResult,
    completedJobsResult,
  ] = await Promise.all([
    db
      .select({ availableUnits: systemCredits.availableUnits })
      .from(systemCredits)
      .limit(1),
    db.select({ value: count() }).from(jobs),
    db
      .select({ value: count() })
      .from(jobs)
      .where(eq(jobs.status, "processing")),
    db
      .select({ value: count() })
      .from(jobs)
      .where(eq(jobs.status, "completed")),
  ]);

  const summary = {
    availableUnits: creditsRecord[0]?.availableUnits ?? 0,
    totalJobs: totalJobsResult[0].value,
    processingJobs: processingJobsResult[0].value,
    completedJobs: completedJobsResult[0].value,
  };

  return c.json(summary);
});

export default app;
