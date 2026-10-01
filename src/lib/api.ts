import { queryOptions } from "@tanstack/react-query";
import { developers, type Developer } from "./developers";

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
