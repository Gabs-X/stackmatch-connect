import type { MeetingRequest } from "./meeting-requests";

/** A company account marked a developer as interesting in Discover. */
export type ProfileInterest = {
  id: string;
  developerId: string;
  /** Company account that marked it; contact details can change, this can't. */
  companyId: string;
  company: string;
  contactName: string;
  /** Company contact's e-mail; the developer replies to it. */
  email: string;
  at: string;
};

export type ProfileInterestInput = Omit<ProfileInterest, "id" | "at">;

/**
 * One company that showed interest, with its latest meeting proposal when it sent one. Contact
 * details come from the most recent interaction, so they follow what the company edited.
 */
export type InterestedCompany = {
  companyId: string;
  email: string;
  company: string;
  contactName: string;
  /** Most recent interaction, ISO date. */
  at: string;
  meeting?: MeetingRequest;
};

export const profileInterestStorageKey = "stackmatch-profile-interests";

export function readProfileInterests(): ProfileInterest[] {
  const value: unknown = JSON.parse(window.localStorage.getItem(profileInterestStorageKey) ?? "[]");
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: Record<string, unknown> | null) => {
    if (
      !item ||
      !["id", "developerId", "company", "contactName", "email", "at"].every(
        (key) => typeof item[key] === "string",
      )
    )
      return [];
    const interest = item as Omit<ProfileInterest, "companyId"> & { companyId?: unknown };
    // Marks made before senders were tracked by account only know the contact e-mail.
    const companyId = typeof interest.companyId === "string" ? interest.companyId : interest.email;
    return [{ ...interest, companyId }];
  });
}

/** Groups interest marks and meeting proposals by company account, most recent first. */
export function interestedCompanies(
  developerId: string,
  interests: readonly ProfileInterest[],
  meetings: readonly MeetingRequest[],
): InterestedCompany[] {
  const byCompany = new Map<string, InterestedCompany>();
  const touch = (entry: Omit<InterestedCompany, "meeting">, meeting?: MeetingRequest) => {
    const current = byCompany.get(entry.companyId);
    const latestMeeting =
      meeting && (!current?.meeting || meeting.sentAt > current.meeting.sentAt)
        ? meeting
        : current?.meeting;
    byCompany.set(entry.companyId, {
      ...(current && current.at > entry.at ? current : entry),
      ...(latestMeeting ? { meeting: latestMeeting } : {}),
    });
  };
  for (const item of interests)
    if (item.developerId === developerId)
      touch({
        companyId: item.companyId,
        email: item.email,
        company: item.company,
        contactName: item.contactName,
        at: item.at,
      });
  for (const item of meetings)
    if (item.developerId === developerId)
      touch(
        {
          companyId: item.companyId,
          email: item.email,
          company: item.company,
          contactName: item.contactName,
          at: item.sentAt,
        },
        item,
      );
  return [...byCompany.values()].sort((a, b) => b.at.localeCompare(a.at));
}
