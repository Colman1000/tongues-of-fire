import { defineConfig } from "drizzle-kit";

// Ensure the environment variable is loaded and available.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required.");
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    // THE FIX:
    // Drizzle Kit's Node.js driver (better-sqlite3) doesn't understand the
    // "file:" protocol, but Bun's native driver does. We strip it here
    // specifically for the Kit CLI tool.
    url: process.env.DATABASE_URL.replace("file:", ""),
  },
  verbose: true,
  strict: true,
});
