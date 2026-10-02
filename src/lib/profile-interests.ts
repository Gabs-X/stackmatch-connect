import type { MeetingRequest } from "./meeting-requests";

/** A company account marked a developer as interesting in Discover. */
export type ProfileInterest = {
  id: string;
  developerId: string;
  company: string;
  contactName: string;
  /** Company contact's e-mail; the developer replies to it. */
  email: string;
  at: string;
};

export type ProfileInterestInput = Omit<ProfileInterest, "id" | "at">;

/** One company that showed interest, with its latest meeting proposal when it sent one. */
export type InterestedCompany = {
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
  return value.filter(
    (item): item is ProfileInterest =>
      item &&
      ["id", "developerId", "company", "contactName", "email", "at"].every(
        (key) => typeof item[key] === "string",
      ),
  );
}

/** Groups interest marks and meeting proposals by company, most recent first. */
export function interestedCompanies(
  developerId: string,
  interests: readonly ProfileInterest[],
  meetings: readonly MeetingRequest[],
): InterestedCompany[] {
  const byEmail = new Map<string, InterestedCompany>();
  const touch = (entry: Omit<InterestedCompany, "meeting">, meeting?: MeetingRequest) => {
    const current = byEmail.get(entry.email);
    const latestMeeting =
      meeting && (!current?.meeting || meeting.sentAt > current.meeting.sentAt)
        ? meeting
        : current?.meeting;
    byEmail.set(entry.email, {
      ...(current && current.at > entry.at ? current : entry),
      ...(latestMeeting ? { meeting: latestMeeting } : {}),
    });
  };
  for (const item of interests)
    if (item.developerId === developerId)
      touch({
        email: item.email,
        company: item.company,
        contactName: item.contactName,
        at: item.at,
      });
  for (const item of meetings)
    if (item.developerId === developerId)
      touch(
        {
          email: item.email,
          company: item.company,
          contactName: item.contactName,
          at: item.sentAt,
        },
        item,
      );
  return [...byEmail.values()].sort((a, b) => b.at.localeCompare(a.at));
}
