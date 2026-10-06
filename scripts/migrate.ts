/**
 * `npm run db:migrate`: applies the pending migrations in drizzle/ to the Postgres in DATABASE_URL,
 * read from .env.migrate.local when it isn't set (see docs/deploy-neon.md). It gives up after a
 * while instead of retrying a connection forever, and fails with a non-zero exit code.
 *
 * With --production-only, it runs only in Vercel's production builds (VERCEL_ENV=production):
 * `npm run vercel-build` uses it so preview deployments never change the production database.
 */
import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const timeoutMs = 2 * 60_000;

if (process.argv.includes("--production-only") && process.env["VERCEL_ENV"] !== "production") {
  console.log(
    `Migrations skipped: not a production build (VERCEL_ENV=${process.env["VERCEL_ENV"] ?? "unset"}).`,
  );
  process.exit(0);
}

const migrateEnvFile = ".env.migrate.local";
if (!process.env["DATABASE_URL"] && existsSync(migrateEnvFile)) process.loadEnvFile(migrateEnvFile);

const url = process.env["DATABASE_URL"]?.trim() ?? "";
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error("DATABASE_URL must point to a Postgres server to apply migrations.");
  process.exit(1);
}
// Only the host: the rest of the URL has the password.
const host = new URL(url).host;

const timer = setTimeout(() => {
  console.error(`Migrations timed out after ${timeoutMs / 1000} s connecting to ${host}.`);
  process.exit(1);
}, timeoutMs);

const client = postgres(url, { max: 1, connect_timeout: 15, onnotice: () => {} });
try {
  await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
  console.log(`Migrations applied to ${host}.`);
} catch (error) {
  console.error(`Migrations failed on ${host}:`, error);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await client.end();
}
