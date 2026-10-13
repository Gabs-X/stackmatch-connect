import { and, asc, eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";
import {
  isMeetingExpired,
  isProposedTimeValid,
  maxReschedules,
  meetingStart,
  type MeetingRequest,
  type MeetingRequestInput,
  type MeetingSide,
} from "@/lib/meeting-requests";
import type { Lang } from "@/lib/i18n";
import { jobTexts, type JobSnapshot } from "@/lib/jobs";
import type { OutreachLimitError } from "@/lib/outreach";
import { loadCompanySettings } from "./companies";
import type { Db } from "./db";
import { lockKeys } from "./db/locks";
import { developerProfiles, interests, meetingRequests, users } from "./db/schema";
import { sendEmail } from "./email";
import { advanceCandidate, jobSnapshot } from "./jobs";
import type { Tx } from "./profiles";
import {
  developerEmail,
  meetingAnswerEmail,
  meetingEmail,
  meetingUpdateEmail,
  type MeetingUpdate,
} from "./notifications";
import { meetingLimit } from "./outreach";
import { loadTranslations } from "./translations";

type MeetingRow = typeof meetingRequests.$inferSelect;

const toMeetingRequest = (row: MeetingRow): MeetingRequest => ({
  id: row.id,
  developerId: row.developerId,
  developerName: row.developerName,
  companyId: row.companyId,
  date: row.date,
  time: row.time,
  company: row.companyName,
  contactName: row.contactName,
  email: row.replyToEmail,
  message: row.message,
  sentAt: row.sentAt.toISOString(),
  ...(row.job ? { job: row.job } : {}),
  status: row.status,
  ...(row.respondedAt ? { respondedAt: row.respondedAt.toISOString() } : {}),
  proposedBy: row.proposedBy,
  reschedules: row.reschedules,
  ...(row.canceledBy ? { canceledBy: row.canceledBy } : {}),
  updateMessage: row.updateMessage,
});

/** Name of a profile companies can find, or null when there is no such profile. */
async function developerName(db: Db, developerId: string) {
  const [row] = await db
    .select({ name: developerProfiles.name })
    .from(developerProfiles)
    .where(eq(developerProfiles.userId, developerId))
    .limit(1);
  return row?.name ?? null;
}

export type SendResult =
  | { request: MeetingRequest }
  | { error: "time-passed" | "unknown-developer" | "not-sent" }
  | OutreachLimitError;

/**
 * Records the proposal, signed with the company's current contact, and e-mails it to the developer
 * with Reply-To set to that contact. If the e-mail can't be sent, the proposal is dropped, so the
 * company never counts on one the developer didn't get. Sent from inside a job, it moves the developer
 * there to "contacted".
 */
export async function sendMeetingRequest(
  db: Db,
  company: AuthUser,
  input: MeetingRequestInput,
  now = Date.now(),
  language: Lang = "pt",
): Promise<SendResult> {
  if (!isProposedTimeValid(input.date, input.time, now)) return { error: "time-passed" };
  const name = await developerName(db, input.developerId);
  if (name === null) return { error: "unknown-developer" };
  const contact = await loadCompanySettings(db, company);
  // A job that isn't the company's is ignored, not an error: the proposal goes out without it.
  const job = input.jobId ? await jobSnapshot(db, company.id, input.jobId) : null;
  // Checking the limits and recording the proposal are one step under the company's lock, so
  // proposals sent at once can't all take the last one the limits allow.
  const saved = await db.transaction(async (tx) => {
    await lockKeys(tx, [`meeting-requests:${company.id}`]);
    const limit = await meetingLimit(tx, company.id, input.developerId, now);
    if (limit) return limit;
    const [row] = await tx
      .insert(meetingRequests)
      .values({
        jobId: job ? (input.jobId ?? null) : null,
        job: job?.snapshot ?? null,
        language,
        companyId: company.id,
        developerId: input.developerId,
        developerName: name,
        date: input.date,
        time: input.time,
        message: input.message,
        companyName: company.company,
        contactName: contact.contactName,
        replyToEmail: contact.contactEmail,
        sentAt: new Date(now),
      })
      .returning();
    if (!row) throw new Error("Meeting request not saved.");
    return { row };
  });
  if (!("row" in saved)) return saved;
  const { row } = saved;
  const request = toMeetingRequest(row);
  try {
    await sendEmail(
      meetingEmail(
        request,
        await developerEmail(db, input.developerId),
        language,
        job?.translations,
      ),
    );
  } catch (error) {
    console.error("Meeting request not e-mailed:", error);
    await db.delete(meetingRequests).where(eq(meetingRequests.id, row.id));
    return { error: "not-sent" };
  }
  if (job && input.jobId)
    await advanceCandidate(db, company.id, input.jobId, input.developerId, "contacted", now);
  return { request };
}

/**
 * Proposals the company sent, oldest first, with their jobs' texts translated. Accepted calls
 * carry the developer's account e-mail, which the acceptance e-mail already gave the company, for
 * the calendar entry; other proposals don't.
 */
export async function listSentBy(db: Db, companyId: string) {
  const rows = await db
    .select({ meeting: meetingRequests, developerEmail: users.email })
    .from(meetingRequests)
    .leftJoin(users, eq(users.id, meetingRequests.developerId))
    .where(eq(meetingRequests.companyId, companyId))
    .orderBy(asc(meetingRequests.sentAt));
  return withJobTranslations(
    db,
    rows.map(({ meeting, developerEmail }) => ({
      ...toMeetingRequest(meeting),
      ...(meeting.status === "accepted" && developerEmail ? { developerEmail } : {}),
    })),
  );
}

/** Proposals the developer received, oldest first, with their jobs' texts translated. */
export async function listReceivedBy(db: Db, developerId: string) {
  const rows = await db
    .select()
    .from(meetingRequests)
    .where(eq(meetingRequests.developerId, developerId))
    .orderBy(asc(meetingRequests.sentAt));
  return withJobTranslations(db, rows.map(toMeetingRequest));
}

/** Whether the company marked interest in the developer or sent them a proposal. */
export async function companyReachedDeveloper(db: Db | Tx, companyId: string, developerId: string) {
  const [interest] = await db
    .select({ id: interests.id })
    .from(interests)
    .where(and(eq(interests.companyId, companyId), eq(interests.developerId, developerId)))
    .limit(1);
  if (interest) return true;
  const [meeting] = await db
    .select({ id: meetingRequests.id })
    .from(meetingRequests)
    .where(
      and(eq(meetingRequests.companyId, companyId), eq(meetingRequests.developerId, developerId)),
    )
    .limit(1);
  return meeting !== undefined;
}

/** Adds to each item with a job the translations of the job's texts, by the company that sent it. */
export async function withJobTranslations<T extends { companyId: string; job?: JobSnapshot }>(
  db: Db,
  items: T[],
): Promise<T[]> {
  const sent = items.flatMap((item) => (item.job ? [item.job] : []));
  if (!sent.length) return items;
  const translations = await loadTranslations(
    db,
    [...new Set(items.map((item) => item.companyId))],
    sent.flatMap(jobTexts),
  );
  return items.map((item) => {
    if (!item.job) return item;
    const own = Object.fromEntries(
      jobTexts(item.job).flatMap((text) => {
        const translated = translations[text.trim()];
        return translated ? [[text, translated]] : [];
      }),
    );
    return Object.keys(own).length ? { ...item, jobTranslations: own } : item;
  });
}

/** The account acting on a call, and which side of it that account is. */
export type MeetingActor = { side: MeetingSide; accountId: string };

/** The call, if it involves the account on that side. */
async function ownMeeting(db: Db, actor: MeetingActor, meetingId: string) {
  const [row] = await db
    .select()
    .from(meetingRequests)
    .where(
      and(
        eq(meetingRequests.id, meetingId),
        eq(
          actor.side === "company" ? meetingRequests.companyId : meetingRequests.developerId,
          actor.accountId,
        ),
      ),
    )
    .limit(1);
  return row;
}

const hasStarted = (row: MeetingRow, now: number) => meetingStart(row.date, row.time) <= now;

/** E-mails the other side; a failure is logged, and what was done stands. */
async function tellOtherSide(
  db: Db,
  row: MeetingRow,
  update: MeetingUpdate,
  actor: MeetingSide,
  appUrl: string,
) {
  try {
    await sendEmail(
      meetingUpdateEmail(
        toMeetingRequest(row),
        update,
        actor,
        await developerEmail(db, row.developerId),
        row.language,
        appUrl,
      ),
    );
  } catch (error) {
    console.error(`Meeting ${update.kind} not e-mailed:`, error);
  }
}

export type AnswerResult =
  | { request: MeetingRequest }
  | { error: "unknown-meeting" | "already-answered" | "expired" | "own-proposal" };

/**
 * Accepts or declines the current time of a call, once: the side that didn't propose it answers.
 * The other side hears back by e-mail, in the language the proposal went out in, with Reply-To set
 * to whoever answered; an accepted time comes with a calendar file. Accepting a call about a job
 * moves the developer to "call scheduled" there. Once the time comes, a call still waiting can't be
 * answered. A failed e-mail doesn't undo the answer.
 */
export async function answerMeetingRequest(
  db: Db,
  actor: MeetingActor,
  meetingId: string,
  answer: "accepted" | "declined",
  now = Date.now(),
  appUrl = "",
): Promise<AnswerResult> {
  const current = await ownMeeting(db, actor, meetingId);
  if (!current) return { error: "unknown-meeting" };
  if (current.status !== "pending") return { error: "already-answered" };
  if (current.proposedBy === actor.side) return { error: "own-proposal" };
  if (isMeetingExpired(current, now)) return { error: "expired" };
  const [row] = await db
    .update(meetingRequests)
    .set({ status: answer, respondedAt: new Date(now) })
    .where(
      and(
        eq(meetingRequests.id, meetingId),
        eq(meetingRequests.status, "pending"),
        // Moved meanwhile: this answer was about another time.
        eq(meetingRequests.reschedules, current.reschedules),
      ),
    )
    .returning();
  if (!row) return { error: "already-answered" };
  const request = toMeetingRequest(row);
  if (answer === "accepted" && row.jobId)
    await advanceCandidate(db, row.companyId, row.jobId, row.developerId, "meeting", now);
  if (actor.side === "company") await tellOtherSide(db, row, { kind: answer }, "company", appUrl);
  else
    try {
      await sendEmail(
        meetingAnswerEmail(request, await developerEmail(db, row.developerId), row.language),
      );
    } catch (error) {
      console.error("Meeting answer not e-mailed:", error);
    }
  return { request };
}

export type ChangeResult =
  | { request: MeetingRequest }
  | {
      error:
        | "unknown-meeting"
        | "closed"
        | "started"
        | "time-passed"
        | "same-time"
        | "reschedule-limit"
        | "changed";
    };

/**
 * Moves the call to another time, which the other side then accepts or declines: a waiting,
 * accepted or declined call, up to maxReschedules times, and an accepted one only before it starts.
 * The other side gets an e-mail with both times and the message. The job stage stays.
 */
export async function rescheduleMeeting(
  db: Db,
  actor: MeetingActor,
  meetingId: string,
  { date, time, message }: { date: string; time: string; message: string },
  now = Date.now(),
  appUrl = "",
): Promise<ChangeResult> {
  const current = await ownMeeting(db, actor, meetingId);
  if (!current) return { error: "unknown-meeting" };
  if (current.status === "canceled") return { error: "closed" };
  if (current.status === "accepted" && hasStarted(current, now)) return { error: "started" };
  if (!isProposedTimeValid(date, time, now)) return { error: "time-passed" };
  if (current.date === date && current.time === time && current.status !== "declined")
    return { error: "same-time" };
  if (current.reschedules >= maxReschedules) return { error: "reschedule-limit" };
  const [row] = await db
    .update(meetingRequests)
    .set({
      date,
      time,
      status: "pending",
      respondedAt: null,
      proposedBy: actor.side,
      reschedules: current.reschedules + 1,
      updateMessage: message,
    })
    .where(
      and(
        eq(meetingRequests.id, meetingId),
        eq(meetingRequests.reschedules, current.reschedules),
        eq(meetingRequests.status, current.status),
      ),
    )
    .returning();
  if (!row) return { error: "changed" };
  await tellOtherSide(
    db,
    row,
    { kind: "rescheduled", from: { date: current.date, time: current.time } },
    actor.side,
    appUrl,
  );
  return { request: toMeetingRequest(row) };
}

/**
 * Cancels a call that is waiting or accepted, before it starts, and e-mails the other side with the
 * message. The job stage stays; the company can change it on the job page.
 */
export async function cancelMeeting(
  db: Db,
  actor: MeetingActor,
  meetingId: string,
  message: string,
  now = Date.now(),
  appUrl = "",
): Promise<ChangeResult> {
  const current = await ownMeeting(db, actor, meetingId);
  if (!current) return { error: "unknown-meeting" };
  if (current.status !== "pending" && current.status !== "accepted") return { error: "closed" };
  if (hasStarted(current, now)) return { error: "started" };
  const [row] = await db
    .update(meetingRequests)
    .set({
      status: "canceled",
      canceledBy: actor.side,
      canceledAt: new Date(now),
      updateMessage: message,
    })
    .where(
      and(
        eq(meetingRequests.id, meetingId),
        eq(meetingRequests.reschedules, current.reschedules),
        eq(meetingRequests.status, current.status),
      ),
    )
    .returning();
  if (!row) return { error: "changed" };
  await tellOtherSide(db, row, { kind: "canceled" }, actor.side, appUrl);
  return { request: toMeetingRequest(row) };
}
