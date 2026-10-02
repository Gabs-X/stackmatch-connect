import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyProfile,
  loadLocalProfile,
  localDeveloperId,
  localProfileStorageKey,
  localProfileToDeveloper,
  newProject,
  profileLink,
  saveLocalProfile,
} from "./local-profile";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const store = (value: unknown) => storage.set(localProfileStorageKey, JSON.stringify(value));

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

describe("loadLocalProfile", () => {
  it("returns null when nothing valid is stored", () => {
    expect(loadLocalProfile()).toBeNull();
    storage.set(localProfileStorageKey, "{not json");
    expect(loadLocalProfile()).toBeNull();
    store({ name: "Ana" });
    expect(loadLocalProfile()).toBeNull();
  });

  it("upgrades profiles saved before projects had details", () => {
    store({ ...emptyProfile, name: "Ana", role: "Dev", projects: ["Legacy App"] });
    const profile = loadLocalProfile();
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
    expect(loadLocalProfile()?.workMode).toBe("");
  });

  it("maps free-text answers onto catalog values and keeps unknown ones", () => {
    store({
      ...emptyProfile,
      seniority: " pleno ",
      availability: "disponível agora",
      workMode: "REMOTO",
    });
    expect(loadLocalProfile()).toMatchObject({
      seniority: "Pleno",
      availability: "Disponível agora",
      workMode: "Remoto",
    });
    store({ ...emptyProfile, seniority: "Estagiário" });
    expect(loadLocalProfile()?.seniority).toBe("Estagiário");
  });

  it("reads back what saveLocalProfile wrote", () => {
    const profile = {
      ...emptyProfile,
      name: "Ana",
      role: "Dev",
      projects: [newProject({ name: "Clinic Booking", tech: ["Vue"] })],
    };
    saveLocalProfile(profile);
    expect(loadLocalProfile()).toEqual(profile);
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
  const developer = localProfileToDeveloper({
    ...emptyProfile,
    name: " Ana Souza ",
    role: "Frontend Developer",
    seniority: "Pleno",
    github: "github.com/anasouza",
    linkedin: "not a link ::",
    projects: [newProject({ name: "Clinic Booking", demo: "clinic.vercel.app", github: "x y" })],
  });

  it("marks the entry as the local profile", () => {
    expect(developer.id).toBe(localDeveloperId);
    expect(developer.isLocal).toBe(true);
    expect(developer.name).toBe("Ana Souza");
  });

  it("leaves fields the form doesn't collect empty", () => {
    expect(Number.isNaN(developer.rate)).toBe(true);
    expect(developer.hiringTypes).toEqual([]);
  });

  it("uses the GitHub avatar as the photo when a GitHub profile is filled in", () => {
    expect(developer.image).toBe("https://github.com/anasouza.png?size=768");
    expect(localProfileToDeveloper({ ...emptyProfile, name: "Ana" }).image).toBe("");
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
