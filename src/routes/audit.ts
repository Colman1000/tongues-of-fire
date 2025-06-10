import { Hono } from "hono";
import { db } from "@/db";
import { auditLogs, auditLogActions } from "@/db/schema";
import { asc, desc, eq, and, like, inArray, count, SQL } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  // --- 1. PARSE AND VALIDATE QUERY PARAMETERS ---
  const {
    page = "1",
    pageSize = "10",
    search = "", // Will search the 'actor' field
    sortBy = "createdAt",
    sortOrder = "desc",
    "filter[action]": filterAction,
  } = c.req.query();

  const pageNum = parseInt(page, 10) || 1;
  let pageSizeNum = parseInt(pageSize, 10) || 10;
  // Enforce a maximum page size
  if (pageSizeNum > 100) {
    pageSizeNum = 100;
  }

  // --- 2. DYNAMICALLY BUILD THE WHERE CLAUSE ---
  const conditions: (SQL | undefined)[] = [];

  // Search condition (applies to the 'actor' field)
  if (search) {
    conditions.push(like(auditLogs.actor, `%${search}%`));
  }

  // Filter condition (applies to the 'action' field)
  if (filterAction) {
    const requestedActions = filterAction.split(",").map((s) => s.trim());
    // Validate the user-provided actions against our official list
    const validActions = requestedActions.filter(
      (a): a is (typeof auditLogActions)[number] =>
        auditLogActions.includes(a as any),
    );
    if (validActions.length > 0) {
      conditions.push(inArray(auditLogs.action, validActions));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // --- 3. DYNAMICALLY BUILD THE ORDER BY CLAUSE ---
  const sortableColumns: Record<
    string,
    (typeof auditLogs)[keyof typeof auditLogs.$inferSelect]
  > = {
    actor: auditLogs.actor,
    action: auditLogs.action,
    createdAt: auditLogs.createdAt,
  };

  const sortColumn = sortableColumns[sortBy] || auditLogs.createdAt;
  const orderByClause =
    sortOrder.toLowerCase() === "asc" ? asc(sortColumn) : desc(sortColumn);

  // --- 4. EXECUTE QUERIES IN PARALLEL ---
  const dataQuery = db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(pageSizeNum)
    .offset((pageNum - 1) * pageSizeNum);

  const countQuery = db
    .select({ total: count() })
    .from(auditLogs)
    .where(whereClause);

  const [results, totalResult] = await Promise.all([dataQuery, countQuery]);

  const totalItems = totalResult[0].total;
  const totalPages = Math.ceil(totalItems / pageSizeNum);

  // --- 5. CONSTRUCT THE PAGINATED RESPONSE ---
  const response = {
    data: results,
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
