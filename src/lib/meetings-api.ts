import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { listReceivedBy, listSentBy, sendMeetingRequest } from "@/server/meetings";
import { database, requireAccount } from "@/server/session";
import { meetingRequestInputSchema, type MeetingRequestInput } from "./meeting-requests";

/**
 * Stands for `POST /meeting-requests`. Expected failures come back as a code: the time passed
 * while the dialog was open, or the profile doesn't exist.
 */
export const sendMeetingRequestFn = createServerFn({ method: "POST" })
  .validator((input: MeetingRequestInput) => meetingRequestInputSchema.parse(input))
  .handler(async ({ data }) =>
    sendMeetingRequest(await database(), await requireAccount("company"), data),
  );

/** Stands for `GET /me/meeting-requests` for companies: the proposals they sent. */
export const fetchSentMeetingRequests = createServerFn({ method: "GET" }).handler(async () =>
  listSentBy(await database(), (await requireAccount("company")).id),
);

/** Stands for `GET /me/meeting-requests` for developers: the proposals they received. */
export const fetchReceivedMeetingRequests = createServerFn({ method: "GET" }).handler(async () =>
  listReceivedBy(await database(), (await requireAccount("developer")).id),
);

export const sentMeetingRequestsQuery = (accountId: string) =>
  queryOptions({
    queryKey: ["meeting-requests", "sent", accountId],
    queryFn: () => fetchSentMeetingRequests(),
  });

export const receivedMeetingRequestsQuery = (accountId: string) =>
  queryOptions({
    queryKey: ["meeting-requests", "received", accountId],
    queryFn: () => fetchReceivedMeetingRequests(),
  });
