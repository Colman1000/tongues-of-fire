import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  originalPath: text("originalPath").notNull(),
  sourceSrtPath: text("sourceSrtPath").notNull(),
  status: text("status", {
    enum: ["pending", "batched", "processing", "completed", "failed"],
  })
    .default("pending")
    .notNull(),
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
});

export const translatedFiles = sqliteTable("translatedFiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("jobId")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  path: text("path").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const logs = sqliteTable("logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("jobId")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  creditsUsed: integer("creditsUsed"),
  message: text("message"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

// --- RELATIONSHIP DEFINITIONS ---
// This section tells Drizzle how to join the tables for relational queries.

export const jobsRelations = relations(jobs, ({ many }) => ({
  // A job can have many translated files.
  files: many(translatedFiles),
  // A job can have many log entries.
  logs: many(logs),
}));

export const translatedFilesRelations = relations(
  translatedFiles,
  ({ one }) => ({
    // A translated file belongs to one job.
    job: one(jobs, {
      fields: [translatedFiles.jobId],
      references: [jobs.id],
    }),
  }),
);

export const logsRelations = relations(logs, ({ one }) => ({
  // A log entry belongs to one job.
  job: one(jobs, {
    fields: [logs.jobId],
    references: [jobs.id],
  }),
}));
