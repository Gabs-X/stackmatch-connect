import { z } from "zod";
import type { JobSnapshot } from "./jobs";
import type { Translations } from "./translations";

/**
 * A company proposes one time for a call; the developer gets it by e-mail and replies straight to
 * the company. StackMatch doesn't manage the meeting, so there are no bookings or blocked slots.
 */
/** Pending until the developer answers; accepting moves them to "call scheduled" in the job. */
export const meetingStatuses = ["pending", "accepted", "declined"] as const;
export type MeetingStatus = (typeof meetingStatuses)[number];

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
  /** When the developer answered, ISO date. */
  respondedAt?: string;
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

/** Times are offered in Brasília time (GMT-3); a proposal must point to the future. */
export function isProposedTimeValid(date: string, time: string, now = Date.now()) {
  const timestamp = Date.parse(`${date}T${time}:00-03:00`);
  return meetingTimes.includes(time) && Number.isFinite(timestamp) && timestamp > now;
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
