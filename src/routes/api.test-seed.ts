import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { companySettingsSchema } from "@/lib/company-settings";
import { profileInputSchema } from "@/lib/local-profile";
import { saveCompanySettings } from "@/server/companies";
import {
  interests,
  jobs,
  meetingRequests,
  savedTalents,
  textTranslations,
  users,
} from "@/server/db/schema";
import { loadProfile, saveProfile } from "@/server/profiles";
import { maxEmailsPerIp, recordEmailSend } from "@/server/email-throttle";
import { clientIp, database } from "@/server/session";
import { hashText } from "@/server/translations";

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
  /** Stored translations, as if the model had translated these texts of the account. */
  translations: z
    .array(z.object({ ownerId: z.string(), text: z.string(), pt: z.string(), en: z.string() }))
    .default([]),
  /**
   * Jobs of the test company (teste.emp) in the job board, past its per-company limit: "Vaga de
   * teste 1" (the oldest) to "Vaga de teste N", a minute apart.
   */
  boardJobs: z.number().int().min(0).max(500).default(0),
  /** Uses up the e-mails this client's IP address may cause, as if it had sent them just now. */
  emailLimitReached: z.boolean().default(false),
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

        for (const { ownerId, text, pt, en } of seed.translations) {
          const hash = hashText(text.trim());
          await db.insert(textTranslations).values([
            { ownerId, hash, language: "pt", text: pt },
            { ownerId, hash, language: "en", text: en },
          ]);
        }

        if (seed.boardJobs)
          await db.insert(jobs).values(
            Array.from({ length: seed.boardJobs }, (_, index) => ({
              companyId: "demo-company",
              title: `Vaga de teste ${index + 1}`,
              listed: true,
              createdAt: new Date(Date.now() - (seed.boardJobs - index) * 60_000),
            })),
          );

        if (seed.emailLimitReached)
          for (let sent = 0; sent < maxEmailsPerIp; sent++) await recordEmailSend(db, clientIp());

        return new Response(null, { status: 204 });
      },
    },
  },
});
