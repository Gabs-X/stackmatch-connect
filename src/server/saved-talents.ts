import { and, asc, eq } from "drizzle-orm";
import type { Db } from "./db";
import { developerProfiles, savedTalents } from "./db/schema";

/** The company's shortlist: developer ids, in the order they were saved. */
export async function listSavedTalents(db: Db, companyId: string): Promise<string[]> {
  const rows = await db
    .select({ developerId: savedTalents.developerId })
    .from(savedTalents)
    .where(eq(savedTalents.companyId, companyId))
    .orderBy(asc(savedTalents.createdAt), asc(savedTalents.developerId));
  return rows.map((row) => row.developerId);
}

/** A profile companies can find: a developer account that published its profile. */
export async function developerExists(db: Db, developerId: string) {
  const [row] = await db
    .select({ userId: developerProfiles.userId })
    .from(developerProfiles)
    .where(eq(developerProfiles.userId, developerId))
    .limit(1);
  return row !== undefined;
}

/** Saving twice keeps the first save. False when there is no such profile. */
export async function saveTalent(db: Db, companyId: string, developerId: string) {
  if (!(await developerExists(db, developerId))) return false;
  await db.insert(savedTalents).values({ companyId, developerId }).onConflictDoNothing();
  return true;
}

export async function removeSavedTalent(db: Db, companyId: string, developerId: string) {
  await db
    .delete(savedTalents)
    .where(and(eq(savedTalents.companyId, companyId), eq(savedTalents.developerId, developerId)));
}
