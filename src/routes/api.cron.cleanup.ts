import { createFileRoute } from "@tanstack/react-router";
import { cleanup } from "@/server/cleanup";
import { cronAuthorized as authorized } from "@/server/cron";
import { database } from "@/server/session";

/** Daily cleanup, called by Vercel Cron (scheduled in vite.config.ts; see cronAuthorized). */

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
