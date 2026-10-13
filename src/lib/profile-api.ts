import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  listSkillCatalog,
  loadProfile,
  loadPublishedProfile,
  loadPublishedProfiles,
  profileStillAt,
  profileTexts,
  saveProfile,
  searchProfiles,
  type SavedProfile,
} from "@/server/profiles";
import { loadJob } from "@/server/jobs";
import { loadTranslations, updateTranslations } from "@/server/translations";
import { currentUser, database, requireAccount } from "@/server/session";
import { filtersSchema, type Filters } from "./filters";
import { profileInputSchema, type LocalProfile } from "./local-profile";

/** Stands for `GET /me/profile`: the signed-in developer's profile, or null before the first save. */
export const fetchMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  return user?.accountType === "developer" && user.emailVerified
    ? loadProfile(await database(), user.id)
    : null;
});

/**
 * Stands for `GET /me/profile/translations`: the stored translations of the signed-in developer's
 * texts, for the preview in the profile form. Reads the database only; translating is the save's job.
 */
export const fetchMyTranslations = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  if (user?.accountType !== "developer" || !user.emailVerified) return {};
  const db = await database();
  const profile = await loadProfile(db, user.id);
  return profile ? loadTranslations(db, [user.id], profileTexts(profile)) : {};
});

export type { SavedProfile };

const saveSchema = z.object({
  profile: profileInputSchema,
  /** The version the form started from, 0 for a profile not created yet (see saveProfile). */
  version: z.number().int().min(0),
});

/**
 * The profile as saved; or, when it was saved elsewhere since the form loaded it, `conflict` with
 * that newer profile (null if it was deleted), and nothing changed.
 */
export type SaveProfileResult = { profile: SavedProfile } | { conflict: SavedProfile | null };

/** Stands for `PUT /me/profile`. Only developer accounts have a profile. */
export const saveMyProfile = createServerFn({ method: "POST" })
  // Typed as the form state; the schema checks the required fields and options on the server.
  .validator((input: { profile: LocalProfile; version: number }) => saveSchema.parse(input))
  .handler(async ({ data }): Promise<SaveProfileResult> => {
    const user = await requireAccount("developer");
    const db = await database();
    let saved;
    try {
      saved = await saveProfile(db, user.id, data.profile, data.version);
    } catch (error) {
      // The form only says it couldn't save; the reason goes to the server logs.
      console.error("Profile not saved:", error);
      throw error;
    }
    if ("error" in saved) return { conflict: await loadProfile(db, user.id) };
    const { version } = saved;
    const profile = await loadProfile(db, user.id);
    if (!profile) throw new Error("Profile not saved.");
    // Waits for the translation so the profile shows in both languages right away; a failure only
    // leaves the texts as written. A later save takes over the translations of its own texts.
    await updateTranslations(db, user.id, profileTexts(profile), {
      stillCurrent: (tx) => profileStillAt(tx, user.id, version),
    });
    return { profile };
  });

const ids = z.array(z.string().max(100)).max(2000);

/**
 * Stands for `POST /profiles/search`: a page of the profiles matching the Discover filters. POST
 * because the profiles to leave out can be a long list. Companies only.
 */
export const searchProfilesFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      filters: filtersSchema,
      exclude: ids,
      offset: z.number().int().min(0),
      limit: z.number().int().min(1).max(50),
      /** One of the company's jobs, to put the profiles that meet more of it first. */
      jobId: z.string().min(1).max(200).optional(),
    }),
  )
  .handler(async ({ data: { jobId, ...search } }) => {
    const company = await requireAccount("company");
    const db = await database();
    const job = jobId ? await loadJob(db, company.id, jobId) : null;
    return searchProfiles(db, { ...search, rankFor: job });
  });

/** Stands for `POST /profiles/by-id`: the named profiles that still exist. Companies only. */
export const fetchProfilesById = createServerFn({ method: "POST" })
  .validator(ids)
  .handler(async ({ data }) => {
    await requireAccount("company");
    return loadPublishedProfiles(await database(), data);
  });

/** Stands for `GET /profiles/:id`. Profile pages stay open to visitors, for shared links. */
export const fetchPublishedProfile = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data }) => loadPublishedProfile(await database(), data));

/** Skills already in use on StackMatch, most used first, to suggest while typing one. */
export const fetchSkillCatalog = createServerFn({ method: "GET" }).handler(async () =>
  listSkillCatalog(await database()),
);

export const skillCatalogQuery = queryOptions({
  queryKey: ["skill-catalog"],
  queryFn: () => fetchSkillCatalog(),
  staleTime: 5 * 60 * 1000,
});

export const myProfileQuery = (accountId: string) =>
  queryOptions({ queryKey: ["my-profile", accountId], queryFn: () => fetchMyProfile() });

export const myTranslationsQuery = (accountId: string) =>
  queryOptions({
    queryKey: ["my-translations", accountId],
    queryFn: () => fetchMyTranslations(),
  });

/** Every query on published profiles starts with this key, to refresh them all after a save. */
export const profilesQueryKey = ["profiles"];

export const discoverPageSize = 20;

/** Discover's profiles, a page at a time: see searchProfiles. */
export const discoverQuery = (filters: Filters, exclude: readonly string[], jobId?: string) =>
  infiniteQueryOptions({
    queryKey: [...profilesQueryKey, "search", filters, exclude, jobId ?? null],
    queryFn: ({ pageParam }) =>
      searchProfilesFn({
        data: {
          filters,
          exclude: [...exclude],
          offset: pageParam,
          limit: discoverPageSize,
          ...(jobId ? { jobId } : {}),
        },
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.developers.length, 0);
      return last.developers.length && loaded < last.total ? loaded : undefined;
    },
  });

/** The named profiles that still exist, with the ids asked for, to tell missing ones apart. */
export const profilesByIdQuery = (ids: readonly string[]) =>
  queryOptions({
    queryKey: [...profilesQueryKey, "by-id", ids],
    queryFn: async () => ({
      ids,
      developers: ids.length ? await fetchProfilesById({ data: [...ids] }) : [],
    }),
  });

export const publishedProfileQuery = (id: string) =>
  queryOptions({
    queryKey: ["profiles", id],
    queryFn: () => fetchPublishedProfile({ data: id }),
  });
