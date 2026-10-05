import type { MeetingRequest } from "./meeting-requests";

/** A company account marked a developer as interesting in Discover, signed with its contact. */
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
