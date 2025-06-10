import { Hono } from "hono";
import { db } from "@/db";
import { jobs, translatedFiles, jobStatuses } from "@/db/schema";
import {
  asc,
  desc,
  eq,
  sql,
  and,
  like,
  inArray,
  count,
  SQL,
} from "drizzle-orm";
import type { JobReport } from "@/types";

const app = new Hono();

app.get("/", async (c) => {
  // --- 1. PARSE AND VALIDATE QUERY PARAMETERS ---
  const {
    page = "1",
    pageSize = "10",
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    "filter[status]": filterStatus,
  } = c.req.query();

  const pageNum = parseInt(page, 10) || 1;
  let pageSizeNum = parseInt(pageSize, 10) || 10;
  if (pageSizeNum > 100) {
    pageSizeNum = 100;
  }

  // --- 2. DYNAMICALLY BUILD THE WHERE CLAUSE ---
  const conditions: (SQL | undefined)[] = [];

  if (search) {
    conditions.push(like(jobs.name, `%${search}%`));
  }

  if (filterStatus) {
    const requestedStatuses = filterStatus.split(",").map((s) => s.trim());
    const validStatuses = requestedStatuses.filter(
      (s): s is (typeof jobStatuses)[number] => jobStatuses.includes(s as any),
    );
    if (validStatuses.length > 0) {
      conditions.push(inArray(jobs.status, validStatuses));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // --- 3. DYNAMICALLY BUILD THE ORDER BY CLAUSE ---
  const sortableColumns: Record<string, any> = {
    jobName: jobs.name,
    status: jobs.status,
    createdAt: jobs.createdAt,
    creditsUsed: sql`credits_used`, // Allow sorting by the calculated sum
  };

  const sortColumn = sortableColumns[sortBy] || jobs.createdAt;
  const orderByClause =
    sortOrder.toLowerCase() === "asc" ? asc(sortColumn) : desc(sortColumn);

  // --- 4. EXECUTE QUERIES IN PARALLEL ---

  // --- THE FIX IS HERE: Use a JOIN and GROUP BY for accurate credit summation ---
  const dataQuery = db
    .select({
      jobId: jobs.id,
      jobName: jobs.name,
      languages: jobs.targetLanguages,
      createdAt: jobs.createdAt,
      status: jobs.status,
      // --- THE FIX IS HERE: Use a conditional SUM ---
      // Only sum credits where the language is NOT 'en'.
      creditsUsed:
        sql<number>`SUM(CASE WHEN ${translatedFiles.language} != 'en' THEN ${translatedFiles.creditsUsed} ELSE 0 END)`.mapWith(
          Number,
        ),
    })
    .from(jobs)
    .leftJoin(translatedFiles, eq(jobs.id, translatedFiles.jobId))
    .where(whereClause)
    .groupBy(
      jobs.id,
      jobs.name,
      jobs.targetLanguages,
      jobs.createdAt,
      jobs.status,
    )
    .orderBy(orderByClause)
    .limit(pageSizeNum)
    .offset((pageNum - 1) * pageSizeNum);

  const countQuery = db
    .select({ total: count() })
    .from(jobs)
    .where(whereClause);

  const [results, totalResult] = await Promise.all([dataQuery, countQuery]);

  const totalItems = totalResult[0].total;
  const totalPages = Math.ceil(totalItems / pageSizeNum);

  // --- 5. CONSTRUCT THE PAGINATED RESPONSE ---
  const response = {
    data: results.map((job) => ({
      ...job,
      // Ensure creditsUsed is a number, defaulting to 0 if null (for jobs with no files)
      creditsUsed: job.creditsUsed || 0,
      languages: ["en", ...job.languages],
    })),
    meta: {
      totalItems,
      currentPage: pageNum,
      pageSize: pageSizeNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };

  return c.json(response);
});

export default app;
