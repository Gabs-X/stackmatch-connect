import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  answerMeetingRequest,
  listReceivedBy,
  listSentBy,
  sendMeetingRequest,
} from "@/server/meetings";
import { database, requireAccount } from "@/server/session";
import type { Lang } from "./i18n";
import { meetingRequestInputSchema, type MeetingRequestInput } from "./meeting-requests";

/**
 * Stands for `POST /meeting-requests`: records the proposal and e-mails it to the developer, in
 * the language of the company's screen. Expected failures come back as a code: the time passed
 * while the dialog was open, the profile doesn't exist, or the e-mail couldn't be sent.
 */
export const sendMeetingRequestFn = createServerFn({ method: "POST" })
  .validator((input: MeetingRequestInput & { language?: Lang }) =>
    meetingRequestInputSchema.extend({ language: z.enum(["pt", "en"]).default("pt") }).parse(input),
  )
  .handler(async ({ data: { language, ...input } }) =>
    sendMeetingRequest(
      await database(),
      await requireAccount("company"),
      input,
      Date.now(),
      language,
    ),
  );

/**
 * Stands for `POST /meeting-requests/:id/answer`: the developer accepts or declines a proposal
 * they received, once (see answerMeetingRequest).
 */
export const answerMeetingRequestFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(200), answer: z.enum(["accepted", "declined"]) }))
  .handler(async ({ data }) =>
    answerMeetingRequest(
      await database(),
      (await requireAccount("developer")).id,
      data.id,
      data.answer,
    ),
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
