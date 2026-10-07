import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { cleanup } from "@/server/cleanup";
import { database } from "@/server/session";

/**
 * Daily cleanup, called by Vercel Cron (scheduled in vite.config.ts). Vercel sends
 * "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set in the project; without it, the
 * route refuses everyone, so nobody else can trigger it.
 */
function authorized(header: string | null) {
  const secret = process.env["CRON_SECRET"]?.trim();
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export const Route = createFileRoute("/api/cron/cleanup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request.headers.get("authorization")))
          return new Response("Unauthorized", { status: 401 });
        const deleted = await cleanup(await database());
        console.info("Cleanup:", deleted);
        return Response.json({ deleted });
      },
    },
  },
});
