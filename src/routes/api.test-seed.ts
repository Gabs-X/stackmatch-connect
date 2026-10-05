import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { companySettingsSchema } from "@/lib/company-settings";
import { profileInputSchema } from "@/lib/local-profile";
import { saveCompanySettings } from "@/server/companies";
import { interests, meetingRequests, savedTalents, users } from "@/server/db/schema";
import { loadProfile, saveProfile } from "@/server/profiles";
import { database } from "@/server/session";

/**
 * Lets the end-to-end tests put their own data in the database (see e2e/test-data.ts). The
 * accounts it creates have no usable password. Only exists when the server runs with E2E=1 (see
 * playwright.config.ts).
 */
const seedSchema = z.object({
  developers: z
    .array(z.object({ id: z.string(), email: z.string(), profile: profileInputSchema }))
    .default([]),
  companies: z
    .array(
      z.object({
        id: z.string(),
        email: z.string(),
        company: z.string(),
        settings: companySettingsSchema,
        interestIn: z.array(z.string()).default([]),
        meetings: z
          .array(
            z.object({
              developerId: z.string(),
              date: z.string(),
              time: z.string(),
              message: z.string(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  savedTalents: z.object({ companyId: z.string(), developerIds: z.array(z.string()) }).optional(),
});

/** Not a scrypt hash, so no password matches it. */
const noPassword = "!";

export const Route = createFileRoute("/api/test-seed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env["E2E"] !== "1") return new Response("Not found", { status: 404 });
        const seed = seedSchema.parse(await request.json());
        const db = await database();

        for (const developer of seed.developers) {
          await db.insert(users).values({
            id: developer.id,
            email: developer.email,
            passwordHash: noPassword,
            emailVerifiedAt: new Date(),
            accountType: "DEVELOPER",
            name: developer.profile.name,
            jobTitle: developer.profile.role,
          });
          await saveProfile(db, developer.id, developer.profile);
        }

        for (const company of seed.companies) {
          await db.insert(users).values({
            id: company.id,
            email: company.email,
            passwordHash: noPassword,
            emailVerifiedAt: new Date(),
            accountType: "COMPANY",
            name: company.settings.contactName,
            jobTitle: company.settings.contactRole,
            companyName: company.company,
            cnpj: "11222333000181",
          });
          await saveCompanySettings(db, company.id, company.settings);
          for (const developerId of company.interestIn)
            await db.insert(interests).values({ companyId: company.id, developerId });
          for (const meeting of company.meetings)
            await db.insert(meetingRequests).values({
              ...meeting,
              companyId: company.id,
              developerName: (await loadProfile(db, meeting.developerId))?.name ?? "",
              companyName: company.company,
              contactName: company.settings.contactName,
              replyToEmail: company.settings.contactEmail,
            });
        }

        for (const developerId of seed.savedTalents?.developerIds ?? [])
          await db
            .insert(savedTalents)
            .values({ companyId: seed.savedTalents?.companyId ?? "", developerId });

        return new Response(null, { status: 204 });
      },
    },
  },
});
