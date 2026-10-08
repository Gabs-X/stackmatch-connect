import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { emptyProfile } from "@/lib/local-profile";
import { createAccount } from "./auth";
import type { Db } from "./db";
import * as schema from "./db/schema";
import { saveProfile } from "./profiles";

/** A fresh in-memory database with every migration applied, for unit tests. */
export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: path.resolve("drizzle") });
  return db as unknown as Db;
}

/** A developer account with a published profile, the only kind companies can reach. */
export async function createDeveloper(db: Db, email: string, name = "Ana Souza") {
  const user = await createAccount(db, {
    accountType: "developer",
    name,
    company: "",
    cnpj: "",
    jobTitle: "Frontend Developer",
    email,
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  await saveProfile(db, user.id, {
    ...emptyProfile,
    name,
    role: "Frontend Developer",
    location: "Recife, PE",
    seniority: "Pleno",
    workMode: "Remoto",
    availability: "Disponível agora",
    bio: "Desenvolvo interfaces acessíveis.",
  });
  return user.id;
}

/** A company account, the kind that creates jobs and reaches developers. */
export async function createCompany(db: Db, email: string, company = "Acme") {
  const user = await createAccount(db, {
    accountType: "company",
    name: "Bia Santos",
    company,
    cnpj: "11222333000181",
    jobTitle: "Tech Recruiter",
    email,
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  return user;
}
