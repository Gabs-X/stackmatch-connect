import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile, newProject, type LocalProfile } from "@/lib/local-profile";
import { createAccount } from "./auth";
import type { Db } from "./db";
import * as schema from "./db/schema";
import { loadProfile, loadPublishedProfile, loadPublishedProfiles, saveProfile } from "./profiles";
import { seedDatabase, seedDeveloperId, seedDeveloperProfile } from "./seed";
import { createTestDb } from "./test-db";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

async function developerAccount(email: string) {
  const user = await createAccount(db, {
    accountType: "developer",
    name: "Ana Souza",
    company: "",
    cnpj: "",
    jobTitle: "Frontend Developer",
    email,
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  return user.id;
}

const ana: LocalProfile = {
  ...emptyProfile,
  name: "Ana Souza",
  role: "Frontend Developer",
  location: "Recife, PE",
  seniority: "Pleno",
  workMode: "Remoto",
  availability: "Disponível agora",
  bio: "Desenvolvo interfaces acessíveis.",
  skills: ["React", "TypeScript"],
  experienceYears: 4,
  rate: 95.5,
  hiringTypes: ["PJ", "CLT"],
  github: "https://github.com/anasouza",
  projects: [
    newProject({ name: "Clinic Booking", tech: ["Vue", "TypeScript"], demo: "clinic.app" }),
    newProject({ name: "Portfolio", image: "data:image/jpeg;base64,AAAA" }),
  ],
};

/** Project ids are generated on every save, so compare everything else. */
const withoutProjectIds = (profile: LocalProfile | null) =>
  profile && { ...profile, projects: profile.projects.map(({ id: _id, ...project }) => project) };

describe("saveProfile and loadProfile", () => {
  it("round-trip the form's profile, keeping the order of skills and projects", async () => {
    const id = await developerAccount("ana@example.com");
    expect(await loadProfile(db, id)).toBeNull();

    await saveProfile(db, id, ana);
    expect(withoutProjectIds(await loadProfile(db, id))).toEqual(withoutProjectIds(ana));
  });

  it("replace skills and projects on the next save", async () => {
    const id = await developerAccount("ana@example.com");
    await saveProfile(db, id, ana);
    await saveProfile(db, id, {
      ...ana,
      skills: ["Go"],
      projects: [newProject({ name: "CLI", tech: ["Go"] })],
    });

    const saved = await loadProfile(db, id);
    expect(saved?.skills).toEqual(["Go"]);
    expect(saved?.projects.map((project) => project.name)).toEqual(["CLI"]);
    expect(await db.select().from(schema.projects)).toHaveLength(1);
  });

  it("share one skill catalog between developers and projects", async () => {
    await saveProfile(db, await developerAccount("ana@example.com"), ana);
    await saveProfile(db, await developerAccount("bia@example.com"), { ...ana, name: "Bia" });
    const names = (await db.select().from(schema.skills)).map((skill) => skill.name).sort();
    expect(names).toEqual(["React", "TypeScript", "Vue"]);
  });

  it("keep answers left blank empty", async () => {
    const id = await developerAccount("ana@example.com");
    await saveProfile(db, id, { ...ana, experienceYears: null, rate: null, hiringTypes: [] });
    expect(await loadProfile(db, id)).toMatchObject({
      experienceYears: null,
      rate: null,
      hiringTypes: [],
    });
  });
});

describe("published profiles", () => {
  it("list every developer's profile as a catalog entry, in the order they were published", async () => {
    const anaId = await developerAccount("ana@example.com");
    const biaId = await developerAccount("bia@example.com");
    await developerAccount("caio@example.com");
    await saveProfile(db, anaId, ana);
    await saveProfile(db, biaId, { ...ana, name: "Bia" });
    // Editing doesn't move a profile.
    await saveProfile(db, anaId, { ...ana, role: "Staff Engineer" });

    const published = await loadPublishedProfiles(db);
    expect(published.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: anaId, name: "Ana Souza" },
      { id: biaId, name: "Bia" },
    ]);
    expect(published[0]).toMatchObject({
      role: "Staff Engineer",
      experience: "4 anos",
      rate: 95.5,
      image: "https://github.com/anasouza.png?size=768",
    });
    expect(published[0]?.projects[0]?.links.demo).toBe("https://clinic.app/");
  });

  it("find one profile by account id", async () => {
    const id = await developerAccount("ana@example.com");
    expect(await loadPublishedProfile(db, id)).toBeNull();
    await saveProfile(db, id, ana);
    expect((await loadPublishedProfile(db, id))?.name).toBe("Ana Souza");
  });
});

describe("seed", () => {
  it("gives teste.dev Gabriel's profile once, without overwriting its edits", async () => {
    await seedDatabase(db);
    expect(withoutProjectIds(await loadProfile(db, seedDeveloperId))).toEqual(
      withoutProjectIds(seedDeveloperProfile),
    );

    await saveProfile(db, seedDeveloperId, { ...seedDeveloperProfile, name: "Gabriel B." });
    await seedDatabase(db);
    expect((await loadProfile(db, seedDeveloperId))?.name).toBe("Gabriel B.");
  });
});
