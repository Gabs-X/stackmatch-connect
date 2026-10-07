import { beforeEach, describe, expect, it } from "vitest";
import { defaultFilters, type Filters } from "@/lib/filters";
import { emptyProfile, type LocalProfile } from "@/lib/local-profile";
import { createAccount } from "./auth";
import type { Db } from "./db";
import { saveProfile, searchProfiles } from "./profiles";
import { createTestDb } from "./test-db";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

const base: LocalProfile = {
  ...emptyProfile,
  name: "Dev",
  role: "Frontend Developer",
  location: "Recife, PE",
  seniority: "Pleno",
  workMode: "Remoto",
  availability: "Disponível agora",
  bio: "Bio.",
  skills: ["React", "TypeScript"],
  hiringTypes: ["PJ"],
  rate: 150,
};

/** Publishes a profile per entry, in order, and returns their ids by name. */
async function publish(profiles: Record<string, Partial<LocalProfile>>) {
  const ids: Record<string, string> = {};
  for (const [name, fields] of Object.entries(profiles)) {
    const user = await createAccount(db, {
      accountType: "developer",
      name,
      company: "",
      cnpj: "",
      jobTitle: "Dev",
      email: `${name.toLowerCase()}@example.com`,
      password: "segredo123",
      acceptTerms: true,
    });
    if (!user) throw new Error("account not created");
    await saveProfile(db, user.id, { ...base, name, ...fields });
    ids[name] = user.id;
  }
  return ids;
}

const names = async (filters: Partial<Filters>, exclude: string[] = []) =>
  (
    await searchProfiles(db, {
      filters: { ...defaultFilters, ...filters },
      exclude,
      offset: 0,
      limit: 50,
    })
  ).developers.map((developer) => developer.name);

describe("searchProfiles", () => {
  it("combines options of a group with OR and groups with AND", async () => {
    await publish({
      Ana: {},
      Bia: { skills: ["Vue"], seniority: "Sênior" },
      Caio: { skills: ["Java"], seniority: "Sênior" },
    });
    expect(await names({})).toEqual(["Ana", "Bia", "Caio"]);
    expect(await names({ skills: ["React", "Vue"] })).toEqual(["Ana", "Bia"]);
    expect(await names({ skills: ["React", "Vue"], seniority: ["Sênior"] })).toEqual(["Bia"]);
  });

  it("matches hiring types, work mode and availability", async () => {
    await publish({
      Ana: { hiringTypes: ["CLT", "PJ"] },
      Bia: { workMode: "Híbrido", availability: "Em 30 dias" },
      // A field left blank only passes while its group isn't filtered.
      Caio: { workMode: "" },
    });
    expect(await names({ hiring: ["CLT"] })).toEqual(["Ana"]);
    expect(await names({ hiring: ["Freelancer"] })).toEqual([]);
    expect(await names({ mode: ["Híbrido"] })).toEqual(["Bia"]);
    expect(await names({ mode: ["Remoto"] })).toEqual(["Ana"]);
    expect(await names({ availability: ["Em 30 dias"] })).toEqual(["Bia"]);
  });

  it("limits the rate below the maximum; at the maximum, any rate or none passes", async () => {
    await publish({
      Ana: { rate: 150 },
      Bia: { rate: 160 },
      Caio: { rate: null },
      Davi: { rate: 450 },
    });
    expect(await names({})).toEqual(["Ana", "Bia", "Caio", "Davi"]);
    expect(await names({ rate: [150] })).toEqual(["Ana"]);
  });

  it("pages in publication order, leaving out and counting the excluded profiles", async () => {
    const ids = await publish({ Ana: {}, Bia: {}, Caio: {}, Davi: {}, Eva: { skills: ["Go"] } });
    const page = (offset: number, exclude: string[] = []) =>
      searchProfiles(db, { filters: defaultFilters, exclude, offset, limit: 2 });

    const first = await page(0);
    expect(first.developers.map((developer) => developer.name)).toEqual(["Ana", "Bia"]);
    expect(first).toMatchObject({ total: 5, hidden: 0 });
    expect((await page(4)).developers.map((developer) => developer.name)).toEqual(["Eva"]);

    const saved = [ids["Bia"] ?? "", ids["Eva"] ?? ""];
    const withoutSaved = await page(0, saved);
    expect(withoutSaved.developers.map((developer) => developer.name)).toEqual(["Ana", "Caio"]);
    expect(withoutSaved).toMatchObject({ total: 3, hidden: 2 });
    // Only matches count as hidden.
    expect(
      await searchProfiles(db, {
        filters: { ...defaultFilters, skills: ["React"] },
        exclude: saved,
        offset: 0,
        limit: 10,
      }),
    ).toMatchObject({ total: 3, hidden: 1 });
  });
});
