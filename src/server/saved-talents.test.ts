import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/local-profile";
import { createAccount } from "./auth";
import type { Db } from "./db";
import { saveProfile } from "./profiles";
import { listSavedTalents, removeSavedTalent, saveTalent } from "./saved-talents";
import { createDeveloper, createTestDb } from "./test-db";

let db: Db;
let rafael: string;
let marina: string;

beforeEach(async () => {
  db = await createTestDb();
  // Companies only reach developers with a published profile.
  rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
});

async function account(accountType: "company" | "developer", email: string) {
  const user = await createAccount(db, {
    accountType,
    name: "Bruno Lima",
    company: "Acme",
    cnpj: "11222333000181",
    jobTitle: "Dev",
    email,
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  return user.id;
}

describe("saved talents", () => {
  it("keep each company's shortlist in the order it was saved", async () => {
    const acme = await account("company", "bruno@acme.com");
    const other = await account("company", "ana@other.com");
    expect(await saveTalent(db, acme, rafael)).toBe(true);
    expect(await saveTalent(db, acme, marina)).toBe(true);
    // Saving again changes nothing.
    expect(await saveTalent(db, acme, rafael)).toBe(true);

    expect(await listSavedTalents(db, acme)).toEqual([rafael, marina]);
    expect(await listSavedTalents(db, other)).toEqual([]);

    await removeSavedTalent(db, acme, rafael);
    expect(await listSavedTalents(db, acme)).toEqual([marina]);
  });

  it("only take profiles companies can find", async () => {
    const acme = await account("company", "bruno@acme.com");
    const developer = await account("developer", "ana@example.com");
    expect(await saveTalent(db, acme, "perfil-inexistente")).toBe(false);
    // A developer account without a profile isn't listed anywhere yet.
    expect(await saveTalent(db, acme, developer)).toBe(false);

    await saveProfile(db, developer, {
      ...emptyProfile,
      name: "Ana",
      role: "Dev",
      location: "Recife, PE",
      seniority: "Pleno",
      workMode: "Remoto",
      availability: "Disponível agora",
      bio: "Bio.",
    });
    expect(await saveTalent(db, acme, developer)).toBe(true);
    expect(await listSavedTalents(db, acme)).toEqual([developer]);
  });
});
