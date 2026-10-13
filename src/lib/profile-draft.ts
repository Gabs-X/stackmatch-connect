import { z } from "zod";
import { profileSchema, type LocalProfile } from "./local-profile";

/**
 * Unpublished changes to a developer's profile, kept in this browser until they're published or
 * discarded: the texts in localStorage under the account's id, and each new image (a ~100 KB JPEG
 * data URL) once in IndexedDB, by its content, so typing doesn't write the images again. A draft is
 * only offered to the account that wrote it, never published by itself, and expires after
 * draftLifetimeDays. Signing out deletes the account's drafts (see AuthProvider).
 */

export const draftLifetimeDays = 30;

const draftPrefix = "stackmatch-profile-draft:";
const draftKey = (accountId: string) => `${draftPrefix}${accountId}`;
/** How a draft points to one of its images in the image store. */
const imageRef = "draft-image:";

/** Where the images go; IndexedDB in the browser (see indexedDbImages), a Map in tests. */
export type DraftImageStore = {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
};

export type DraftStores = {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  images: DraftImageStore;
};

const storedSchema = z.object({
  accountId: z.string(),
  /** The saved version the changes started from (see saveProfile); 0 before the first save. */
  baseVersion: z.number().int().min(0),
  savedAt: z.number(),
  /** The tab that wrote it last. */
  tabId: z.string(),
  /** Images that couldn't be kept (no room); the form had them, the draft hasn't. */
  imagesDropped: z.boolean(),
  // Images are refs here, not data URLs.
  profile: profileSchema.extend({
    photo: z.string().max(2000),
    projects: z.array(profileSchema.shape.projects.element.extend({ image: z.string().max(2000) })),
  }),
});

export type ProfileDraft = {
  baseVersion: number;
  savedAt: number;
  tabId: string;
  profile: LocalProfile;
  /** Some new images weren't kept: the developer picks them again. */
  imagesMissing: boolean;
};

/** The profile without the saved version the server adds, as the form compares it. */
function withoutVersion(profile: LocalProfile): LocalProfile {
  const { version: _version, ...rest } = profile as LocalProfile & { version?: number };
  return rest;
}

/** Same object, whatever the order of its keys. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}

/** Whether two profiles have the same contents, leaving out the saved version. */
export const sameProfile = (a: LocalProfile, b: LocalProfile) =>
  JSON.stringify(stable(withoutVersion(a))) === JSON.stringify(stable(withoutVersion(b)));

const isNewImage = (value: string) => value.startsWith("data:");

const hashes = new Map<string, string>();
/** A short name for an image's contents, computed once per image. */
async function imageHash(dataUrl: string) {
  const known = hashes.get(dataUrl);
  if (known) return known;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dataUrl));
  const hash = [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (hashes.size > 50) hashes.clear();
  hashes.set(dataUrl, hash);
  return hash;
}

const imageKey = (accountId: string, hash: string) => `${accountId}:${hash}`;

/**
 * Keeps the changes as the account's draft. New images go to the image store only if it doesn't
 * have them yet; the ones the draft no longer uses are deleted. An image that doesn't fit is left
 * out, and the draft says so.
 */
export async function writeDraft(
  stores: DraftStores,
  accountId: string,
  draft: { baseVersion: number; tabId: string; profile: LocalProfile },
  now = Date.now(),
) {
  const existing = new Set(await stores.images.keys(`${accountId}:`).catch(() => []));
  const used = new Set<string>();
  let imagesDropped = false;
  const keep = async (value: string) => {
    if (!isNewImage(value)) return value;
    const key = imageKey(accountId, await imageHash(value));
    if (!existing.has(key))
      try {
        await stores.images.put(key, value);
        existing.add(key);
      } catch {
        imagesDropped = true;
        return "";
      }
    used.add(key);
    return `${imageRef}${key.slice(accountId.length + 1)}`;
  };
  const profile = withoutVersion(draft.profile);
  const photo = await keep(profile.photo);
  const projects = await Promise.all(
    profile.projects.map(async (project) => ({ ...project, image: await keep(project.image) })),
  );
  const stored = {
    accountId,
    baseVersion: draft.baseVersion,
    savedAt: now,
    tabId: draft.tabId,
    imagesDropped,
    profile: { ...profile, photo, projects },
  };
  try {
    stores.storage.setItem(draftKey(accountId), JSON.stringify(stored));
  } catch {
    // No room even for the texts: the form still has them.
    return false;
  }
  await Promise.all(
    [...existing]
      .filter((key) => !used.has(key))
      .map((key) => stores.images.delete(key).catch(() => undefined)),
  );
  return true;
}

/** The account's draft, without its images; null when there's none, it expired or isn't valid. */
function readStored(stores: DraftStores, accountId: string, now: number) {
  let raw: string | null = null;
  try {
    raw = stores.storage.getItem(draftKey(accountId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (
      parsed.success &&
      parsed.data.accountId === accountId &&
      parsed.data.savedAt > now - draftLifetimeDays * 86_400_000
    )
      return parsed.data;
  } catch {
    /* Not a draft of ours. */
  }
  return null;
}

/** The account's draft with its images, or null; an expired or broken one is deleted. */
export async function loadDraft(
  stores: DraftStores,
  accountId: string,
  now = Date.now(),
): Promise<ProfileDraft | null> {
  const stored = readStored(stores, accountId, now);
  if (!stored) {
    await clearDraft(stores, accountId);
    return null;
  }
  let imagesMissing = stored.imagesDropped;
  const restore = async (value: string) => {
    if (!value.startsWith(imageRef)) return value;
    const image = await stores.images
      .get(imageKey(accountId, value.slice(imageRef.length)))
      .catch(() => undefined);
    if (image) return image;
    imagesMissing = true;
    return "";
  };
  const profile: LocalProfile = {
    ...stored.profile,
    photo: await restore(stored.profile.photo),
    projects: await Promise.all(
      stored.profile.projects.map(async (project) => ({
        ...project,
        image: await restore(project.image),
      })),
    ),
  };
  return {
    baseVersion: stored.baseVersion,
    savedAt: stored.savedAt,
    tabId: stored.tabId,
    profile,
    imagesMissing,
  };
}

/** The tab that last wrote the account's draft, or null when there's none. */
export const draftOwner = (stores: DraftStores, accountId: string) =>
  readStored(stores, accountId, Date.now())?.tabId ?? null;

/** Makes this tab the draft's writer, as it recovers it: publishing from here then drops it. */
export function claimDraft(stores: DraftStores, accountId: string, tabId: string) {
  const stored = readStored(stores, accountId, Date.now());
  if (!stored) return;
  try {
    stores.storage.setItem(draftKey(accountId), JSON.stringify({ ...stored, tabId }));
  } catch {
    /* Left as it was; the next write claims it. */
  }
}

/** Deletes the account's draft and its images. */
export async function clearDraft(stores: DraftStores, accountId: string) {
  try {
    stores.storage.removeItem(draftKey(accountId));
  } catch {
    /* Nothing to delete without storage. */
  }
  const keys = await stores.images.keys(`${accountId}:`).catch(() => []);
  await Promise.all(keys.map((key) => stores.images.delete(key).catch(() => undefined)));
}

/** Images in IndexedDB, one store for every account, keyed "<account id>:<hash>". */
export function indexedDbImages(): DraftImageStore {
  let opened: Promise<IDBDatabase> | null = null;
  const open = () =>
    (opened ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("stackmatch-drafts", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("images");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        opened = null;
        reject(request.error ?? new Error("IndexedDB unavailable"));
      };
    }));
  const run = async <T>(
    mode: IDBTransactionMode,
    act: (store: IDBObjectStore) => IDBRequest<T>,
  ) => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("images", mode);
      const request = act(transaction.objectStore("images"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () =>
        reject(transaction.error ?? new Error("IndexedDB request failed"));
    });
  };
  return {
    get: async (key) => (await run("readonly", (store) => store.get(key))) as string | undefined,
    put: async (key, value) => {
      await run("readwrite", (store) => store.put(value, key));
    },
    keys: async (prefix) =>
      (
        await run("readonly", (store) => store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)))
      ).map(String),
    delete: async (key) => {
      await run("readwrite", (store) => store.delete(key));
    },
  };
}

let browserStores: DraftStores | null = null;
/** This browser's stores; null where there's no storage (the server, or storage blocked). */
export function draftStores(): DraftStores | null {
  if (browserStores) return browserStores;
  try {
    if (typeof window === "undefined" || !window.localStorage || !window.indexedDB) return null;
    browserStores = { storage: window.localStorage, images: indexedDbImages() };
    return browserStores;
  } catch {
    return null;
  }
}

/** Deletes the account's drafts from this browser, as it signs out. */
export async function forgetDrafts(accountId: string) {
  const stores = draftStores();
  if (stores) await clearDraft(stores, accountId).catch(() => undefined);
}
