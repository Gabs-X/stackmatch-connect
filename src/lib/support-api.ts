import { createServerFn } from "@tanstack/react-start";
import { ticketSchema } from "@/lib/support";
import { createTicket, listTickets } from "@/server/support";
import { clientIp, currentUser, database } from "@/server/session";

/** Stands for `POST /support/tickets`: open to visitors too, within the per-IP limit. */
export const createTicketFn = createServerFn({ method: "POST" })
  .validator(ticketSchema)
  .handler(async ({ data }) =>
    createTicket(await database(), data, await currentUser(), clientIp()),
  );

/** Stands for `GET /me/tickets`: the signed-in account's tickets; none for visitors. */
export const fetchMyTickets = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  return user ? listTickets(await database(), user.id) : [];
});
