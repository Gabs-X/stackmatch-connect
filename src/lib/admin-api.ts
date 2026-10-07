import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import { ticketFilters, ticketStatuses } from "@/lib/support";
import { isAdmin } from "@/server/admin";
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
