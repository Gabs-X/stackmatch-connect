import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile, newProject, type LocalProfile } from "@/lib/local-profile";
import { createAccount } from "./auth";
import type { Db } from "./db";
import * as schema from "./db/schema";
import {
  listSkillCatalog,
  loadProfile,
  loadPublishedProfile,
  loadPublishedProfiles,
  saveProfile,
} from "./profiles";
import { seedDatabase, seedDeveloperId, seedDeveloperProfile } from "./seed";
import { localImagePath, readLocalImage } from "./storage";
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
    newProject({ name: "Portfolio" }),
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

describe("skill catalog", () => {
  it("keeps one spelling per skill, whatever case each profile typed", async () => {
    const anaId = await developerAccount("ana@example.com");
    const biaId = await developerAccount("bia@example.com");
    await saveProfile(db, anaId, { ...ana, skills: ["React"], projects: [] });
    await saveProfile(db, biaId, {
      ...ana,
      skills: ["react", "REACT", "Elixir"],
      projects: [newProject({ name: "Chat", tech: ["elixir", "React"] })],
    });

    expect((await loadProfile(db, biaId))?.skills).toEqual(["React", "Elixir"]);
    expect((await loadProfile(db, biaId))?.projects[0]?.tech).toEqual(["Elixir", "React"]);
    expect((await db.select().from(schema.skills)).map((skill) => skill.name).sort()).toEqual([
      "Elixir",
      "React",
    ]);
  });

  it("lists skills in use, most used first, and drops the ones nobody uses anymore", async () => {
    const anaId = await developerAccount("ana@example.com");
    const biaId = await developerAccount("bia@example.com");
    await saveProfile(db, anaId, { ...ana, skills: ["React", "Go"], projects: [] });
    await saveProfile(db, biaId, { ...ana, skills: ["React", "Typo"], projects: [] });
    expect(await listSkillCatalog(db)).toEqual(["React", "Go", "Typo"]);

    // Bia fixes the typo: it stays in the table but stops being suggested.
    await saveProfile(db, biaId, { ...ana, skills: ["React"], projects: [] });
    expect(await listSkillCatalog(db)).toEqual(["React", "Go"]);
  });
});

describe("images", () => {
  // A tiny but real JPEG would do; the storage only keeps bytes.
  const newImage = `data:image/jpeg;base64,${Buffer.from("jpeg bytes").toString("base64")}`;
  const stored = (url: string) => readLocalImage(url.slice(localImagePath.length));

  it("move new images to file storage and keep only their URL", async () => {
    const id = await developerAccount("ana@example.com");
    await saveProfile(db, id, {
      ...ana,
      photo: newImage,
      projects: [newProject({ name: "Portfolio", image: newImage })],
    });

    const saved = await loadProfile(db, id);
    expect(saved?.photo).toMatch(/^\/uploads\/photos\/[a-z0-9-]+\/[a-z0-9-]+\.jpg$/);
    expect(saved?.projects[0]?.image).toMatch(/^\/uploads\/covers\//);
    expect((await stored(saved?.photo ?? ""))?.toString()).toBe("jpeg bytes");
    expect((await loadPublishedProfile(db, id))?.image).toBe(saved?.photo);
  });

  it("keep stored images across saves and delete the ones the profile stops using", async () => {
    const id = await developerAccount("ana@example.com");
    await saveProfile(db, id, {
      ...ana,
      photo: newImage,
      projects: [newProject({ name: "Portfolio", image: newImage })],
    });
    const first = await loadProfile(db, id);
    if (!first) throw new Error("not saved");

    // Edited without touching the images: same URLs, files still there.
    await saveProfile(db, id, { ...first, bio: "Outra bio." });
    const second = await loadProfile(db, id);
    expect(second?.photo).toBe(first.photo);
    expect(second?.projects[0]?.image).toBe(first.projects[0]?.image);

    // A new photo and no project: both old files go.
    await saveProfile(db, id, { ...first, photo: newImage, projects: [] });
    const third = await loadProfile(db, id);
    expect(third?.photo).not.toBe(first.photo);
    expect(await stored(first.photo)).toBeNull();
    expect(await stored(first.projects[0]?.image ?? "")).toBeNull();
    expect(await stored(third?.photo ?? "")).not.toBeNull();
  });

  it("ignore image URLs that aren't this profile's own", async () => {
    const anaId = await developerAccount("ana@example.com");
    const biaId = await developerAccount("bia@example.com");
    await saveProfile(db, anaId, { ...ana, photo: newImage });
    const anaPhoto = (await loadProfile(db, anaId))?.photo ?? "";

    await saveProfile(db, biaId, { ...ana, photo: anaPhoto });
    expect((await loadProfile(db, biaId))?.photo).toBe("");
    // Ana's photo is untouched.
    expect(await stored(anaPhoto)).not.toBeNull();
  });
});
