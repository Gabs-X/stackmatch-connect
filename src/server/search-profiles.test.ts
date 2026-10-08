import { beforeEach, describe, expect, it } from "vitest";
import { defaultFilters, type Filters } from "@/lib/filters";
import { matchJob } from "@/lib/job-match";
import { emptyJob, type JobInput } from "@/lib/jobs";
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

  it("matches places by city or by whole state", async () => {
    await publish({
      Ana: {},
      Bia: { location: "Olinda, PE" },
      Caio: { location: "São Paulo, SP" },
    });
    expect(await names({ places: ["recife, pe"] })).toEqual(["Ana"]);
    expect(await names({ places: ["PE"] })).toEqual(["Ana", "Bia"]);
    expect(await names({ places: ["Recife, PE", "SP"] })).toEqual(["Ana", "Caio"]);
    expect(await names({ places: ["RJ"] })).toEqual([]);
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

describe("ranking for a job", () => {
  it("puts the profiles that meet more of the job first, as matchJob scores them", async () => {
    const job: JobInput = {
      ...emptyJob,
      title: "Backend",
      requiredSkills: ["Node.js", "PostgreSQL"],
      desiredSkills: ["Docker"],
      seniority: ["Sênior"],
      workModes: ["Híbrido"],
      hiringTypes: ["CLT"],
      availability: ["Em 15 dias"],
      location: "São Paulo, SP",
    };
    await publish({
      Ana: { skills: ["React"] },
      Bia: {
        skills: ["Node.js", "PostgreSQL", "Docker"],
        seniority: "Sênior",
        workMode: "Híbrido",
        hiringTypes: ["CLT"],
        availability: "Em 15 dias",
        location: "São Paulo, SP",
      },
      Caio: { skills: ["node.js"], seniority: "Sênior", location: "Campinas, SP" },
      Davi: { skills: ["Node.js", "PostgreSQL"], workMode: "Híbrido" },
      Eva: { skills: ["React"], location: "Santos, SP" },
    });
    const page = await searchProfiles(db, {
      filters: defaultFilters,
      exclude: [],
      offset: 0,
      limit: 10,
      rankFor: job,
    });
    const order = page.developers.map((developer) => developer.name);
    expect(order).toEqual(["Bia", "Davi", "Caio", "Eva", "Ana"]);
    // The same order the screen's score gives, ties kept in publication order.
    const scored = page.developers
      .map((developer, index) => ({
        name: developer.name,
        index,
        score: matchJob(job, developer).score ?? 0,
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    expect(scored.map((entry) => entry.name)).toEqual(order);
  });
});
