import { sql } from "drizzle-orm";
import type { Tx } from "../profiles";

/**
 * Holds a lock per name until the transaction ends, so requests that check a limit and then count
 * against it take turns instead of all passing the check together. These are Postgres advisory
 * locks, shared by every server instance; PGlite runs one transaction at a time anyway. Names are
 * taken in a fixed order, so two transactions never wait for each other.
 */
export async function lockKeys(tx: Tx, keys: string[]) {
  for (const key of [...new Set(keys)].sort())
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}
