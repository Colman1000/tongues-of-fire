import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./index";

console.log("Running database migrations...");

// This command will read the migration files from the 'out' folder
// specified in your drizzle.config.ts and apply them to the database.
migrate(db, { migrationsFolder: "./src/db/migrations" });

console.log("Migrations applied successfully.");
