import { and, desc, eq, gt, lte } from "drizzle-orm";
import type { Db } from "./db";
import { emailSends } from "./db/schema";

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
export async function emailLimitFor(db: Db, ip: string | null, now = Date.now()) {
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
export async function recordEmailSend(db: Db, ip: string | null, now = Date.now()) {
  if (!ip) return;
  await db
    .delete(emailSends)
    .where(and(eq(emailSends.ip, ip), lte(emailSends.createdAt, new Date(now - windowMs))));
  await db.insert(emailSends).values({ ip, createdAt: new Date(now) });
}
