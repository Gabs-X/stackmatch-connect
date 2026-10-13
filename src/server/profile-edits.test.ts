import { readdir } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { newProject, type LocalProfile } from "@/lib/local-profile";
import { deleteAccount } from "./account-settings";
import { createAccount } from "./auth";
import type { Db } from "./db";
import { testJpeg } from "./jpeg";
import { loadProfile, profileStillAt, profileTexts, saveProfile } from "./profiles";
import { localImagePath, readLocalImage } from "./storage";
import { createTestDb } from "./test-db";
import { loadTranslations, updateTranslations, type Translator } from "./translations";

// Uploads go through the real storage, except the one a test makes fail.
const uploads = vi.hoisted(() => ({ count: 0, failAt: 0 }));
vi.mock("./storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./storage")>();
  return {
    ...actual,
    storeImage: async (...args: Parameters<typeof actual.storeImage>) => {
      uploads.count += 1;
      if (uploads.count === uploads.failAt) throw new Error("Upload failed");
      return actual.storeImage(...args);
    },
  };
});

let db: Db;
let user: AuthUser;

const ana: LocalProfile = {
  name: "Ana Souza",
  role: "Frontend Developer",
  location: "Recife, PE",
  seniority: "Pleno",
  availability: "Disponível agora",
  workMode: "Remoto",
  bio: "Bio um.",
  photo: "",
  github: "",
  linkedin: "",
  website: "",
  skills: ["React"],
  experienceYears: 4,
  hiringTypes: ["PJ"],
  projects: [],
};

const newImage = `data:image/jpeg;base64,${testJpeg(400, 300).toString("base64")}`;
const exists = async (url: string) =>
  (await readLocalImage(url.slice(localImagePath.length))) !== null;
/** The files in the account's image folder, as the URLs the profile would use. */
const filesIn = async (folder: "photos" | "covers") =>
  (await readdir(path.join(process.env["UPLOADS_DIR"] ?? "", folder, user.id)).catch(() => [])).map(
    (file) => `${localImagePath}${folder}/${user.id}/${file}`,
  );

beforeEach(async () => {
  db = await createTestDb();
  uploads.count = 0;
  uploads.failAt = 0;
  const created = await createAccount(db, {
    accountType: "developer",
    name: "Ana Souza",
    company: "",
    cnpj: "",
    jobTitle: "Frontend Developer",
    email: "ana@example.com",
    password: "segredo123",
    acceptTerms: true,
  });
  if (!created) throw new Error("account not created");
  user = created;
});

async function saved() {
  const profile = await loadProfile(db, user.id);
  if (!profile) throw new Error("no profile");
  return profile;
}

describe("profile saves from two tabs", () => {
  it("refuse the one that started from an older version, changing nothing", async () => {
    await saveProfile(db, user.id, ana, 0);
    const loaded = await saved();
    expect(loaded.version).toBe(1);

    expect(await saveProfile(db, user.id, { ...loaded, bio: "Aba A." }, 1)).toEqual({ version: 2 });
    expect(await saveProfile(db, user.id, { ...loaded, bio: "Aba B." }, 1)).toEqual({
      error: "conflict",
    });
    expect(await saved()).toMatchObject({ bio: "Aba A.", version: 2 });
  });

  it("let only one of two saves made at once go through, the first one too", async () => {
    const first = await Promise.all([
      saveProfile(db, user.id, { ...ana, bio: "A" }, 0),
      saveProfile(db, user.id, { ...ana, bio: "B" }, 0),
    ]);
    expect(first.filter((result) => "version" in result)).toEqual([{ version: 1 }]);
    expect(first.filter((result) => "error" in result)).toHaveLength(1);

    const results = await Promise.all([
      saveProfile(db, user.id, { ...ana, bio: "C" }, 1),
      saveProfile(db, user.id, { ...ana, bio: "D" }, 1),
    ]);
    const winner = results.findIndex((result) => "version" in result);
    expect(results.filter((result) => "error" in result)).toHaveLength(1);
    expect((await saved()).bio).toBe(["C", "D"][winner]);
  });

  it("never delete the photo the saved profile uses, when one keeps it and the other replaces it", async () => {
    await saveProfile(db, user.id, { ...ana, photo: newImage }, 0);
    const loaded = await saved();
    const results = await Promise.all([
      saveProfile(db, user.id, { ...loaded, photo: newImage }, 1),
      saveProfile(db, user.id, { ...loaded, bio: "Mantém a foto." }, 1),
    ]);
    expect(results.filter((result) => "error" in result)).toHaveLength(1);
    const now = await saved();
    expect(await exists(now.photo)).toBe(true);
    // The photo it doesn't use is gone, and so is the new one the refused save had stored.
    expect(await filesIn("photos")).toEqual([now.photo]);
  });

  it("keep exactly the covers the saved projects use, when both change them", async () => {
    await saveProfile(
      db,
      user.id,
      {
        ...ana,
        projects: [
          newProject({ name: "Um", image: newImage }),
          newProject({ name: "Dois", image: newImage }),
        ],
      },
      0,
    );
    const loaded = await saved();
    const [one, two] = loaded.projects;
    if (!one || !two) throw new Error("projects not saved");
    await Promise.all([
      saveProfile(db, user.id, { ...loaded, projects: [{ ...one, image: newImage }, two] }, 1),
      saveProfile(db, user.id, { ...loaded, projects: [one] }, 1),
    ]);
    const used = (await saved()).projects.map((project) => project.image);
    for (const url of used) expect(await exists(url)).toBe(true);
    expect((await filesIn("covers")).sort()).toEqual([...used].sort());
  });
});

describe("a profile save that fails", () => {
  it("leaves no new image behind when one upload fails", async () => {
    uploads.failAt = 2;
    await expect(
      saveProfile(
        db,
        user.id,
        {
          ...ana,
          photo: newImage,
          projects: [
            newProject({ name: "Um", image: newImage }),
            newProject({ name: "Dois", image: newImage }),
          ],
        },
        0,
      ),
    ).rejects.toThrow("Upload failed");
    expect(await loadProfile(db, user.id)).toBeNull();
    expect([...(await filesIn("photos")), ...(await filesIn("covers"))]).toEqual([]);
  });

  it("keeps the saved profile and its images, and drops the new ones, when the database fails", async () => {
    await saveProfile(db, user.id, { ...ana, photo: newImage }, 0);
    const before = await saved();
    await db.execute(sql`
      create function fail_profile_write() returns trigger as $$
      begin raise exception 'profile write failed'; end $$ language plpgsql`);
    await db.execute(sql`
      create trigger fail_profile_write before update on developer_profiles
      for each statement execute function fail_profile_write()`);

    await expect(
      saveProfile(db, user.id, { ...before, photo: newImage, bio: "Nova." }, 1),
    ).rejects.toThrow();
    expect(await saved()).toEqual(before);
    expect(await filesIn("photos")).toEqual([before.photo]);
  });
});

describe("deleting the account during an edit", () => {
  it("leaves none of its images behind, whichever finishes first", async () => {
    await saveProfile(db, user.id, { ...ana, photo: newImage }, 0);
    const loaded = await saved();
    const [save, deletion] = await Promise.allSettled([
      saveProfile(db, user.id, { ...loaded, photo: newImage }, 1),
      deleteAccount(db, user, "segredo123"),
    ]);
    expect(deletion).toEqual({ status: "fulfilled", value: { ok: true } });
    // The save either went first, or found the profile gone.
    if (save.status === "fulfilled") expect(save.value).toEqual(expect.any(Object));
    expect(await loadProfile(db, user.id)).toBeNull();
    expect(await filesIn("photos")).toEqual([]);
  });
});

describe("translations of a profile", () => {
  const translator: Translator = async (texts) =>
    texts.map((text) => ({ pt: text, en: `EN ${text}` }));

  it("aren't stored for a version saved over while they were being made", async () => {
    await saveProfile(db, user.id, ana, 0);
    const v1 = await saved();
    // While v1's texts are with the translator, v2 is saved and translated.
    const slow: Translator = async (texts, signal) => {
      await saveProfile(db, user.id, { ...v1, bio: "Bio dois." }, 1);
      const v2 = await saved();
      await updateTranslations(db, user.id, profileTexts(v2), {
        translator,
        limited: false,
        stillCurrent: (tx) => profileStillAt(tx, user.id, 2),
      });
      return translator(texts, signal);
    };
    await updateTranslations(db, user.id, profileTexts(v1), {
      translator: slow,
      limited: false,
      stillCurrent: (tx) => profileStillAt(tx, user.id, 1),
    });

    const stored = await loadTranslations(db, [user.id], ["Bio um.", "Bio dois."]);
    expect(stored["Bio dois."]).toEqual({ pt: "Bio dois.", en: "EN Bio dois." });
    expect(stored["Bio um."]).toBeUndefined();
  });
});
