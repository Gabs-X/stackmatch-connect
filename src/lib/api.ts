import { queryOptions } from "@tanstack/react-query";
import { demoCompanyActivity, developers, type Developer } from "./developers";
import type { MeetingRequest } from "./meeting-requests";
import type { ProfileInterest } from "./profile-interests";
import { demoDeveloperId } from "./auth";

/**
 * Simulated network latency for the mocked API, so loading states behave like a real backend.
 * Set to 0 to disable. When the API exists, replace the function bodies below with `fetch` calls
 * and keep the query options so screens don't change.
 */
const MOCK_LATENCY_MS = 450;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchDevelopers(): Promise<Developer[]> {
  await delay(MOCK_LATENCY_MS);
  return developers;
}

export const developersQuery = queryOptions({
  queryKey: ["developers"],
  queryFn: fetchDevelopers,
  // Mock data never changes during a session; revisit when a real API is wired in.
  staleTime: Infinity,
});

/**
 * Demo activity of the demo developer account (teste.dev): interest marks and a proposal from
 * fictional companies, merged with what real companies did on the server.
 */
export async function fetchCompanyActivity(
  accountId: string,
  developerName: string,
): Promise<{ interests: ProfileInterest[]; meetings: MeetingRequest[] }> {
  await delay(MOCK_LATENCY_MS);
  // A developer's profile is identified by their account id.
  return accountId === demoDeveloperId
    ? demoCompanyActivity(accountId, developerName)
    : { interests: [], meetings: [] };
}

export const companyActivityQuery = (accountId: string, name: string) =>
  queryOptions({
    queryKey: ["company-activity", accountId],
    queryFn: () => fetchCompanyActivity(accountId, name),
  });
