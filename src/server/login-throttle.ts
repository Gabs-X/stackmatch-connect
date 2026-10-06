import { and, desc, eq, gt, inArray, lte } from "drizzle-orm";
import type { Db } from "./db";
import { loginFailures } from "./db/schema";

/**
 * Limits failed sign-ins in a sliding window: a few per e-mail, so one account's password can't be
 * guessed, and more per IP address, so one address can't try a common password on many accounts.
 * E-mails without an account count too, so a lock says nothing about which addresses exist.
 */
export const loginWindowMinutes = 15;
export const maxFailuresPerAccount = 5;
export const maxFailuresPerIp = 20;

const windowMs = loginWindowMinutes * 60_000;

const emailKey = (email: string) => `email:${email.trim().toLowerCase()}`;

/** The limits a sign-in counts against; without a known IP, only the e-mail's. */
const limits = (email: string, ip: string | null) => [
  { key: emailKey(email), max: maxFailuresPerAccount },
  ...(ip ? [{ key: `ip:${ip}`, max: maxFailuresPerIp }] : []),
];

/**
 * Seconds until the e-mail and IP may try again, or 0 when they may now. A limit holds while its
 * last `max` failures are all within the window, that is, until the oldest of them leaves it.
 */
export async function loginLockedFor(
  db: Db,
  email: string,
  ip: string | null,
  now = Date.now(),
): Promise<number> {
  let wait = 0;
  for (const { key, max } of limits(email, ip)) {
    const recent = await db
      .select({ createdAt: loginFailures.createdAt })
      .from(loginFailures)
      .where(and(eq(loginFailures.key, key), gt(loginFailures.createdAt, new Date(now - windowMs))))
      .orderBy(desc(loginFailures.createdAt))
      .limit(max);
    const oldest = recent.length >= max ? recent[max - 1] : undefined;
    if (oldest)
      wait = Math.max(wait, Math.ceil((oldest.createdAt.getTime() + windowMs - now) / 1000));
  }
  return wait;
}

/** Counts a wrong password against the e-mail and IP, dropping their failures that expired. */
export async function recordLoginFailure(
  db: Db,
  email: string,
  ip: string | null,
  now = Date.now(),
) {
  const keys = limits(email, ip).map((limit) => limit.key);
  await db
    .delete(loginFailures)
    .where(
      and(inArray(loginFailures.key, keys), lte(loginFailures.createdAt, new Date(now - windowMs))),
    );
  await db.insert(loginFailures).values(keys.map((key) => ({ key, createdAt: new Date(now) })));
}

/** Forgets the e-mail's failures once its owner signs in or resets the password. */
export async function clearLoginFailures(db: Db, email: string) {
  await db.delete(loginFailures).where(eq(loginFailures.key, emailKey(email)));
}
