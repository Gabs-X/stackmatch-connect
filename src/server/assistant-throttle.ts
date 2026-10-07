import { and, desc, eq, gt, lte } from "drizzle-orm";
import type { Db } from "./db";
import { assistantRequests } from "./db/schema";

/**
 * Limits the questions one IP address sends to the assistant in a sliding window. Each question
 * is a paid call to the AI provider, and the chat is open to visitors, so this keeps one address
 * from spending the quota. Without a known IP there's no limit.
 */
export const assistantWindowMinutes = 60;
export const maxAssistantRequestsPerIp = 30;

const windowMs = assistantWindowMinutes * 60_000;

/** Seconds until the IP may ask again, or 0 when it may now. */
export async function assistantLimitFor(db: Db, ip: string | null, now = Date.now()) {
  if (!ip) return 0;
  const recent = await db
    .select({ createdAt: assistantRequests.createdAt })
    .from(assistantRequests)
    .where(
      and(eq(assistantRequests.ip, ip), gt(assistantRequests.createdAt, new Date(now - windowMs))),
    )
    .orderBy(desc(assistantRequests.createdAt))
    .limit(maxAssistantRequestsPerIp);
  const oldest =
    recent.length >= maxAssistantRequestsPerIp ? recent[maxAssistantRequestsPerIp - 1] : undefined;
  return oldest ? Math.ceil((oldest.createdAt.getTime() + windowMs - now) / 1000) : 0;
}

/** Counts a question against the IP, dropping its questions that left the window. */
export async function recordAssistantRequest(db: Db, ip: string | null, now = Date.now()) {
  if (!ip) return;
  await db
    .delete(assistantRequests)
    .where(
      and(eq(assistantRequests.ip, ip), lte(assistantRequests.createdAt, new Date(now - windowMs))),
    );
  await db.insert(assistantRequests).values({ ip, createdAt: new Date(now) });
}
