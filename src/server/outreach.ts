import { and, desc, eq, gt } from "drizzle-orm";
import { outreachLimits, type OutreachLimitError } from "@/lib/outreach";
import type { Db } from "./db";
import { interestEvents, interests, meetingRequests } from "./db/schema";
import { markInterest, setInterestJob } from "./interests";
import { advanceCandidate, jobSnapshot } from "./jobs";
import { interestNotice } from "./notifications";
import { deliverQueued, notify } from "./outbox";
import type { Tx } from "./profiles";

const hourMs = 60 * 60_000;
const dayMs = 24 * hourMs;

/**
 * Seconds until a limit of `max` in `windowMs` allows another action, given the latest actions'
 * times (newest first, at least the last `max`); 0 when it allows one now.
 */
function waitForSlot(times: Date[], max: number, windowMs: number, now: number) {
  const oldest = times.length >= max ? times[max - 1] : undefined;
  if (!oldest || oldest.getTime() + windowMs <= now) return 0;
  return Math.ceil((oldest.getTime() + windowMs - now) / 1000);
}

/** Seconds until the company may mark interest again; 0 when it may now. */
export async function interestLimitWait(db: Db, companyId: string, now = Date.now()) {
  const max = outreachLimits.interestsPerDay;
  const recent = await db
    .select({ createdAt: interestEvents.createdAt })
    .from(interestEvents)
    .where(
      and(
        eq(interestEvents.companyId, companyId),
        gt(interestEvents.createdAt, new Date(now - dayMs)),
      ),
    )
    .orderBy(desc(interestEvents.createdAt))
    .limit(max);
  return waitForSlot(
    recent.map((row) => row.createdAt),
    max,
    dayMs,
    now,
  );
}

/** The limit a new meeting proposal would break, or null when it can be sent. */
export async function meetingLimit(
  db: Db | Tx,
  companyId: string,
  developerId: string,
  now = Date.now(),
): Promise<OutreachLimitError | null> {
  const daily = await db
    .select({ sentAt: meetingRequests.sentAt })
    .from(meetingRequests)
    .where(
      and(
        eq(meetingRequests.companyId, companyId),
        gt(meetingRequests.sentAt, new Date(now - dayMs)),
      ),
    )
    .orderBy(desc(meetingRequests.sentAt))
    .limit(outreachLimits.meetingsPerDay);
  const dailyWait = waitForSlot(
    daily.map((row) => row.sentAt),
    outreachLimits.meetingsPerDay,
    dayMs,
    now,
  );
  if (dailyWait) return { error: "meeting-limit", retryInSeconds: dailyWait };

  const perDeveloperMs = outreachLimits.meetingsPerDeveloperDays * dayMs;
  const toDeveloper = await db
    .select({ sentAt: meetingRequests.sentAt })
    .from(meetingRequests)
    .where(
      and(
        eq(meetingRequests.companyId, companyId),
        eq(meetingRequests.developerId, developerId),
        gt(meetingRequests.sentAt, new Date(now - perDeveloperMs)),
      ),
    )
    .orderBy(desc(meetingRequests.sentAt))
    .limit(outreachLimits.meetingsPerDeveloper);
  const developerWait = waitForSlot(
    toDeveloper.map((row) => row.sentAt),
    outreachLimits.meetingsPerDeveloper,
    perDeveloperMs,
    now,
  );
  return developerWait ? { error: "developer-meeting-limit", retryInSeconds: developerWait } : null;
}

/** Whether the company e-mailed the developer about interest lately. */
async function notifiedLately(db: Db, companyId: string, developerId: string, now: number) {
  const [event] = await db
    .select({ id: interestEvents.id })
    .from(interestEvents)
    .where(
      and(
        eq(interestEvents.companyId, companyId),
        eq(interestEvents.developerId, developerId),
        eq(interestEvents.notified, true),
        gt(interestEvents.createdAt, new Date(now - outreachLimits.interestEmailEveryDays * dayMs)),
      ),
    )
    .limit(1);
  return event !== undefined;
}

export type MarkResult = { ok: true } | { error: "unknown-developer" } | OutreachLimitError;

/**
 * Marks the company's interest in a developer, within the daily limit, and notifies the developer
 * unless this company already did lately (marking, undoing and marking again doesn't notify twice).
 * Marking a profile it already marked changes nothing. The e-mail goes out in the developer's
 * language, and a failed one stays queued (see src/server/outbox.ts).
 * From one of the company's jobs, the mark points to the job, the e-mail tells what it is about and
 * the developer moves to "interest" in it; a job that isn't the company's is ignored.
 */
export async function markInterestAndNotify(
  db: Db,
  companyId: string,
  developerId: string,
  appUrl: string,
  now = Date.now(),
  jobId?: string,
): Promise<MarkResult> {
  const job = jobId ? await jobSnapshot(db, companyId, jobId) : null;
  const jobRef = job && jobId ? { id: jobId, snapshot: job.snapshot } : null;
  const joinJob = () =>
    jobRef ? advanceCandidate(db, companyId, jobRef.id, developerId, "interest", now) : null;
  const [existing] = await db
    .select({ id: interests.id })
    .from(interests)
    .where(and(eq(interests.companyId, companyId), eq(interests.developerId, developerId)))
    .limit(1);
  if (existing) {
    if (jobRef) {
      await setInterestJob(db, companyId, developerId, jobRef);
      await joinJob();
    }
    return { ok: true };
  }

  const wait = await interestLimitWait(db, companyId, now);
  if (wait) return { error: "interest-limit", retryInSeconds: wait };

  const result = await markInterest(db, companyId, developerId, jobRef);
  if (result === "unknown") return { error: "unknown-developer" };
  await joinJob();
  if (result === "existing") return { ok: true };

  const notified = !(await notifiedLately(db, companyId, developerId, now));
  const queued = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(interestEvents)
      .values({ companyId, developerId, notified, createdAt: new Date(now) })
      .returning({ id: interestEvents.id });
    return notified && event
      ? notify(
          tx,
          await interestNotice(tx, companyId, developerId, appUrl, job, `interest:${event.id}`),
        )
      : null;
  });
  await deliverQueued(db, [queued]);
  return { ok: true };
}
