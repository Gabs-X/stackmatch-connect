import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fileReport } from "@/server/moderation";
import { database, requireConfirmedAccount } from "@/server/session";
import { reportInputSchema } from "./moderation";

/**
 * Stands for `POST /reports`: the signed-in account reports a job, a profile or a company. Names
 * the account the screen shows; the server refuses it when the session is now another's.
 */
export const fileReportFn = createServerFn({ method: "POST" })
  .validator(reportInputSchema.extend({ accountId: z.string().min(1).max(200) }))
  .handler(async ({ data: { accountId, ...input } }) => {
    const user = await requireConfirmedAccount(accountId);
    return fileReport(await database(), user.id, input);
  });
