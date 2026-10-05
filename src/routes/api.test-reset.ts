import { createFileRoute } from "@tanstack/react-router";
import { resetDatabase } from "@/server/db/reset";
import { database } from "@/server/session";

/**
 * Lets the end-to-end tests start each test from the demo data. Only exists when the server runs
 * with E2E=1 (see playwright.config.ts); anywhere else it answers 404.
 */
export const Route = createFileRoute("/api/test-reset")({
  server: {
    handlers: {
      POST: async () => {
        if (process.env["E2E"] !== "1") return new Response("Not found", { status: 404 });
        await resetDatabase(await database());
        return new Response(null, { status: 204 });
      },
    },
  },
});
