/**
 * `npm run translations:backfill`: translates the free text of every developer profile and company
 * already in the database, the ones saved before automatic translation existed (new saves are
 * translated on their own). Texts with a translation are skipped, so running it again only does
 * what's missing. Like db:migrate, it reads DATABASE_URL (and ANTHROPIC_API_KEY) from
 * .env.migrate.local when they aren't set.
 */
import { existsSync } from "node:fs";
import { getDb } from "@/server/db";
import { companyProfiles, developerProfiles } from "@/server/db/schema";
import { assistantClient } from "@/server/assistant";
import { companyTexts } from "@/server/companies";
import { loadProfile, profileTexts } from "@/server/profiles";
import { updateTranslations } from "@/server/translations";

const migrateEnvFile = ".env.migrate.local";
if (existsSync(migrateEnvFile)) process.loadEnvFile(migrateEnvFile);

const client = assistantClient();
if (!client) {
  console.error("ANTHROPIC_API_KEY is needed to translate.");
  process.exit(1);
}

const db = await getDb();
const developers = await db.select({ id: developerProfiles.userId }).from(developerProfiles);
const companies = await db.select().from(companyProfiles);
const signal = () => AbortSignal.timeout(60_000);

for (const [index, { id }] of developers.entries()) {
  const profile = await loadProfile(db, id);
  if (profile)
    await updateTranslations(db, id, profileTexts(profile), { client, signal: signal() });
  console.log(`Developers: ${index + 1}/${developers.length}`);
}
for (const [index, company] of companies.entries()) {
  await updateTranslations(db, company.userId, companyTexts(company), { client, signal: signal() });
  console.log(`Companies: ${index + 1}/${companies.length}`);
}
console.log("Translations up to date.");
// The Postgres client keeps its connection open; the work is done.
process.exit(0);
