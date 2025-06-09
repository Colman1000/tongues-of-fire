import { sql } from "drizzle-orm";
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
