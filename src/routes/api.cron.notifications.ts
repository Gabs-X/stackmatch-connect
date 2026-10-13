import { createFileRoute } from "@tanstack/react-router";
import { cronAuthorized } from "@/server/cron";
import { deliverEmails } from "@/server/outbox";
import { database } from "@/server/session";

/** E-mails sent per run; the rest wait for the next one, or for the next requests. */
const perRun = 200;

/**
 * Sends the notification e-mails that failed and are due again, called by Vercel Cron (scheduled
 * in vite.config.ts; see cronAuthorized). Requests also send a few each, so this one catches up
 * when the site is quiet.
 */
export const Route = createFileRoute("/api/cron/notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!cronAuthorized(request.headers.get("authorization")))
          return new Response("Unauthorized", { status: 401 });
        const delivery = await deliverEmails(await database(), { others: perRun });
        console.info("Notification e-mails:", delivery);
        return Response.json({ delivery });
      },
    },
  },
});
