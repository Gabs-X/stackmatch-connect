import { beforeEach, describe, expect, it } from "vitest";
import type { SignUpInput } from "@/lib/auth";
import {
  authenticate,
  createAccount,
  createSession,
  deleteSession,
  hashPassword,
  sessionDurationMs,
  userForSession,
  verifyPassword,
} from "./auth";
import type { Db } from "./db";
import * as schema from "./db/schema";
import { seedCompanyId, seedDatabase, seedDeveloperId, seedPassword } from "./seed";
import { createTestDb } from "./test-db";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

const developer: SignUpInput = {
  accountType: "developer",
  name: " Ana Souza ",
  company: "ignored",
  cnpj: "",
  jobTitle: "Frontend Developer",
  email: "Ana@Example.com ",
  password: "segredo123",
  acceptTerms: true,
};

describe("passwords", () => {
  it("verify only the right password and never store it", async () => {
    const stored = await hashPassword("segredo123");
    expect(stored).not.toContain("segredo123");
    expect(await verifyPassword("segredo123", stored)).toBe(true);
    expect(await verifyPassword("segredo124", stored)).toBe(false);
    expect(await verifyPassword("segredo123", "garbage")).toBe(false);
  });

  it("salt each hash", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
  });
});

describe("accounts", () => {
  it("creates a developer, normalizing the e-mail and name", async () => {
    expect(await createAccount(db, developer)).toMatchObject({
      name: "Ana Souza",
      email: "ana@example.com",
      accountType: "developer",
      company: "",
      cnpj: "",
      jobTitle: "Frontend Developer",
    });
    const [row] = await db.select().from(schema.users);
    expect(row?.accountType).toBe("DEVELOPER");
  });

  it("keeps a company's name and CNPJ digits", async () => {
    const company = await createAccount(db, {
      ...developer,
      accountType: "company",
      company: " Acme ",
      cnpj: "11.222.333/0001-81",
      jobTitle: "",
    });
    expect(company).toMatchObject({
      accountType: "company",
      company: "Acme",
      cnpj: "11222333000181",
    });
  });

  it("refuses a second account with the same e-mail in any case", async () => {
    await createAccount(db, developer);
    expect(await createAccount(db, { ...developer, email: "ANA@example.com" })).toBeNull();
  });

  it("signs in with the right password and rejects wrong passwords and unknown e-mails alike", async () => {
    await createAccount(db, developer);
    expect(await authenticate(db, " ana@EXAMPLE.com", "segredo123")).toMatchObject({
      email: "ana@example.com",
    });
    expect(await authenticate(db, "ana@example.com", "errada123")).toBeNull();
    expect(await authenticate(db, "outra@example.com", "segredo123")).toBeNull();
  });
});

describe("sessions", () => {
  it("find the account by token until signed out", async () => {
    const user = await createAccount(db, developer);
    const token = await createSession(db, user?.id ?? "");
    expect(await userForSession(db, token)).toEqual(user);
    expect(await userForSession(db, `${token}x`)).toBeNull();

    await deleteSession(db, token);
    expect(await userForSession(db, token)).toBeNull();
  });

  it("store only a hash of the token", async () => {
    const user = await createAccount(db, developer);
    const token = await createSession(db, user?.id ?? "");
    const rows = await db.select().from(schema.sessions);
    expect(rows.map((row) => row.id)).not.toContain(token);
  });

  it("expire after their duration", async () => {
    const user = await createAccount(db, developer);
    const now = Date.now();
    const token = await createSession(db, user?.id ?? "", now);
    expect(await userForSession(db, token, now + sessionDurationMs - 1)).toEqual(user);
    expect(await userForSession(db, token, now + sessionDurationMs)).toBeNull();
    expect(await db.select().from(schema.sessions)).toEqual([]);
  });
});

describe("seed accounts", () => {
  it("sign in by e-mail with the seed password, keeping their fixed ids", async () => {
    await seedDatabase(db);
    await seedDatabase(db);
    expect(await authenticate(db, "teste.dev@example.com", seedPassword)).toMatchObject({
      id: seedDeveloperId,
      accountType: "developer",
    });
    expect(await authenticate(db, " TESTE.EMP@example.com", seedPassword)).toMatchObject({
      id: seedCompanyId,
      accountType: "company",
      company: "Empresa Teste",
    });
    expect(await authenticate(db, "teste.dev@example.com", "1234")).toBeNull();
    // No usernames: only e-mails sign in.
    expect(await authenticate(db, "teste.dev", seedPassword)).toBeNull();
  });

  it("can't have their e-mails taken by a sign-up", async () => {
    await seedDatabase(db);
    expect(await createAccount(db, { ...developer, email: "teste.dev@example.com" })).toBeNull();
  });
});
