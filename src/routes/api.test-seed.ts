import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { savedTalents } from "@/server/db/schema";
import { database } from "@/server/session";

/**
 * Lets the end-to-end tests start from a given shortlist, including ids no profile has anymore.
 * Only exists when the server runs with E2E=1 (see playwright.config.ts).
 */
const seedSchema = z.object({ companyId: z.string(), savedTalents: z.array(z.string()) });

export const Route = createFileRoute("/api/test-seed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env["E2E"] !== "1") return new Response("Not found", { status: 404 });
        const seed = seedSchema.parse(await request.json());
        const db = await database();
        for (const developerId of seed.savedTalents)
          await db.insert(savedTalents).values({ companyId: seed.companyId, developerId });
        return new Response(null, { status: 204 });
      },
    },
  },
});
