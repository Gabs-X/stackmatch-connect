import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { listInterestsBy, listInterestsFor, removeInterest } from "@/server/interests";
import { getRequestUrl } from "@tanstack/react-start/server";
import { markInterestAndNotify, type MarkResult } from "@/server/outreach";
import { database, requireAccount } from "@/server/session";

const developerId = z.string().min(1).max(200);

/** Stands for `GET /me/interests`: developer ids the signed-in company marked. */
export const fetchMyInterests = createServerFn({ method: "GET" }).handler(async () =>
  listInterestsBy(await database(), (await requireAccount("company")).id),
);

/**
 * Stands for `POST /interests`. Within the daily limit, marks interest and e-mails the developer in
 * the language of the company's screen (see markInterestAndNotify); a refusal says which limit.
 */
export const markInterestFn = createServerFn({ method: "POST" })
  .validator(z.object({ developerId, language: z.enum(["pt", "en"]).default("pt") }))
  .handler(async ({ data }): Promise<MarkResult> => {
    const company = await requireAccount("company");
    return markInterestAndNotify(
      await database(),
      company.id,
      data.developerId,
      data.language,
      getRequestUrl().origin,
    );
  });

/** Stands for `DELETE /interests/:developerId`, used to undo a mark. */
export const removeInterestFn = createServerFn({ method: "POST" })
  .validator(developerId)
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    await removeInterest(await database(), company.id, data);
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
