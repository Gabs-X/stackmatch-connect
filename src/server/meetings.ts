import { and, asc, eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";
import {
  isProposedTimeValid,
  type MeetingRequest,
  type MeetingRequestInput,
} from "@/lib/meeting-requests";
import type { Lang } from "@/lib/i18n";
import { loadCompanySettings } from "./companies";
import type { Db } from "./db";
import { developerProfiles, interests, meetingRequests } from "./db/schema";
import { sendEmail } from "./email";
import { developerEmail, meetingEmail } from "./notifications";

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
  { request: MeetingRequest } | { error: "time-passed" | "unknown-developer" | "not-sent" };

/**
 * Records the proposal, signed with the company's current contact, and e-mails it to the developer
 * with Reply-To set to that contact. If the e-mail can't be sent, the proposal is dropped, so the
 * company never counts on one the developer didn't get.
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
  const [row] = await db
    .insert(meetingRequests)
    .values({
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
    await sendEmail(meetingEmail(request, await developerEmail(db, input.developerId), language));
  } catch (error) {
    console.error("Meeting request not e-mailed:", error);
    await db.delete(meetingRequests).where(eq(meetingRequests.id, row.id));
    return { error: "not-sent" };
  }
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

/** Proposals the developer received, oldest first. */
export async function listReceivedBy(db: Db, developerId: string) {
  const rows = await db
    .select()
    .from(meetingRequests)
    .where(eq(meetingRequests.developerId, developerId))
    .orderBy(asc(meetingRequests.sentAt));
  return rows.map(toMeetingRequest);
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
