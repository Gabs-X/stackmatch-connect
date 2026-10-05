import { sql } from "drizzle-orm";
import { seedDatabase } from "../seed";
import type { Db } from ".";

/** Empties every table and applies the seed again. For end-to-end tests only. */
export async function resetDatabase(db: Db) {
  // Every other table references these two, so CASCADE empties them as well.
  await db.execute(sql`TRUNCATE users, skills RESTART IDENTITY CASCADE`);
  await seedDatabase(db);
}
