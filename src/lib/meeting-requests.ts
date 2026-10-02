/**
 * A company proposes one time for a call; the developer gets it by e-mail and replies straight to
 * the company. StackMatch doesn't manage the meeting, so there are no bookings or blocked slots.
 */
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
};

export type MeetingRequestInput = Omit<MeetingRequest, "id" | "sentAt">;

export const meetingTimes = ["09:00", "10:30", "14:00", "15:30", "17:00"];
export const meetingRequestStorageKey = "stackmatch-meeting-requests";

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

const requiredKeys = [
  "id",
  "developerId",
  "developerName",
  "date",
  "time",
  "company",
  "contactName",
  "email",
  "message",
  "sentAt",
] as const;

export function readMeetingRequests(): MeetingRequest[] {
  const value: unknown = JSON.parse(window.localStorage.getItem(meetingRequestStorageKey) ?? "[]");
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: Record<string, unknown> | null) => {
    if (!item || !requiredKeys.every((key) => typeof item[key] === "string")) return [];
    const request = item as Omit<MeetingRequest, "companyId"> & { companyId?: unknown };
    // Proposals sent before senders were tracked by account only know the reply e-mail.
    const companyId = typeof request.companyId === "string" ? request.companyId : request.email;
    return [{ ...request, companyId }];
  });
}
