import { and, count, eq, gt, lte } from "drizzle-orm";
import type { Db } from "./db";
import { translationRequests } from "./db/schema";

/**
 * Limits the translation requests one account causes in a sliding window. Each save with new text
 * spends the translator's quota (DeepL's monthly characters, or Claude credits as backup), so
 * saving in a loop with a different bio each time would use it up for everyone. Past the limit
 * the profile still saves; its new texts just show as written until the window frees up.
 */
export const translationWindowHours = 24;
export const maxTranslationsPerAccount = 20;

const windowMs = translationWindowHours * 3_600_000;

/** Whether the account may cause another translation now. */
export async function canTranslate(db: Db, ownerId: string, now = Date.now()) {
  const [row] = await db
    .select({ total: count() })
    .from(translationRequests)
    .where(
      and(
        eq(translationRequests.ownerId, ownerId),
        gt(translationRequests.createdAt, new Date(now - windowMs)),
      ),
    );
  return (row?.total ?? 0) < maxTranslationsPerAccount;
}

/** Counts a translation against the account, dropping its requests that left the window. */
export async function recordTranslationRequest(db: Db, ownerId: string, now = Date.now()) {
  await db
    .delete(translationRequests)
    .where(
      and(
        eq(translationRequests.ownerId, ownerId),
        lte(translationRequests.createdAt, new Date(now - windowMs)),
      ),
    );
  await db.insert(translationRequests).values({ ownerId, createdAt: new Date(now) });
}
