import {
  and,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  not,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { parseLocation } from "@/lib/cities";
import type { Developer } from "@/lib/developers";
import type { Filters } from "@/lib/filters";
import { locationApplies, matchWeights } from "@/lib/job-match";
import type { JobInput } from "@/lib/jobs";
import { localProfileToDeveloper, type LocalProfile } from "@/lib/local-profile";
import type { Db } from "./db";
import { lockKeys } from "./db/locks";
import { isDataUrl, isStorableImage, removeImages, storeImage, type ImageFolder } from "./storage";
import { loadTranslations } from "./translations";
import { developerProfiles, developerSkills, projectSkills, projects, skills } from "./db/schema";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const skillKey = (name: string) => name.trim().toLowerCase();

/**
 * Ids of the named skills, keyed by lowercase name. Names the catalog doesn't have yet are added
 * as typed; a different case of an existing one ("react") reuses it ("React").
 */
export async function skillIds(tx: Tx, names: string[]) {
  // A new skill keeps the first spelling it was given, profile skills before project tech.
  const byKey = new Map<string, string>();
  for (const name of names) if (!byKey.has(skillKey(name))) byKey.set(skillKey(name), name.trim());
  if (!byKey.size) return new Map<string, number>();
  const keys = [...byKey.keys()];
  const find = () =>
    tx
      .select()
      .from(skills)
      .where(inArray(sql`lower(${skills.name})`, keys));
  const known = new Set((await find()).map((row) => skillKey(row.name)));
  const missing = keys.filter((key) => !known.has(key));
  if (missing.length)
    await tx
      .insert(skills)
      .values(missing.map((key) => ({ name: byKey.get(key) ?? key })))
      // Another save may have added the same skill meanwhile.
      .onConflictDoNothing();
  return new Map((await find()).map((row) => [skillKey(row.name), row.id]));
}

/** Skill ids for the names, in order, once each. */
export function uniqueIds(ids: Map<string, number>, names: string[]) {
  return [...new Set(names.flatMap((name) => ids.get(skillKey(name)) ?? []))];
}

/**
 * Holds the developer's profile until the transaction ends: saves, the account's deletion and
 * translation updates take turns on it. A lock by name, so it also covers a profile not created yet.
 */
export const lockProfile = (tx: Tx, userId: string) => lockKeys(tx, [`profile:${userId}`]);

/** The saved profile's version, or 0 when there's none yet. */
async function profileVersion(db: Db | Tx, userId: string) {
  const [row] = await db
    .select({ version: developerProfiles.version })
    .from(developerProfiles)
    .where(eq(developerProfiles.userId, userId));
  return row?.version ?? 0;
}

/**
 * Whether the saved profile is still at `version`, holding it there until the transaction ends;
 * for work done for one version, like its translations, that must not land on a later one.
 */
export async function profileStillAt(tx: Tx, userId: string, version: number) {
  await lockProfile(tx, userId);
  return (await profileVersion(tx, userId)) === version;
}

/** URLs of the images the developer's saved profile uses: the photo and the project covers. */
export async function storedImages(db: Db | Tx, userId: string) {
  const [profile] = await db
    .select({ photo: developerProfiles.photo })
    .from(developerProfiles)
    .where(eq(developerProfiles.userId, userId));
  const covers = await db
    .select({ image: projects.coverImage })
    .from(projects)
    .where(eq(projects.developerId, userId));
  return [profile?.photo ?? "", ...covers.map((cover) => cover.image)].filter(Boolean);
}

export type SaveResult = { version: number } | { error: "conflict" };

/**
 * Creates or replaces the developer's profile, skills and projects. Expects validated input.
 *
 * `baseVersion` is the version the form started from (0 for a profile not created yet): when the
 * profile was saved since, from another tab or device, nothing changes and the answer is
 * "conflict". Left out (seeds, scripts), the save always goes through.
 *
 * Images arrive as data URLs when new and are moved to file storage; the database keeps their URL.
 * A URL is only kept when it's one of the profile's images as saved at that moment, and images the
 * profile no longer uses are deleted once the save went through. A new image must be a JPEG no
 * larger than the browser makes (see isStorableImage), or the save fails. New images that end up
 * unused, because the save failed or was refused, are deleted too.
 */
export async function saveProfile(
  db: Db,
  userId: string,
  input: LocalProfile,
  baseVersion?: number,
): Promise<SaveResult> {
  // Checked before storing any, so a bad one doesn't leave the others behind.
  const images: [ImageFolder, string][] = [
    ["photos", input.photo],
    ...input.projects.map((project): [ImageFolder, string] => ["covers", project.image]),
  ];
  if (images.some(([folder, image]) => isDataUrl(image) && !isStorableImage(folder, image)))
    throw new Error("Invalid image: not a JPEG the form makes");
  // New images go to file storage first, so the transaction never waits on it. Every upload is
  // let finish, so none is left behind when another fails.
  const uploaded: string[] = [];
  const upload = async ([folder, image]: [ImageFolder, string]) => {
    if (!isDataUrl(image)) return image;
    const url = await storeImage(folder, userId, image);
    uploaded.push(url);
    return url;
  };
  const settled = await Promise.allSettled(images.map(upload));
  const failed = settled.find((result) => result.status === "rejected");
  if (failed) {
    await removeImages(uploaded);
    throw failed.reason;
  }
  const [photo = "", ...covers] = settled.map((result) =>
    result.status === "fulfilled" ? result.value : "",
  );
  let outcome: { version: number; unused: string[] } | { error: "conflict" };
  try {
    outcome = await db.transaction(async (tx) => {
      await lockProfile(tx, userId);
      const version = await profileVersion(tx, userId);
      if (baseVersion !== undefined && version !== baseVersion) return { error: "conflict" };
      const previous = await storedImages(tx, userId);
      // A URL that isn't one of the saved profile's images (any more) is dropped.
      const keep = (url: string) => (uploaded.includes(url) || previous.includes(url) ? url : "");
      const profile = {
        ...input,
        photo: keep(photo),
        projects: input.projects.map((project, index) => ({
          ...project,
          image: keep(covers[index] ?? ""),
        })),
      };
      await writeProfile(tx, userId, profile, version + 1);
      const kept = new Set([profile.photo, ...profile.projects.map((project) => project.image)]);
      return { version: version + 1, unused: previous.filter((url) => !kept.has(url)) };
    });
  } catch (error) {
    await removeImages(uploaded);
    throw error;
  }
  if ("error" in outcome) {
    await removeImages(uploaded);
    return outcome;
  }
  // No saved profile uses these now, and a later save can't take them back: it only keeps images
  // of the profile as saved when it holds the lock.
  await removeImages(outcome.unused);
  return { version: outcome.version };
}

async function writeProfile(tx: Tx, userId: string, profile: LocalProfile, version: number) {
  const fields = {
    name: profile.name,
    role: profile.role,
    location: profile.location,
    seniority: profile.seniority,
    workMode: profile.workMode,
    availability: profile.availability,
    hiringTypes: profile.hiringTypes,
    experienceYears: profile.experienceYears,
    bio: profile.bio,
    photo: profile.photo,
    githubUrl: profile.github,
    linkedinUrl: profile.linkedin,
    websiteUrl: profile.website,
    version,
    updatedAt: new Date(),
  };
  await tx
    .insert(developerProfiles)
    .values({ userId, ...fields })
    .onConflictDoUpdate({ target: developerProfiles.userId, set: fields });

  // Skills and projects are saved as a whole list, like the form edits them.
  await tx.delete(developerSkills).where(eq(developerSkills.developerId, userId));
  await tx.delete(projects).where(eq(projects.developerId, userId));

  const ids = await skillIds(tx, [
    ...profile.skills,
    ...profile.projects.flatMap((project) => project.tech),
  ]);
  const skillList = uniqueIds(ids, profile.skills);
  if (skillList.length)
    await tx
      .insert(developerSkills)
      .values(skillList.map((skillId, position) => ({ developerId: userId, skillId, position })));

  for (const [position, project] of profile.projects.entries()) {
    const [row] = await tx
      .insert(projects)
      .values({
        developerId: userId,
        name: project.name,
        description: project.description,
        coverImage: project.image,
        githubUrl: project.github,
        demoUrl: project.demo,
        position,
      })
      .returning({ id: projects.id });
    const tech = uniqueIds(ids, project.tech);
    if (row && tech.length)
      await tx
        .insert(projectSkills)
        .values(tech.map((skillId, index) => ({ projectId: row.id, skillId, position: index })));
  }
}

/** Profiles keyed by account id, in the form's shape; every developer's when `userIds` is omitted. */
async function loadProfiles(db: Db | Tx, userIds?: string[]): Promise<Map<string, LocalProfile>> {
  if (userIds && !userIds.length) return new Map();
  const profileRows = await db
    .select()
    .from(developerProfiles)
    .where(userIds ? inArray(developerProfiles.userId, userIds) : undefined)
    // In the order they were first published, so editing a profile doesn't move it in Discover.
    .orderBy(asc(developerProfiles.createdAt), asc(developerProfiles.userId));
  const ids = profileRows.map((row) => row.userId);
  if (!ids.length) return new Map();

  const [skillRows, projectRows] = await Promise.all([
    db
      .select({ developerId: developerSkills.developerId, name: skills.name })
      .from(developerSkills)
      .innerJoin(skills, eq(developerSkills.skillId, skills.id))
      .where(inArray(developerSkills.developerId, ids))
      .orderBy(asc(developerSkills.position)),
    db
      .select()
      .from(projects)
      .where(inArray(projects.developerId, ids))
      .orderBy(asc(projects.position)),
  ]);
  const techRows = projectRows.length
    ? await db
        .select({ projectId: projectSkills.projectId, name: skills.name })
        .from(projectSkills)
        .innerJoin(skills, eq(projectSkills.skillId, skills.id))
        .where(
          inArray(
            projectSkills.projectId,
            projectRows.map((row) => row.id),
          ),
        )
        .orderBy(asc(projectSkills.position))
    : [];

  const group = <Row, Key>(rows: Row[], key: (row: Row) => Key) => {
    const map = new Map<Key, Row[]>();
    for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
    return map;
  };
  const skillsBy = group(skillRows, (row) => row.developerId);
  const projectsBy = group(projectRows, (row) => row.developerId);
  const techBy = group(techRows, (row) => row.projectId);

  return new Map(
    profileRows.map((row) => [
      row.userId,
      {
        name: row.name,
        role: row.role,
        location: row.location,
        seniority: row.seniority,
        availability: row.availability,
        workMode: row.workMode,
        bio: row.bio,
        photo: row.photo,
        github: row.githubUrl,
        linkedin: row.linkedinUrl,
        website: row.websiteUrl,
        skills: (skillsBy.get(row.userId) ?? []).map((skill) => skill.name),
        experienceYears: row.experienceYears,
        hiringTypes: row.hiringTypes,
        projects: (projectsBy.get(row.userId) ?? []).map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          tech: (techBy.get(project.id) ?? []).map((tech) => tech.name),
          image: project.coverImage,
          github: project.githubUrl,
          demo: project.demoUrl,
        })),
      } satisfies LocalProfile,
    ]),
  );
}

/** The developer's own profile, with the version to send back when saving it (see saveProfile). */
export type SavedProfile = LocalProfile & { version: number };

/** Read under the profile's lock, so the version and the content come from the same save. */
export function loadProfile(db: Db, userId: string): Promise<SavedProfile | null> {
  return db.transaction(async (tx) => {
    await lockProfile(tx, userId);
    const profile = (await loadProfiles(tx, [userId])).get(userId);
    return profile ? { ...profile, version: await profileVersion(tx, userId) } : null;
  });
}

/** The free text of a profile, the part that gets machine-translated (see ./translations). */
export const profileTexts = (profile: Pick<LocalProfile, "role" | "bio" | "projects">) => [
  profile.role,
  profile.bio,
  ...profile.projects.map((project) => project.description),
];

/** Every developer profile companies can find, as catalog entries, with their translations. */
export async function loadPublishedProfiles(db: Db, userIds?: string[]): Promise<Developer[]> {
  const profiles = await loadProfiles(db, userIds);
  const translations = await loadTranslations(
    db,
    [...profiles.keys()],
    [...profiles.values()].flatMap(profileTexts),
  );
  return [...profiles].map(([userId, profile]) => {
    const own = Object.fromEntries(
      profileTexts(profile).flatMap((text) => {
        const translated = translations[text.trim()];
        return translated ? [[text, translated]] : [];
      }),
    );
    const developer = localProfileToDeveloper(profile, userId);
    return Object.keys(own).length ? { ...developer, translations: own } : developer;
  });
}

/** The profile's state, from its location ("Recife, PE" -> "PE"). */
const profileState = sql`upper(trim(substring(${developerProfiles.location} from ',([^,]*)$')))`;

/**
 * Profiles in any of the places: a city with its state ("Recife, PE") or a whole state ("PE").
 * Cities compare without case or surrounding spaces, as the job ranking does.
 */
function inPlaces(places: string[]) {
  const cities = places.filter((place) => parseLocation(place).uf);
  const states = places
    .filter((place) => !parseLocation(place).uf)
    .map((uf) => uf.trim().toUpperCase());
  return or(
    cities.length
      ? inArray(
          sql`lower(trim(${developerProfiles.location}))`,
          cities.map((city) => city.trim().toLowerCase()),
        )
      : undefined,
    states.length ? inArray(profileState, states) : undefined,
  );
}

/**
 * The Discover filters as a condition on developer_profiles. Options inside a group combine with
 * OR; groups combine with AND.
 */
function matchingFilters(db: Db, filters: Filters) {
  return and(
    filters.skills.length
      ? inArray(
          developerProfiles.userId,
          db
            .select({ id: developerSkills.developerId })
            .from(developerSkills)
            .innerJoin(skills, eq(developerSkills.skillId, skills.id))
            .where(inArray(skills.name, filters.skills)),
        )
      : undefined,
    filters.seniority.length ? inArray(developerProfiles.seniority, filters.seniority) : undefined,
    filters.mode.length ? inArray(developerProfiles.workMode, filters.mode) : undefined,
    filters.hiring.length
      ? arrayOverlaps(developerProfiles.hiringTypes, filters.hiring)
      : undefined,
    filters.availability.length
      ? inArray(developerProfiles.availability, filters.availability)
      : undefined,
    filters.places.length ? inPlaces(filters.places) : undefined,
  );
}

/**
 * How much of the job's criteria each profile meets, in the weights of matchJob
 * (src/lib/job-match.ts), as a number to sort by. Each profile is compared with the same job, so
 * the share matchJob shows sorts the same way as this sum.
 */
function rankedMatching(job: JobInput) {
  const lowered = (names: string[]) => names.map((name) => name.trim().toLowerCase());
  const skillShare = (names: string[], weight: number) =>
    names.length
      ? sql`(${weight}::float * (select count(*) from ${developerSkills} inner join ${skills} on ${developerSkills.skillId} = ${skills.id} where ${developerSkills.developerId} = ${developerProfiles.userId} and lower(${skills.name}) in (${sql.join(
          lowered(names).map((name) => sql`${name}`),
          sql`, `,
        )})) / ${names.length})`
      : sql`0`;
  const option = (column: SQL | AnyColumn, accepted: readonly string[], weight: number) =>
    accepted.length
      ? sql`(case when ${inArray(column as AnyColumn, [...accepted])} then ${weight} else 0 end)`
      : sql`0`;
  const { uf } = parseLocation(job.location);
  const parts = [
    skillShare(job.requiredSkills, matchWeights.requiredSkills),
    skillShare(job.desiredSkills, matchWeights.desiredSkills),
    option(developerProfiles.seniority, job.seniority, matchWeights.seniority),
    option(developerProfiles.workMode, job.workModes, matchWeights.workMode),
    job.hiringTypes.length
      ? sql`(case when ${arrayOverlaps(developerProfiles.hiringTypes, [...job.hiringTypes])} then ${matchWeights.hiringTypes} else 0 end)`
      : sql`0`,
    option(developerProfiles.availability, job.availability, matchWeights.availability),
    locationApplies(job)
      ? sql`(case when lower(trim(${developerProfiles.location})) = ${job.location.trim().toLowerCase()} then ${matchWeights.location}::float when ${profileState} = ${uf} then ${matchWeights.location / 2}::float else 0 end)`
      : sql`0`,
  ];
  return sql<number>`(${sql.join(parts, sql` + `)})`;
}

export type ProfileSearch = {
  filters: Filters;
  /** Profiles to leave out: the ones the company had saved when the Discover round began. */
  exclude: string[];
  offset: number;
  limit: number;
  /** A job to rank by: profiles that meet more of it come first (see rankedMatching). */
  rankFor?: JobInput | null;
};

/**
 * A page of the profiles that match the Discover filters, in the order they were first published,
 * or, for a job, best match first (ties in publication order).
 * `total` counts every match outside `exclude`; `hidden`, the matches `exclude` left out.
 */
export async function searchProfiles(
  db: Db,
  { filters, exclude, offset, limit, rankFor = null }: ProfileSearch,
) {
  const matching = matchingFilters(db, filters);
  const excluded = exclude.length ? inArray(developerProfiles.userId, exclude) : sql`false`;
  const [counts] = await db
    .select({
      matching: count(),
      hidden: sql<number>`count(*) filter (where ${excluded})`.mapWith(Number),
    })
    .from(developerProfiles)
    .where(matching);
  const page = await db
    .select({ id: developerProfiles.userId })
    .from(developerProfiles)
    .where(and(matching, not(excluded)))
    .orderBy(
      ...(rankFor ? [desc(rankedMatching(rankFor))] : []),
      asc(developerProfiles.createdAt),
      asc(developerProfiles.userId),
    )
    .offset(offset)
    .limit(limit);
  const hidden = counts?.hidden ?? 0;
  return {
    // Loaded in publication order; put back in the page's, which may rank by a job.
    developers: page.length
      ? (
          await loadPublishedProfiles(
            db,
            page.map((row) => row.id),
          )
        ).sort(
          (a, b) =>
            page.findIndex((row) => row.id === a.id) - page.findIndex((row) => row.id === b.id),
        )
      : [],
    total: (counts?.matching ?? 0) - hidden,
    hidden,
  };
}

export async function loadPublishedProfile(db: Db, userId: string): Promise<Developer | null> {
  return (await loadPublishedProfiles(db, [userId]))[0] ?? null;
}

/**
 * Skills to suggest in the form: the reference catalog plus every skill in use on a profile or
 * project, most used first, then by name. A skill someone typed shows up once a profile with it is
 * saved; one outside the catalog that nobody uses anymore doesn't.
 */
export async function listSkillCatalog(db: Db): Promise<string[]> {
  const uses = db
    .select({ skillId: developerSkills.skillId })
    .from(developerSkills)
    .unionAll(db.select({ skillId: projectSkills.skillId }).from(projectSkills))
    .as("uses");
  const useCount = count(uses.skillId);
  const rows = await db
    .select({ name: skills.name, uses: useCount })
    .from(skills)
    .leftJoin(uses, eq(uses.skillId, skills.id))
    .groupBy(skills.id, skills.name, skills.curated)
    .having(or(gt(useCount, 0), eq(skills.curated, true)));
  // Sorted here: databases order names differently (case, accents); Portuguese rules everywhere.
  const byName = new Intl.Collator("pt-BR", { sensitivity: "base" }).compare;
  return rows.sort((a, b) => b.uses - a.uses || byName(a.name, b.name)).map((row) => row.name);
}
