import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * One query API for both databases. Production uses Postgres (Neon) through DATABASE_URL;
 * development and tests run PGlite, a Postgres compiled to WebAssembly, so nothing needs
 * installing. PGlite's database has the same query builder, so it's typed as the Postgres one.
 */
export type Db = PostgresJsDatabase<typeof schema>;

/** DATABASE_URL: "postgres://…" for a server, "memory://" for a throwaway PGlite, or a folder. */
const defaultLocalDatabase = ".pglite";

async function connect(url: string | undefined): Promise<Db> {
  if (url?.startsWith("postgres://") || url?.startsWith("postgresql://")) {
    const [{ drizzle }, { default: postgres }] = await Promise.all([
      import("drizzle-orm/postgres-js"),
      import("postgres"),
    ]);
    // Migrations run before deploying (npm run db:migrate), not on every cold start.
    return drizzle({ client: postgres(url, { max: 1 }), schema });
  }
  if (process.env["NODE_ENV"] === "production")
    throw new Error("DATABASE_URL must point to a Postgres server in production.");
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const db = drizzle({ client: new PGlite(url || defaultLocalDatabase), schema });
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });
  return db as unknown as Db;
}

// Kept on globalThis so dev-server reloads reuse the open database instead of opening it twice.
const store = globalThis as unknown as { __stackmatchDb?: Promise<Db> | undefined };

export function getDb(): Promise<Db> {
  store.__stackmatchDb ??= connect(process.env["DATABASE_URL"]).catch((error: unknown) => {
    store.__stackmatchDb = undefined;
    throw error;
  });
  return store.__stackmatchDb;
}

export { schema };
