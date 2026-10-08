import { and, asc, eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";
import {
  isProposedTimeValid,
  type MeetingRequest,
  type MeetingRequestInput,
} from "@/lib/meeting-requests";
import type { Lang } from "@/lib/i18n";
import { jobTexts, type JobSnapshot } from "@/lib/jobs";
import type { OutreachLimitError } from "@/lib/outreach";
import { loadCompanySettings } from "./companies";
import type { Db } from "./db";
import { developerProfiles, interests, meetingRequests } from "./db/schema";
import { sendEmail } from "./email";
import { advanceCandidate, jobSnapshot } from "./jobs";
import { developerEmail, meetingAnswerEmail, meetingEmail } from "./notifications";
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
  const limit = await meetingLimit(db, company.id, input.developerId, now);
  if (limit) return limit;
  const contact = await loadCompanySettings(db, company);
  // A job that isn't the company's is ignored, not an error: the proposal goes out without it.
  const job = input.jobId ? await jobSnapshot(db, company.id, input.jobId) : null;
  const [row] = await db
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

/** Proposals the company sent, oldest first. */
export async function listSentBy(db: Db, companyId: string) {
  const rows = await db
    .select()
    .from(meetingRequests)
    .where(eq(meetingRequests.companyId, companyId))
    .orderBy(asc(meetingRequests.sentAt));
  return rows.map(toMeetingRequest);
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
export async function companyReachedDeveloper(db: Db, companyId: string, developerId: string) {
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

export type AnswerResult =
  { request: MeetingRequest } | { error: "unknown-meeting" | "already-answered" };

/**
 * The developer accepts or declines a proposal they received; it can be answered once. The company
 * hears back by e-mail, in the language the proposal went out in, with Reply-To set to the
 * developer. Accepting a proposal sent from a job moves the developer to "call scheduled" there.
 * A failed e-mail doesn't undo the answer.
 */
export async function answerMeetingRequest(
  db: Db,
  developerId: string,
  meetingId: string,
  answer: "accepted" | "declined",
  now = Date.now(),
): Promise<AnswerResult> {
  const [current] = await db
    .select()
    .from(meetingRequests)
    .where(and(eq(meetingRequests.id, meetingId), eq(meetingRequests.developerId, developerId)))
    .limit(1);
  if (!current) return { error: "unknown-meeting" };
  const [row] = await db
    .update(meetingRequests)
    .set({ status: answer, respondedAt: new Date(now) })
    .where(and(eq(meetingRequests.id, meetingId), eq(meetingRequests.status, "pending")))
    .returning();
  if (!row) return { error: "already-answered" };
  const request = toMeetingRequest(row);
  if (answer === "accepted" && row.jobId)
    await advanceCandidate(db, row.companyId, row.jobId, developerId, "meeting", now);
  try {
    await sendEmail(
      meetingAnswerEmail(request, await developerEmail(db, developerId), row.language),
    );
  } catch (error) {
    console.error("Meeting answer not e-mailed:", error);
  }
  return { request };
}
