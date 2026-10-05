import { defineConfig } from "drizzle-kit";

// `npm run db:generate` writes migrations to drizzle/ from the schema; `npm run db:migrate` applies
// them to the Postgres in DATABASE_URL. Local PGlite databases apply them on their own at startup.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env["DATABASE_URL"] ?? "" },
});
