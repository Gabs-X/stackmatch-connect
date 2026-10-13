import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listInterestsBy, listInterestsFor, removeInterest } from "@/server/interests";
import { getRequestUrl } from "@tanstack/react-start/server";
import { markInterestAndNotify, type MarkResult } from "@/server/outreach";
import { database, requireAccount } from "@/server/session";

const developerId = z.string().min(1).max(200);
// The account the screen shows; the server refuses the call when the session is now another's.
const accountId = z.string().min(1).max(200);

/** Stands for `GET /me/interests`: developer ids the signed-in company marked. */
export const fetchMyInterests = createServerFn({ method: "GET" })
  .validator(z.object({ accountId }))
  .handler(async ({ data }) =>
    listInterestsBy(await database(), (await requireAccount("company", data.accountId)).id),
  );

/**
 * Stands for `POST /interests`. Within the daily limit, marks interest and notifies the developer,
 * by e-mail in their language (see markInterestAndNotify), about the job it came from when there was
 * one; a refusal says which limit.
 */
export const markInterestFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      accountId,
      developerId,
      // Sent by older screens; the e-mail now goes in the developer's language.
      language: z.enum(["pt", "en"]).optional(),
      jobId: z.string().min(1).max(200).optional(),
    }),
  )
  .handler(async ({ data }): Promise<MarkResult> => {
    const company = await requireAccount("company", data.accountId);
    return markInterestAndNotify(
      await database(),
      company.id,
      data.developerId,
      getRequestUrl().origin,
      Date.now(),
      data.jobId,
    );
  });

/** Stands for `DELETE /interests/:developerId`, used to undo a mark. */
export const removeInterestFn = createServerFn({ method: "POST" })
  .validator(z.object({ accountId, developerId }))
  .handler(async ({ data }) => {
    const company = await requireAccount("company", data.accountId);
    await removeInterest(await database(), company.id, data.developerId);
  });

/** Stands for `GET /me/interested-companies` (interest marks part): who marked the developer. */
export const fetchReceivedInterests = createServerFn({ method: "GET" }).handler(async () =>
  listInterestsFor(await database(), (await requireAccount("developer")).id),
);

export const receivedInterestsQuery = (accountId: string) =>
  queryOptions({
    queryKey: ["received-interests", accountId],
    queryFn: () => fetchReceivedInterests(),
  });
