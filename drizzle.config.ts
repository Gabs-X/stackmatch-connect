import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit commands that reach the database (such as `npx drizzle-kit studio`) read
 * DATABASE_URL from .env.migrate.local, which git ignores. Not from .env or .env.local: the dev
 * server loads those, and would then use that database instead of PGlite (see docs/deploy-neon.md).
 */
const migrateEnvFile = ".env.migrate.local";
if (!process.env["DATABASE_URL"] && existsSync(migrateEnvFile)) process.loadEnvFile(migrateEnvFile);

// `npm run db:generate` writes migrations to drizzle/ from the schema. They're applied by
// scripts/migrate.ts (`npm run db:migrate`, and Vercel's production builds), and by local PGlite
// databases on their own at startup.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env["DATABASE_URL"] ?? "" },
});
