import { sql } from "drizzle-orm";
import { ensureDemoAccounts } from "../auth";
import { ensureDemoProfile } from "../profiles";
import type { Db } from ".";

/** Empties every table and puts the demo data back. For end-to-end tests only. */
export async function resetDatabase(db: Db) {
  // Every other table references these two, so CASCADE empties them as well.
  await db.execute(sql`TRUNCATE users, skills RESTART IDENTITY CASCADE`);
  await ensureDemoAccounts(db);
  await ensureDemoProfile(db);
}
