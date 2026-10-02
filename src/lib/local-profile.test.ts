import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyProfile,
  loadAccountProfile,
  loadPublishedProfiles,
  loadSavedProfile,
  localProfileToDeveloper,
  newProject,
  profileLink,
  profilesStorageKey,
  saveAccountProfile,
} from "./local-profile";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

/** Stores one account's profile as written by an older or newer version of the app. */
const store = (value: unknown, accountId = "ana") =>
  storage.set(profilesStorageKey, JSON.stringify({ [accountId]: value }));

describe("profileLink", () => {
  it("adds https to bare addresses", () => {
    expect(profileLink("github.com/ana")).toBe("https://github.com/ana");
  });

  it("keeps http and https links", () => {
    expect(profileLink(" http://ana.dev ")).toBe("http://ana.dev/");
  });

  it("rejects empty values and other protocols", () => {
    expect(profileLink("")).toBeUndefined();
    expect(profileLink("javascript:alert(1)")).toBeUndefined();
    expect(profileLink("ftp://files.ana.dev")).toBeUndefined();
  });
});

describe("loadSavedProfile", () => {
  it("returns null when nothing valid is stored", () => {
    expect(loadSavedProfile("ana")).toBeNull();
    storage.set(profilesStorageKey, "{not json");
    expect(loadSavedProfile("ana")).toBeNull();
    store({ name: "Ana" });
    expect(loadSavedProfile("ana")).toBeNull();
  });

  it("upgrades profiles saved before projects had details", () => {
    store({ ...emptyProfile, name: "Ana", role: "Dev", projects: ["Legacy App"] });
    const profile = loadSavedProfile("ana");
    expect(profile?.projects).toHaveLength(1);
    expect(profile?.projects[0]).toMatchObject({
      name: "Legacy App",
      description: "",
      tech: [],
      image: "",
    });
    expect(profile?.projects[0]?.id).toBeTruthy();
  });

  it("adds the work mode field missing from older profiles", () => {
    const { workMode: _workMode, ...older } = emptyProfile;
    store({ ...older, name: "Ana", role: "Dev" });
    expect(loadSavedProfile("ana")?.workMode).toBe("");
  });

  it("maps free-text answers onto catalog values and keeps unknown ones", () => {
    store({
      ...emptyProfile,
      seniority: " pleno ",
      availability: "disponível agora",
      workMode: "REMOTO",
    });
    expect(loadSavedProfile("ana")).toMatchObject({
      seniority: "Pleno",
      availability: "Disponível agora",
      workMode: "Remoto",
    });
    store({ ...emptyProfile, seniority: "Estagiário" });
    expect(loadSavedProfile("ana")?.seniority).toBe("Estagiário");
  });

  it("drops the ownerless profile older versions kept for the whole browser", () => {
    storage.set("stackmatch-profile", JSON.stringify({ ...emptyProfile, name: "Diego" }));
    expect(loadSavedProfile("ana")).toBeNull();
    expect(storage.has("stackmatch-profile")).toBe(false);
  });
});

describe("profiles by account", () => {
  const ana = {
    ...emptyProfile,
    name: "Ana",
    role: "Dev",
    projects: [newProject({ name: "Clinic Booking", tech: ["Vue"] })],
  };

  it("keeps each account's profile apart", () => {
    saveAccountProfile("ana", ana);
    saveAccountProfile("bia", { ...ana, name: "Bia" });
    expect(loadSavedProfile("ana")).toEqual(ana);
    expect(loadSavedProfile("bia")?.name).toBe("Bia");
    expect(loadSavedProfile("caio")).toBeNull();
  });

  it("gives the demo developer its ready-made profile until it saves its own", () => {
    expect(loadAccountProfile("demo-developer")?.name).toBe("Gabriel Botelho");
    expect(loadAccountProfile("ana")).toBeNull();
    saveAccountProfile("demo-developer", { ...ana, name: "Gabriel B." });
    expect(loadAccountProfile("demo-developer")?.name).toBe("Gabriel B.");
  });

  it("publishes every developer account's profile under its account id", () => {
    saveAccountProfile("ana", ana);
    expect(loadPublishedProfiles().map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "demo-developer", name: "Gabriel Botelho" },
      { id: "ana", name: "Ana" },
    ]);
  });
});

describe("newProject", () => {
  it("creates empty projects with unique ids", () => {
    const first = newProject();
    const second = newProject({ name: "Portfolio" });
    expect(first.id).not.toBe(second.id);
    expect(second).toMatchObject({ name: "Portfolio", description: "", github: "", demo: "" });
  });
});

describe("localProfileToDeveloper", () => {
  const developer = localProfileToDeveloper(
    {
      ...emptyProfile,
      name: " Ana Souza ",
      role: "Frontend Developer",
      seniority: "Pleno",
      github: "github.com/anasouza",
      linkedin: "not a link ::",
      projects: [newProject({ name: "Clinic Booking", demo: "clinic.vercel.app", github: "x y" })],
    },
    "ana-account",
  );

  it("identifies the entry by its owner's account", () => {
    expect(developer.id).toBe("ana-account");
    expect(developer.isLocal).toBe(true);
    expect(developer.name).toBe("Ana Souza");
  });

  it("leaves fields the form doesn't collect empty", () => {
    expect(Number.isNaN(developer.rate)).toBe(true);
    expect(developer.hiringTypes).toEqual([]);
  });

  it("uses the GitHub avatar as the photo when a GitHub profile is filled in", () => {
    expect(developer.image).toBe("https://github.com/anasouza.png?size=768");
    expect(localProfileToDeveloper({ ...emptyProfile, name: "Ana" }, "ana").image).toBe("");
  });

  it("keeps only valid links", () => {
    // Typed by the developer, so they open for real instead of showing an example notice.
    expect(developer.links).toEqual({
      github: "https://github.com/anasouza",
      linkedin: "",
      verified: true,
    });
    expect(developer.projects[0]?.links).toEqual({
      github: "",
      demo: "https://clinic.vercel.app/",
    });
  });
});
