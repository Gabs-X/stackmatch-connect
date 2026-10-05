/**
 * `npm run db:seed`: adds the test accounts (teste.dev, teste.emp) and the developer's profile to
 * the database in DATABASE_URL, or to the local PGlite when it's unset. Data already there stays.
 * Like db:migrate, it reads DATABASE_URL from .env.migrate.local (see docs/deploy-neon.md).
 */
import { existsSync } from "node:fs";
import { getDb } from "@/server/db";
import { seedDatabase } from "@/server/seed";

const migrateEnvFile = ".env.migrate.local";
if (!process.env["DATABASE_URL"] && existsSync(migrateEnvFile)) process.loadEnvFile(migrateEnvFile);

const url = process.env["DATABASE_URL"] ?? "";
// Only the host of a server address: the rest of it has the password.
const target = /^postgres(ql)?:\/\//.test(url) ? new URL(url).host : url || ".pglite";
await seedDatabase(await getDb());
console.log(`Seed applied to ${target}.`);
// The Postgres client keeps its connection open; the seed is done.
process.exit(0);
