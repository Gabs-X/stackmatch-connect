import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import { moderationNoteSchema } from "@/lib/moderation";
import { ticketFilters, ticketStatuses } from "@/lib/support";
import { isAdmin } from "@/server/admin";
import {
  dismissReport,
  liftSuspension,
  listReports,
  listSuspended,
  suspendAccount,
} from "@/server/moderation";
import { AccessError, currentUser, database } from "@/server/session";
import { listAdminTickets, setTicketStatus } from "@/server/support";

async function requireAdmin() {
  const user = await currentUser();
  if (!isAdmin(user)) throw new AccessError();
  return user;
}

/** Whether the signed-in account may open the admin pages; false for everyone else. */
export const fetchIsAdmin = createServerFn({ method: "GET" }).handler(async () =>
  isAdmin(await currentUser()),
);

/** Stands for `GET /admin/tickets?status=`. */
export const fetchAdminTickets = createServerFn({ method: "GET" })
  .validator(z.enum(ticketFilters))
  .handler(async ({ data }) => {
    await requireAdmin();
    return listAdminTickets(await database(), data);
  });

/** Stands for `PATCH /admin/tickets/:id`: resolve or reopen; says whether the author was told. */
export const setTicketStatusFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive(), status: z.enum(ticketStatuses) }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const result = await setTicketStatus(
      await database(),
      data.id,
      data.status,
      admin.email,
      getRequestUrl().origin,
    );
    if (!result.found) throw new Error("Unknown ticket.");
    return result.notified;
  });

/** Stands for `GET /admin/reports?status=`. */
export const fetchAdminReports = createServerFn({ method: "GET" })
  .validator(z.enum(["open", "all"]))
  .handler(async ({ data }) => {
    await requireAdmin();
    return listReports(await database(), data);
  });

/** Closes a report without action, with the reason; false when it was no longer open. */
export const dismissReportFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(200), note: moderationNoteSchema }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    return dismissReport(await database(), data.id, admin.email, data.note);
  });

/** Suspends the account the content belongs to, with the reason and the report that led to it. */
export const suspendAccountFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      accountId: z.string().min(1).max(200),
      reason: moderationNoteSchema,
      reportId: z.string().min(1).max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    return suspendAccount(await database(), data.accountId, {
      reason: data.reason,
      admin: admin.email,
      reportId: data.reportId ?? null,
    });
  });

export const liftSuspensionFn = createServerFn({ method: "POST" })
  .validator(z.object({ accountId: z.string().min(1).max(200), reason: moderationNoteSchema }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    return liftSuspension(await database(), data.accountId, {
      reason: data.reason,
      admin: admin.email,
    });
  });

export const fetchSuspendedAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  return listSuspended(await database());
});
