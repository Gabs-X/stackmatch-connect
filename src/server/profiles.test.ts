import { readdir } from "node:fs/promises";
import path from "node:path";
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
import { testJpeg } from "./jpeg";
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
  hiringTypes: ["PJ", "CLT"],
  github: "https://github.com/anasouza",
  projects: [
    newProject({ name: "Clinic Booking", tech: ["Vue", "TypeScript"], demo: "clinic.app" }),
    newProject({ name: "Portfolio" }),
  ],
};

/** Skills added by profiles, outside the reference catalog, by name. */
const addedSkills = async () =>
  (await db.select().from(schema.skills))
    .filter((skill) => !skill.curated)
    .map((skill) => skill.name)
    .sort();

/** Project ids are generated on every save, so compare everything else. */
const withoutProjectIds = (profile: LocalProfile | null) =>
  profile && { ...profile, projects: profile.projects.map(({ id: _id, ...project }) => project) };

describe("saveProfile and loadProfile", () => {
  it("round-trip the form's profile, keeping the order of skills and projects", async () => {
    const id = await developerAccount("ana@example.com");
    expect(await loadProfile(db, id)).toBeNull();

    await saveProfile(db, id, ana);
    expect(withoutProjectIds(await loadProfile(db, id))).toEqual({
      ...withoutProjectIds(ana),
      version: 1,
    });
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
    // React and TypeScript come from the catalog; only Vue was new, and it was added once.
    expect(await addedSkills()).toEqual(["Vue"]);
  });

  it("keep answers left blank empty", async () => {
    const id = await developerAccount("ana@example.com");
    await saveProfile(db, id, { ...ana, experienceYears: null, hiringTypes: [] });
    expect(await loadProfile(db, id)).toMatchObject({
      experienceYears: null,
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
    expect(withoutProjectIds(await loadProfile(db, seedDeveloperId))).toEqual({
      ...withoutProjectIds(seedDeveloperProfile),
      version: 1,
    });

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
      skills: ["react", "REACT", "Zig"],
      projects: [newProject({ name: "Chat", tech: ["zig", "React"] })],
    });

    expect((await loadProfile(db, biaId))?.skills).toEqual(["React", "Zig"]);
    expect((await loadProfile(db, biaId))?.projects[0]?.tech).toEqual(["Zig", "React"]);
    // A new skill keeps the first spelling it was given.
    expect(await addedSkills()).toEqual(["Zig"]);
  });

  it("starts with a reference catalog beyond development: infrastructure and management", async () => {
    const catalog = await listSkillCatalog(db);
    expect(catalog.length).toBeGreaterThan(200);
    for (const skill of ["React", "Kubernetes", "Terraform", "Observabilidade", "Scrum", "OKRs"])
      expect(catalog).toContain(skill);
    // Nobody uses them yet, so by name.
    expect(catalog.slice(0, 3)).toEqual([".NET", "Acessibilidade web", "Alta disponibilidade"]);
  });

  it("puts skills in use first, most used first, and drops typed ones nobody uses anymore", async () => {
    const anaId = await developerAccount("ana@example.com");
    const biaId = await developerAccount("bia@example.com");
    await saveProfile(db, anaId, { ...ana, skills: ["React", "Go"], projects: [] });
    await saveProfile(db, biaId, { ...ana, skills: ["React", "Typo"], projects: [] });
    expect((await listSkillCatalog(db)).slice(0, 3)).toEqual(["React", "Go", "Typo"]);

    // Bia fixes the typo: it stays in the table but stops being suggested.
    await saveProfile(db, biaId, { ...ana, skills: ["React"], projects: [] });
    const catalog = await listSkillCatalog(db);
    expect(catalog.slice(0, 2)).toEqual(["React", "Go"]);
    expect(catalog).not.toContain("Typo");
  });
});

describe("images", () => {
  const jpeg = testJpeg(400, 300);
  const newImage = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
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
    expect(await stored(saved?.photo ?? "")).toEqual(jpeg);
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

  it("refuse what isn't a JPEG the form makes, without storing anything", async () => {
    const id = await developerAccount("ana@example.com");
    const dataUrl = (bytes: Buffer) => `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const refused = [
      // Not an image at all.
      { photo: dataUrl(Buffer.from("<script>alert(1)</script>")) },
      // Larger than the browser makes: photos are 512×512 at most, covers fit 960×600.
      { photo: dataUrl(testJpeg(513, 513)) },
      {
        photo: newImage,
        projects: [newProject({ name: "Site", image: dataUrl(testJpeg(961, 600)) })],
      },
      // Cut short.
      { photo: dataUrl(testJpeg(400, 300).subarray(0, 12)) },
    ];
    for (const images of refused)
      await expect(saveProfile(db, id, { ...ana, ...images })).rejects.toThrow("Invalid image");
    expect(await loadProfile(db, id)).toBeNull();
    expect(
      await readdir(path.join(process.env["UPLOADS_DIR"] ?? "", "photos", id)).catch(() => []),
    ).toEqual([]);
  });
});
