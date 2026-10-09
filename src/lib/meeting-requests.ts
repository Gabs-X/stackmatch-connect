import { z } from "zod";
import type { JobSnapshot } from "./jobs";
import type { Translations } from "./translations";

/**
 * A company proposes one time for a call; the developer gets it by e-mail and replies straight to
 * the company. StackMatch doesn't manage the meeting, so there are no bookings or blocked slots.
 */
/**
 * Pending until the side that didn't propose the current time answers; accepting moves the
 * developer to "call scheduled" in the job. Either side can cancel or move a call that is still
 * ahead.
 */
export const meetingStatuses = ["pending", "accepted", "declined", "canceled"] as const;
export type MeetingStatus = (typeof meetingStatuses)[number];

export type MeetingSide = "company" | "developer";

/** The most times one call can be moved, so it can't become a stream of e-mails. */
export const maxReschedules = 3;

export type MeetingRequest = {
  id: string;
  developerId: string;
  developerName: string;
  /** Company account that sent it; contact details can change, this can't. */
  companyId: string;
  date: string;
  time: string;
  company: string;
  /** Person at the company who sent the proposal. */
  contactName: string;
  /** Reply-To of the e-mail the developer receives. */
  email: string;
  message: string;
  sentAt: string;
  /** The job it was about, as it was then; absent when sent outside a job. */
  job?: JobSnapshot;
  /** Of the job's title and description, when they were translated. */
  jobTranslations?: Translations;
  status: MeetingStatus;
  /** When the current time was answered, ISO date. */
  respondedAt?: string;
  /** Who proposed the current time; the other side answers it. */
  proposedBy: MeetingSide;
  reschedules: number;
  canceledBy?: MeetingSide;
  /** What came with the latest reschedule or cancellation. */
  updateMessage: string;
  /**
   * The developer's account e-mail, only in the company's own list and only for an accepted call,
   * so its calendar entry has the contact the e-mailed .ics has.
   */
  developerEmail?: string;
};

export const meetingTimes = ["09:00", "10:30", "14:00", "15:30", "17:00"];

/**
 * What a company sends. The server adds who it is from (the company and the contact in its
 * details) and the developer's name, as the e-mail will show them.
 */
export const meetingRequestInputSchema = z.object({
  developerId: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string(),
  message: z.string().trim().max(1000),
  /** The job the proposal is about, when it was sent from inside one. */
  jobId: z.string().min(1).max(200).optional(),
});

export type MeetingRequestInput = z.infer<typeof meetingRequestInputSchema>;

/** A new time for a call and what to say about it; the message also goes with a cancellation. */
export const meetingChangeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string(),
  message: z.string().trim().max(1000),
});

/** How long the proposed call is, as the dialog and the calendar entry say. */
export const meetingDurationMinutes = 30;

/** When the proposed call starts, in ms. Times are offered in Brasília time (GMT-3). */
export const meetingStart = (date: string, time: string) => Date.parse(`${date}T${time}:00-03:00`);

/** A proposal must point to the future. */
export function isProposedTimeValid(date: string, time: string, now = Date.now()) {
  const timestamp = meetingStart(date, time);
  return meetingTimes.includes(time) && Number.isFinite(timestamp) && timestamp > now;
}

/** A proposal still waiting when its time came: it can no longer be answered. */
export function isMeetingExpired(
  meeting: Pick<MeetingRequest, "date" | "time" | "status">,
  now = Date.now(),
) {
  return meeting.status === "pending" && !(meetingStart(meeting.date, meeting.time) > now);
}

/** Latest proposal this company account already made to the developer, if any. */
export function lastRequestTo(requests: MeetingRequest[], developerId: string, companyId: string) {
  return requests
    .filter((item) => item.developerId === developerId && item.companyId === companyId)
    .reduce<MeetingRequest | undefined>(
      (latest, item) => (!latest || item.sentAt > latest.sentAt ? item : latest),
      undefined,
    );
}
