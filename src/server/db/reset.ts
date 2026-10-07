import { eq, sql } from "drizzle-orm";
import { seedDatabase } from "../seed";
import type { Db } from ".";
import { skills } from "./schema";

/**
 * Empties what accounts created and applies the seed again, keeping the reference skill catalog
 * the migrations added. For end-to-end tests only.
 */
export async function resetDatabase(db: Db) {
  // Every account's data references users, so CASCADE empties it as well.
  await db.execute(sql`TRUNCATE users CASCADE`);
  // Sign-in failures and e-mail sends aren't tied to accounts: tests share an address and would
  // lock each other.
  await db.execute(sql`TRUNCATE login_failures, email_sends`);
  await db.delete(skills).where(eq(skills.curated, false));
  await seedDatabase(db);
}
