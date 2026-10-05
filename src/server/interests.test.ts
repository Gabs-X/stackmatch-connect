import { beforeEach, describe, expect, it } from "vitest";
import { defaultCompanySettings } from "@/lib/company-settings";
import { createAccount } from "./auth";
import { saveCompanySettings } from "./companies";
import type { Db } from "./db";
import { listInterestsBy, listInterestsFor, markInterest, removeInterest } from "./interests";
import { createTestDb } from "./test-db";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

async function company(name: string, email: string) {
  const user = await createAccount(db, {
    accountType: "company",
    name: "Bruno Lima",
    company: name,
    cnpj: "11222333000181",
    jobTitle: "Tech Lead",
    email,
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  return user;
}

describe("interest marks", () => {
  it("keep each company's marks, once per developer, and can be undone", async () => {
    const acme = await company("Acme", "bruno@acme.com");
    const other = await company("Other", "ana@other.com");
    expect(await markInterest(db, acme.id, "rafael-lima")).toBe(true);
    expect(await markInterest(db, acme.id, "marina-costa")).toBe(true);
    expect(await markInterest(db, acme.id, "rafael-lima")).toBe(true);
    expect(await listInterestsBy(db, acme.id)).toEqual(["rafael-lima", "marina-costa"]);
    expect(await listInterestsBy(db, other.id)).toEqual([]);

    await removeInterest(db, acme.id, "rafael-lima");
    expect(await listInterestsBy(db, acme.id)).toEqual(["marina-costa"]);
  });

  it("only take profiles companies can find", async () => {
    const acme = await company("Acme", "bruno@acme.com");
    expect(await markInterest(db, acme.id, "perfil-inexistente")).toBe(false);
    expect(await listInterestsBy(db, acme.id)).toEqual([]);
  });
});

describe("interests a developer received", () => {
  it("name each company with its current contact, newest first", async () => {
    const acme = await company("Acme", "bruno@acme.com");
    const other = await company("Other", "ana@other.com");
    await markInterest(db, acme.id, "rafael-lima");
    await markInterest(db, other.id, "rafael-lima");
    await markInterest(db, acme.id, "marina-costa");
    await saveCompanySettings(db, acme.id, {
      ...defaultCompanySettings(acme),
      contactName: "Carla Dias",
      contactEmail: "carla@acme.com",
    });

    const received = await listInterestsFor(db, "rafael-lima");
    expect(
      received.map(({ companyId, company, contactName, email }) => ({
        companyId,
        company,
        contactName,
        email,
      })),
    ).toEqual([
      // No details saved yet: the sign-up name and e-mail stand in.
      { companyId: other.id, company: "Other", contactName: "Bruno Lima", email: "ana@other.com" },
      { companyId: acme.id, company: "Acme", contactName: "Carla Dias", email: "carla@acme.com" },
    ]);
    expect(received[0]).toMatchObject({ developerId: "rafael-lima" });
    expect(Number.isNaN(Date.parse(received[0]?.at ?? ""))).toBe(false);
  });
});
