import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where profile photos and project covers live: Vercel Blob when BLOB_READ_WRITE_TOKEN is set
 * (the Blob store connected to the Vercel project), a local folder otherwise. The database keeps
 * only each image's URL.
 */
type Storage = {
  /** Saves a JPEG under the key and returns its public URL. */
  put: (key: string, bytes: Buffer) => Promise<string>;
  remove: (url: string) => Promise<void>;
};

/** Local images are served by the app under this path (src/routes/uploads.$.ts). */
export const localImagePath = "/uploads/";

/** Keys the app creates: folders and a UUID, lowercase, ending in .jpg. Nothing else is served. */
export const isImageKey = (key: string) => /^[a-z]+\/[a-z0-9-]+\/[a-z0-9-]+\.jpg$/.test(key);

const localDir = () => path.resolve(process.env["UPLOADS_DIR"] ?? ".uploads");

const localStorage: Storage = {
  async put(key, bytes) {
    const file = path.join(localDir(), key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return localImagePath + key;
  },
  async remove(url) {
    const key = url.slice(localImagePath.length);
    if (isImageKey(key)) await rm(path.join(localDir(), key), { force: true });
  },
};

/** A local image's bytes, or null when the key isn't one the app made or the file is gone. */
export async function readLocalImage(key: string) {
  if (!isImageKey(key)) return null;
  return readFile(path.join(localDir(), key)).catch(() => null);
}

/**
 * The token's store when BLOB_READ_WRITE_TOKEN is set. Passed explicitly because, on Vercel, the
 * SDK otherwise prefers the deployment's OIDC credentials with BLOB_STORE_ID, which can point to
 * another store connected to the project.
 */
const blobCredentials = () => {
  const token = process.env["BLOB_READ_WRITE_TOKEN"]?.trim();
  return token ? { token } : {};
};

const blobStorage: Storage = {
  async put(key, bytes) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, bytes, {
      access: "public",
      contentType: "image/jpeg",
      ...blobCredentials(),
    });
    return blob.url;
  },
  async remove(url) {
    const { del } = await import("@vercel/blob");
    await del(url, blobCredentials());
  },
};

/** A Blob store is connected: by its read-write token, or by store id with Vercel's OIDC. */
const blobConfigured = () =>
  Boolean(process.env["BLOB_READ_WRITE_TOKEN"]?.trim() || process.env["BLOB_STORE_ID"]?.trim());

function storage(): Storage {
  if (blobConfigured()) return blobStorage;
  // The deployment's file system doesn't keep files between requests.
  if (process.env["NODE_ENV"] === "production")
    throw new Error(
      "No Blob store connected: set BLOB_READ_WRITE_TOKEN (or BLOB_STORE_ID) in production to store images.",
    );
  return localStorage;
}

const dataUrlPrefix = "data:image/jpeg;base64,";

export const isDataUrl = (value: string) => value.startsWith(dataUrlPrefix);

/** Stores an image the form sent as a data URL and returns its URL. */
export function storeImage(folder: string, owner: string, dataUrl: string) {
  const bytes = Buffer.from(dataUrl.slice(dataUrlPrefix.length), "base64");
  const key = `${folder}/${owner.toLowerCase().replace(/[^a-z0-9-]/g, "-")}/${crypto.randomUUID()}.jpg`;
  return storage().put(key, bytes);
}

/** Deletes stored images; one that fails stays behind rather than failing the save. */
export async function removeImages(urls: string[]) {
  await Promise.all(
    urls.map((url) =>
      storage()
        .remove(url)
        .catch((error: unknown) => console.error("Image not removed:", url, error)),
    ),
  );
}
