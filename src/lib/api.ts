import { queryOptions } from "@tanstack/react-query";
import { developers, type Developer } from "./developers";
import {
  isProposedTimeValid,
  type MeetingRequest,
  type MeetingRequestInput,
} from "./meeting-requests";

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
