import { sql, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

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
  subtitleDurationSeconds: integer("subtitle_duration_seconds").notNull(),
  creditsUsed: real("credits_used").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

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

// This table will hold a single row for the system's credit balance.
export const systemCredits = sqliteTable("system_credits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  availableUnits: real("available_units").notNull().default(0),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .$onUpdate(() => new Date()),
});

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
