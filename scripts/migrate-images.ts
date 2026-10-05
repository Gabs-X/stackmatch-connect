/**
 * `npm run images:migrate`: moves profile photos and project covers still stored in the database
 * as data URLs (saved before file storage existed) to file storage, keeping only their URL.
 * Reads DATABASE_URL and BLOB_READ_WRITE_TOKEN from .env.migrate.local, like db:migrate.
 * Running it again does nothing once every image has moved.
 */
import { existsSync } from "node:fs";
import { eq, like } from "drizzle-orm";
import { getDb } from "@/server/db";
import { developerProfiles, projects } from "@/server/db/schema";
import { storeImage } from "@/server/storage";

const migrateEnvFile = ".env.migrate.local";
if (existsSync(migrateEnvFile)) process.loadEnvFile(migrateEnvFile);

// A server database without the Blob token would get images in a local folder nobody serves.
if (
  /^postgres(ql)?:\/\//.test(process.env["DATABASE_URL"] ?? "") &&
  !process.env["BLOB_READ_WRITE_TOKEN"]
) {
  console.error("Set BLOB_READ_WRITE_TOKEN (in .env.migrate.local) to move images to Vercel Blob.");
  process.exit(1);
}

const db = await getDb();
const dataUrl = "data:image/%";

const photos = await db
  .select({ userId: developerProfiles.userId, photo: developerProfiles.photo })
  .from(developerProfiles)
  .where(like(developerProfiles.photo, dataUrl));
for (const { userId, photo } of photos) {
  const url = await storeImage("photos", userId, photo);
  await db
    .update(developerProfiles)
    .set({ photo: url })
    .where(eq(developerProfiles.userId, userId));
}

const covers = await db
  .select({ id: projects.id, developerId: projects.developerId, image: projects.coverImage })
  .from(projects)
  .where(like(projects.coverImage, dataUrl));
for (const { id, developerId, image } of covers) {
  const url = await storeImage("covers", developerId, image);
  await db.update(projects).set({ coverImage: url }).where(eq(projects.id, id));
}

console.log(`Moved ${photos.length} profile photo(s) and ${covers.length} project cover(s).`);
// The Postgres client keeps its connection open; the migration is done.
process.exit(0);
