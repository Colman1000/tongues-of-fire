import { eq } from "drizzle-orm";
import { db } from "./index";
import { systemCredits } from "./schema";

async function seed() {
  console.log("Seeding initial system credits...");

  // Check if the record with id = 1 already exists
  const existing = await db
      .select()
      .from(systemCredits)
      .where(eq(systemCredits.id, 1));

  if (existing.length > 0) {
    console.log("Initial system credit already exists. Skipping seeding.");
    return;
  }

  // Insert initial credit balance if not exists
  await db.insert(systemCredits).values({ id: 1, availableUnits: 0 });

  console.log("Seeding complete.");
}

seed();
