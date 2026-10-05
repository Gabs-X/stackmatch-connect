import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { defaultCompanySettings } from "@/lib/company-settings";
import { createAccount } from "./auth";
import { loadCompanyProfile, loadCompanySettings, saveCompanySettings } from "./companies";
import type { Db } from "./db";
import { createTestDb } from "./test-db";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

async function companyAccount(email: string): Promise<AuthUser> {
  const user = await createAccount(db, {
    accountType: "company",
    name: "Bruno Lima",
    company: "Acme",
    cnpj: "11222333000181",
    jobTitle: "Tech Lead",
    email,
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  return user;
}

describe("company settings", () => {
  it("start from the sign-up details and keep each account's own", async () => {
    const acme = await companyAccount("bruno@acme.com");
    const other = await companyAccount("ana@other.com");
    expect(await loadCompanySettings(db, acme)).toEqual(defaultCompanySettings(acme));

    const settings = {
      ...defaultCompanySettings(acme),
      contactName: "Carla Dias",
      about: "Software house.",
      phone: "(11) 99999-9999",
    };
    await saveCompanySettings(db, acme.id, settings);
    await saveCompanySettings(db, acme.id, { ...settings, location: "Recife, PE" });
    expect(await loadCompanySettings(db, acme)).toEqual({ ...settings, location: "Recife, PE" });
    expect((await loadCompanySettings(db, other)).contactName).toBe("Bruno Lima");
  });
});

describe("company profile", () => {
  it("shows what the company saved, and nothing before that", async () => {
    const acme = await companyAccount("bruno@acme.com");
    expect(await loadCompanyProfile(db, acme.id)).toBeNull();

    await saveCompanySettings(db, acme.id, {
      ...defaultCompanySettings(acme),
      about: "Software house.",
      website: "acme.com",
    });
    expect(await loadCompanyProfile(db, acme.id)).toEqual({
      about: "Software house.",
      website: "acme.com",
      location: "",
      contactRole: "Tech Lead",
      phone: "",
    });
  });

  it("is null for an unknown company", async () => {
    expect(await loadCompanyProfile(db, "unknown")).toBeNull();
  });
});
