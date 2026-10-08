/**
 * `npm run translations:backfill`: translates the free text of every developer profile, company and job
 * already in the database, the ones saved before automatic translation existed (new saves are
 * translated on their own). Texts with a translation are skipped, so running it again only does
 * what's missing, and the per-account translation limit doesn't apply. Like db:migrate, it reads DATABASE_URL and DEEPL_API_KEY (and the optional Claude backup's settings) from
 * .env.migrate.local when they aren't set.
 */
import { existsSync } from "node:fs";
import { getDb } from "@/server/db";
import { companyProfiles, developerProfiles, jobs } from "@/server/db/schema";
import { translateCompanyTexts } from "@/server/jobs";
import { loadProfile, profileTexts } from "@/server/profiles";
import { defaultTranslator, updateTranslations } from "@/server/translations";

const migrateEnvFile = ".env.migrate.local";
if (existsSync(migrateEnvFile)) process.loadEnvFile(migrateEnvFile);

const translator = defaultTranslator();
if (!translator) {
  console.error(
    "DEEPL_API_KEY is needed to translate (or TRANSLATION_BACKUP=claude with ANTHROPIC_API_KEY).",
  );
  process.exit(1);
}

const db = await getDb();
const developers = await db.select({ id: developerProfiles.userId }).from(developerProfiles);
const companies = await db.select().from(companyProfiles);
const signal = () => AbortSignal.timeout(60_000);

for (const [index, { id }] of developers.entries()) {
  const profile = await loadProfile(db, id);
  if (profile)
    await updateTranslations(db, id, profileTexts(profile), {
      translator,
      signal: signal(),
      limited: false,
    });
  console.log(`Developers: ${index + 1}/${developers.length}`);
}
// Companies with saved details or jobs: their details and jobs are translated together.
const companyIds = [
  ...new Set([
    ...companies.map((company) => company.userId),
    ...(await db.select({ id: jobs.companyId }).from(jobs)).map((row) => row.id),
  ]),
];
for (const [index, companyId] of companyIds.entries()) {
  await translateCompanyTexts(db, companyId, undefined, {
    translator,
    signal: signal(),
    limited: false,
  });
  console.log(`Companies: ${index + 1}/${companyIds.length}`);
}
console.log("Translations up to date.");
// The Postgres client keeps its connection open; the work is done.
process.exit(0);
