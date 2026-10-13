import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfile, newProject, type LocalProfile } from "./local-profile";
import {
  claimDraft,
  clearDraft,
  draftLifetimeDays,
  draftOwner,
  loadDraft,
  sameProfile,
  writeDraft,
  type DraftImageStore,
  type DraftStores,
} from "./profile-draft";

/** localStorage and IndexedDB stand-ins, counting the images written. */
function memoryStores() {
  const items = new Map<string, string>();
  const images = new Map<string, string>();
  const imageStore: DraftImageStore = {
    get: async (key) => images.get(key),
    put: vi.fn(async (key: string, value: string) => {
      images.set(key, value);
    }),
    keys: async (prefix) => [...images.keys()].filter((key) => key.startsWith(prefix)),
    delete: async (key) => {
      images.delete(key);
    },
  };
  const stores: DraftStores = {
    storage: {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => void items.set(key, value),
      removeItem: (key) => void items.delete(key),
    },
    images: imageStore,
  };
  return { stores, items, images, put: imageStore.put as ReturnType<typeof vi.fn> };
}

const photo = `data:image/jpeg;base64,${"A".repeat(130_000)}`;
const cover = `data:image/jpeg;base64,${"B".repeat(130_000)}`;
const now = Date.parse("2026-10-13T12:00:00Z");

const profile = (fields: Partial<LocalProfile> = {}): LocalProfile => ({
  ...emptyProfile,
  name: "Marina Costa",
  role: "Frontend Developer",
  bio: "Interfaces.",
  photo,
  projects: [newProject({ id: "p1", name: "Painel", image: cover })],
  ...fields,
});

let memory: ReturnType<typeof memoryStores>;
beforeEach(() => {
  memory = memoryStores();
});

describe("profile drafts", () => {
  it("brings back the changes and their images as they were", async () => {
    await writeDraft(
      memory.stores,
      "marina",
      { baseVersion: 3, tabId: "a", profile: profile() },
      now,
    );
    expect(await loadDraft(memory.stores, "marina", now)).toEqual({
      baseVersion: 3,
      savedAt: now,
      tabId: "a",
      profile: profile(),
      imagesMissing: false,
    });
  });

  it("keeps each image once, however many times the texts change, and drops unused ones", async () => {
    for (const bio of ["Um", "Dois", "Três"])
      await writeDraft(
        memory.stores,
        "marina",
        { baseVersion: 1, tabId: "a", profile: profile({ bio }) },
        now,
      );
    expect(memory.put).toHaveBeenCalledTimes(2);
    // The texts don't carry the images.
    const stored = memory.items.get("stackmatch-profile-draft:marina") ?? "";
    expect(stored.length).toBeLessThan(2_000);
    // A new photo replaces the old one in the store.
    const other = `data:image/jpeg;base64,${"C".repeat(1000)}`;
    await writeDraft(
      memory.stores,
      "marina",
      { baseVersion: 1, tabId: "a", profile: profile({ photo: other }) },
      now,
    );
    expect([...memory.images.values()].sort()).toEqual([cover, other].sort());
  });

  it("only gives an account its own draft", async () => {
    await writeDraft(
      memory.stores,
      "marina",
      { baseVersion: 1, tabId: "a", profile: profile() },
      now,
    );
    expect(await loadDraft(memory.stores, "rafael", now)).toBeNull();
    // A draft stored under another account's key isn't taken for its own.
    memory.items.set(
      "stackmatch-profile-draft:rafael",
      memory.items.get("stackmatch-profile-draft:marina") ?? "",
    );
    expect(await loadDraft(memory.stores, "rafael", now)).toBeNull();
    expect(await loadDraft(memory.stores, "marina", now)).not.toBeNull();
  });

  it("forgets a draft older than its lifetime, or one it can't read", async () => {
    await writeDraft(
      memory.stores,
      "marina",
      { baseVersion: 1, tabId: "a", profile: profile() },
      now,
    );
    const later = now + draftLifetimeDays * 86_400_000 + 1;
    expect(await loadDraft(memory.stores, "marina", later)).toBeNull();
    expect(memory.items.size).toBe(0);
    expect(memory.images.size).toBe(0);
    memory.items.set("stackmatch-profile-draft:marina", "{not json");
    expect(await loadDraft(memory.stores, "marina", now)).toBeNull();
    expect(memory.items.size).toBe(0);
  });

  it("keeps the texts when an image doesn't fit, and says so", async () => {
    memory.stores.images.put = async () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(
      await writeDraft(
        memory.stores,
        "marina",
        { baseVersion: 1, tabId: "a", profile: profile() },
        now,
      ),
    ).toBe(true);
    const draft = await loadDraft(memory.stores, "marina", now);
    expect(draft).toMatchObject({
      imagesMissing: true,
      profile: { bio: "Interfaces.", photo: "" },
    });
    expect(draft?.profile.projects[0]).toMatchObject({ name: "Painel", image: "" });
  });

  it("says an image went missing from the store", async () => {
    await writeDraft(
      memory.stores,
      "marina",
      { baseVersion: 1, tabId: "a", profile: profile() },
      now,
    );
    memory.images.clear();
    expect(await loadDraft(memory.stores, "marina", now)).toMatchObject({
      imagesMissing: true,
      profile: { photo: "" },
    });
  });

  it("doesn't fail when there's no room for the texts either", async () => {
    memory.stores.storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(
      await writeDraft(
        memory.stores,
        "marina",
        { baseVersion: 1, tabId: "a", profile: profile() },
        now,
      ),
    ).toBe(false);
  });

  it("keeps saved images as links and tells which tab wrote it last", async () => {
    const saved = profile({ photo: "/uploads/foto.jpg", projects: [] });
    await writeDraft(memory.stores, "marina", { baseVersion: 2, tabId: "b", profile: saved }, now);
    expect(memory.put).not.toHaveBeenCalled();
    expect((await loadDraft(memory.stores, "marina", now))?.profile.photo).toBe(
      "/uploads/foto.jpg",
    );
    expect(draftOwner(memory.stores, "marina")).toBe("b");
    // The tab that recovers it takes it over, keeping its contents.
    claimDraft(memory.stores, "marina", "c");
    expect(draftOwner(memory.stores, "marina")).toBe("c");
    expect((await loadDraft(memory.stores, "marina", now))?.profile).toEqual(saved);
    await clearDraft(memory.stores, "marina");
    expect(draftOwner(memory.stores, "marina")).toBeNull();
  });

  it("compares profiles by their contents, without the saved version", () => {
    const { name, ...rest } = profile();
    expect(sameProfile({ ...profile(), version: 4 } as LocalProfile, { ...rest, name })).toBe(true);
    expect(sameProfile(profile(), profile({ bio: "Outra." }))).toBe(false);
  });
});
