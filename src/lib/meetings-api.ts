import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestUrl } from "@tanstack/react-start/server";
import {
  answerMeetingRequest,
  cancelMeeting,
  listReceivedBy,
  listSentBy,
  rescheduleMeeting,
  sendMeetingRequest,
  type MeetingActor,
} from "@/server/meetings";
import { AccessError, currentUser, database, requireAccount } from "@/server/session";
import type { Lang } from "./i18n";
import {
  meetingChangeSchema,
  meetingRequestInputSchema,
  type MeetingRequestInput,
} from "./meeting-requests";

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

/** The signed-in, confirmed account as a side of a call; refused otherwise. */
async function meetingActor(): Promise<MeetingActor> {
  const user = await currentUser();
  if (!user?.emailVerified) throw new AccessError();
  return { side: user.accountType, accountId: user.id };
}

const meetingId = z.string().min(1).max(200);

/**
 * Stands for `POST /meeting-requests/:id/answer`: the side that didn't propose the current time
 * accepts or declines it, once (see answerMeetingRequest).
 */
export const answerMeetingRequestFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: meetingId, answer: z.enum(["accepted", "declined"]) }))
  .handler(async ({ data }) =>
    answerMeetingRequest(
      await database(),
      await meetingActor(),
      data.id,
      data.answer,
      Date.now(),
      getRequestUrl().origin,
    ),
  );

/** Stands for `POST /meeting-requests/:id/reschedule`: either side moves the call (see rescheduleMeeting). */
export const rescheduleMeetingFn = createServerFn({ method: "POST" })
  .validator(meetingChangeSchema.extend({ id: meetingId }))
  .handler(async ({ data: { id, ...change } }) =>
    rescheduleMeeting(
      await database(),
      await meetingActor(),
      id,
      change,
      Date.now(),
      getRequestUrl().origin,
    ),
  );

/** Stands for `POST /meeting-requests/:id/cancel`: either side cancels the call (see cancelMeeting). */
export const cancelMeetingFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: meetingId, message: meetingChangeSchema.shape.message }))
  .handler(async ({ data }) =>
    cancelMeeting(
      await database(),
      await meetingActor(),
      data.id,
      data.message,
      Date.now(),
      getRequestUrl().origin,
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
