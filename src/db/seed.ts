import { db } from "./index";
import { systemCredits } from "./schema";

async function seed() {
  console.log("Seeding initial system credits...");
  // Set an initial credit balance, e.g., 10000 units.
  await db.insert(systemCredits).values({ id: 1, availableUnits: 10000 });
  console.log("Seeding complete.");
}

seed();
