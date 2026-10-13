import { and, desc, eq, gt, lte } from "drizzle-orm";
import type { Db } from "./db";
import { lockKeys } from "./db/locks";
import { emailSends } from "./db/schema";
import type { Tx } from "./profiles";

/**
 * Limits the e-mails with a code (confirmation, password reset, e-mail change) one IP address
 * causes in a sliding window, whatever accounts they go to. Each account already waits a minute
 * between codes; this keeps one address from creating accounts or asking for resets in bulk, which
 * would spend the sending quota and the domain's reputation. Without a known IP there's no limit.
 */
export const emailWindowMinutes = 60;
export const maxEmailsPerIp = 20;

const windowMs = emailWindowMinutes * 60_000;

/** Seconds until the IP may cause another e-mail, or 0 when it may now. */
export async function emailLimitFor(db: Db | Tx, ip: string | null, now = Date.now()) {
  if (!ip) return 0;
  const recent = await db
    .select({ createdAt: emailSends.createdAt })
    .from(emailSends)
    .where(and(eq(emailSends.ip, ip), gt(emailSends.createdAt, new Date(now - windowMs))))
    .orderBy(desc(emailSends.createdAt))
    .limit(maxEmailsPerIp);
  const oldest = recent.length >= maxEmailsPerIp ? recent[maxEmailsPerIp - 1] : undefined;
  return oldest ? Math.ceil((oldest.createdAt.getTime() + windowMs - now) / 1000) : 0;
}

/** Counts an e-mail against the IP, dropping its sends that left the window. */
export async function recordEmailSend(db: Db | Tx, ip: string | null, now = Date.now()) {
  if (!ip) return null;
  await db
    .delete(emailSends)
    .where(and(eq(emailSends.ip, ip), lte(emailSends.createdAt, new Date(now - windowMs))));
  const [row] = await db
    .insert(emailSends)
    .values({ ip, createdAt: new Date(now) })
    .returning({ id: emailSends.id });
  return row?.id ?? null;
}

/** One of the IP's e-mails, taken before sending; null when the IP is unknown and has no limit. */
export type EmailReservation = { reserved: number | null } | { retryInSeconds: number };

/**
 * Takes one of the IP's e-mails, or says how long to wait. Checking and counting are one step
 * under a lock, so concurrent requests can't all take the last e-mail the window allows.
 */
export async function reserveEmailSend(
  db: Db,
  ip: string | null,
  now = Date.now(),
): Promise<EmailReservation> {
  if (!ip) return { reserved: null };
  return db.transaction(async (tx) => {
    await lockKeys(tx, [`email-sends:${ip}`]);
    const retryInSeconds = await emailLimitFor(tx, ip, now);
    if (retryInSeconds) return { retryInSeconds };
    return { reserved: await recordEmailSend(tx, ip, now) };
  });
}

/** Gives back an e-mail reserved and then not sent. */
export async function releaseEmailSend(db: Db, reserved: number | null) {
  if (reserved !== null) await db.delete(emailSends).where(eq(emailSends.id, reserved));
}
