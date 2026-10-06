import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  listInterestsBy,
  listInterestsFor,
  markInterest,
  removeInterest,
} from "@/server/interests";
import { getRequestUrl } from "@tanstack/react-start/server";
import { notifyInterest } from "@/server/notifications";
import { database, requireAccount } from "@/server/session";

const developerId = z.string().min(1).max(200);

/** Stands for `GET /me/interests`: developer ids the signed-in company marked. */
export const fetchMyInterests = createServerFn({ method: "GET" }).handler(async () =>
  listInterestsBy(await database(), (await requireAccount("company")).id),
);

/**
 * Stands for `POST /interests`. The first mark on a profile e-mails the developer, in the language
 * of the company's screen; a failed e-mail doesn't undo the mark.
 */
export const markInterestFn = createServerFn({ method: "POST" })
  .validator(z.object({ developerId, language: z.enum(["pt", "en"]).default("pt") }))
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    const db = await database();
    const result = await markInterest(db, company.id, data.developerId);
    if (result === "unknown") throw new Error("Unknown developer profile.");
    if (result === "created")
      await notifyInterest(
        db,
        company.id,
        data.developerId,
        data.language,
        getRequestUrl().origin,
      ).catch((error: unknown) => console.error("Interest not e-mailed:", error));
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
