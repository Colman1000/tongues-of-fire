import { Hono } from "hono";
import { db } from "@/db";
import { jobs, translatedFiles, jobStatuses } from "@/db/schema"; // 1. Import jobStatuses
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

  // --- THE FIX IS HERE ---
  // Filter condition (applies to job status)
  if (filterStatus) {
    const requestedStatuses = filterStatus.split(",").map((s) => s.trim());
    // 2. Validate the user-provided statuses against our official list
    const validStatuses = requestedStatuses.filter(
      (s): s is (typeof jobStatuses)[number] => jobStatuses.includes(s as any),
    );
    // 3. Only add the condition if there are valid statuses to filter by
    if (validStatuses.length > 0) {
      conditions.push(inArray(jobs.status, validStatuses));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // --- 3. DYNAMICALLY BUILD THE ORDER BY CLAUSE ---
  const sortableColumns: Record<
    string,
    (typeof jobs)[keyof typeof jobs.$inferSelect]
  > = {
    jobName: jobs.name,
    status: jobs.status,
    createdAt: jobs.createdAt,
  };

  const sortColumn = sortableColumns[sortBy] || jobs.createdAt;
  const orderByClause =
    sortOrder.toLowerCase() === "asc" ? asc(sortColumn) : desc(sortColumn);

  // --- 4. EXECUTE QUERIES IN PARALLEL ---
  const dataQuery = db
    .select({
      jobId: jobs.id,
      jobName: jobs.name,
      languages: jobs.targetLanguages,
      createdAt: jobs.createdAt,
      status: jobs.status,
      creditsUsed: sql<number>`(SELECT SUM(${translatedFiles.creditsUsed}) FROM ${translatedFiles} WHERE ${translatedFiles.jobId} = ${jobs.id})`,
    })
    .from(jobs)
    .where(whereClause)
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
