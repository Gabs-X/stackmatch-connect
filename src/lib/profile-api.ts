import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  loadProfile,
  loadPublishedProfile,
  loadPublishedProfiles,
  saveProfile,
} from "@/server/profiles";
import { currentUser, database, requireAccount } from "@/server/session";
import { profileInputSchema, type LocalProfile } from "./local-profile";

/** Stands for `GET /me/profile`: the signed-in developer's profile, or null before the first save. */
export const fetchMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  return user?.accountType === "developer" ? loadProfile(await database(), user.id) : null;
});

/** Stands for `PUT /me/profile`. Only developer accounts have a profile. */
export const saveMyProfile = createServerFn({ method: "POST" })
  // Typed as the form state; the schema checks the required fields and options on the server.
  .validator((input: LocalProfile) => profileInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireAccount("developer");
    const db = await database();
    await saveProfile(db, user.id, data);
    return loadProfile(db, user.id);
  });

/** Stands for `GET /profiles`: every published developer profile, as catalog entries. */
export const fetchPublishedProfiles = createServerFn({ method: "GET" }).handler(async () =>
  loadPublishedProfiles(await database()),
);

/** Stands for `GET /profiles/:id`. Profile pages stay open to visitors, for shared links. */
export const fetchPublishedProfile = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data }) => loadPublishedProfile(await database(), data));

export const myProfileQuery = (accountId: string) =>
  queryOptions({ queryKey: ["my-profile", accountId], queryFn: () => fetchMyProfile() });

export const publishedProfilesQuery = queryOptions({
  queryKey: ["profiles"],
  queryFn: () => fetchPublishedProfiles(),
});

export const publishedProfileQuery = (id: string) =>
  queryOptions({
    queryKey: ["profiles", id],
    queryFn: () => fetchPublishedProfile({ data: id }),
  });
