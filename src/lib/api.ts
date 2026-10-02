import { queryOptions } from "@tanstack/react-query";
import { demoCompanyActivity, developers, type Developer } from "./developers";
import {
  isProposedTimeValid,
  type MeetingRequest,
  type MeetingRequestInput,
} from "./meeting-requests";
import type { ProfileInterest } from "./profile-interests";
import { demoDeveloperId, type AuthUser } from "./auth";
import {
  companySettingsSchema,
  readCompanySettings,
  writeCompanySettings,
  type CompanySettings,
  type CompanySettingsInput,
} from "./company-settings";

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

export class MeetingRequestError extends Error {
  constructor(readonly code: "time-passed") {
    super(code);
    this.name = "MeetingRequestError";
  }
}

/**
 * Stand-in for `POST /meeting-requests`. The backend e-mails the developer the company, the
 * proposed time and the message, with Reply-To set to `input.email`, so the conversation continues
 * by e-mail outside StackMatch. Here nothing is sent; the caller keeps a local record.
 */
export async function sendMeetingRequest(input: MeetingRequestInput): Promise<MeetingRequest> {
  await delay(MOCK_LATENCY_MS);
  if (!isProposedTimeValid(input.date, input.time)) throw new MeetingRequestError("time-passed");
  return {
    ...input,
    id: `${input.developerId}-${Date.now()}`,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Stand-in for `GET /me/interested-companies`: interest marks and meeting proposals other
 * companies sent to the signed-in developer. Only the demo developer account has mock activity;
 * what companies do in this browser is merged in by the page from shared client state.
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

/**
 * Stand-ins for `GET/PUT /company/settings`: what a hiring account shows developers. The mock keeps
 * them in this browser, per account, starting from the sign-up details.
 */
export async function fetchCompanySettings(user: AuthUser): Promise<CompanySettings> {
  await delay(MOCK_LATENCY_MS);
  return readCompanySettings(user);
}

export async function saveCompanySettings(
  accountId: string,
  input: CompanySettingsInput,
): Promise<CompanySettings> {
  await delay(MOCK_LATENCY_MS);
  const settings = companySettingsSchema.parse(input);
  writeCompanySettings(accountId, settings);
  return settings;
}

export const companySettingsKey = (accountId: string) => ["company-settings", accountId] as const;
