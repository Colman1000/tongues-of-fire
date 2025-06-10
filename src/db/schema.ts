import { sql, relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  real,
  index,
} from "drizzle-orm/sqlite-core";

// A single source of truth for job statuses, used for type safety.
export const jobStatuses = [
  "pending",
  "batched",
  "processing",
  "completed",
  "failed",
] as const;

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    originalPath: text("originalPath").notNull(),
    sourceSrtPath: text("sourceSrtPath").notNull(),
    status: text("status", { enum: jobStatuses }).default("pending").notNull(),
    targetLanguages: text("targetLanguages", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    completedAt: integer("completedAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .default(sql`(strftime('%s', 'now'))`)
      .$onUpdate(() => new Date()),
  },
  // Indexes for the 'jobs' table
  (table) => ({
    // Index on 'status' for the background worker and report filtering
    statusIdx: index("jobs_status_idx").on(table.status),
    // Index on 'createdAt' for default sorting in the report
    createdAtIdx: index("jobs_createdAt_idx").on(table.createdAt),
  }),
);

export const translatedFiles = sqliteTable(
  "translatedFiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: integer("jobId")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    path: text("path").notNull(),
    subtitleDurationSeconds: integer("subtitle_duration_seconds").notNull(),
    creditsUsed: real("credits_used").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  // Index for the 'translatedFiles' table
  (table) => ({
    // Index on the foreign key 'jobId' for fast lookups and joins
    jobIdIdx: index("translatedFiles_jobId_idx").on(table.jobId),
  }),
);

export const logs = sqliteTable("logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("jobId")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  message: text("message"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const systemCredits = sqliteTable("system_credits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  availableUnits: real("available_units").notNull().default(0),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .$onUpdate(() => new Date()),
});

// A single source of truth for audit log actions.
export const auditLogActions = [
  "USER_LOGIN",
  "USER_LOGIN_FAILED",
  "JOB_CREATED",
  "JOB_DELETED",
  "JOB_DOWNLOADED",
  "JOB_LANGUAGES_APPENDED",
  "JOB_FAILED",
  "CREDITS_RECHARGED",
] as const;

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actor: text("actor").notNull(),
    action: text("action", { enum: auditLogActions }).notNull(),
    details: text("details", { mode: "json" }),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  // Indexes for the 'auditLogs' table
  (table) => ({
    // Index on 'action' for filtering
    actionIdx: index("auditLogs_action_idx").on(table.action),
    // Index on 'actor' for searching
    actorIdx: index("auditLogs_actor_idx").on(table.actor),
    // Index on 'createdAt' for default sorting
    createdAtIdx: index("auditLogs_createdAt_idx").on(table.createdAt),
  }),
);

// --- Drizzle ORM Relationship Definitions ---
// These definitions enable Drizzle's relational query builder (db.query).

export const jobsRelations = relations(jobs, ({ many }) => ({
  files: many(translatedFiles),
  logs: many(logs),
}));

export const translatedFilesRelations = relations(
  translatedFiles,
  ({ one }) => ({
    job: one(jobs, {
      fields: [translatedFiles.jobId],
      references: [jobs.id],
    }),
  }),
);

export const logsRelations = relations(logs, ({ one }) => ({
  job: one(jobs, {
    fields: [logs.jobId],
    references: [jobs.id],
  }),
}));
