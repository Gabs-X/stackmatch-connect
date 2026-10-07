import { and, arrayOverlaps, asc, count, eq, gt, inArray, lte, not, or, sql } from "drizzle-orm";
import type { Developer } from "@/lib/developers";
import { maxRate, type Filters } from "@/lib/filters";
import { localProfileToDeveloper, type LocalProfile } from "@/lib/local-profile";
import type { Db } from "./db";
import { isDataUrl, isStorableImage, removeImages, storeImage, type ImageFolder } from "./storage";
import { developerProfiles, developerSkills, projectSkills, projects, skills } from "./db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const skillKey = (name: string) => name.trim().toLowerCase();

/**
 * Ids of the named skills, keyed by lowercase name. Names the catalog doesn't have yet are added
 * as typed; a different case of an existing one ("react") reuses it ("React").
 */
async function skillIds(tx: Tx, names: string[]) {
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
function uniqueIds(ids: Map<string, number>, names: string[]) {
  return [...new Set(names.flatMap((name) => ids.get(skillKey(name)) ?? []))];
}

/** URLs of the images the developer's saved profile uses: the photo and the project covers. */
export async function storedImages(db: Db, userId: string) {
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

/**
 * Creates or replaces the developer's profile, skills and projects. Expects validated input.
 *
 * Images arrive as data URLs when new and are moved to file storage; the database keeps their URL.
 * A URL is only kept when it's already one of this profile's images, and images the profile no
 * longer uses are deleted once the save went through. A new image must be a JPEG no larger than the
 * browser makes (see isStorableImage), or the save fails.
 */
export async function saveProfile(db: Db, userId: string, input: LocalProfile) {
  // Checked before storing any, so a bad one doesn't leave the others behind.
  const images: [ImageFolder, string][] = [
    ["photos", input.photo],
    ...input.projects.map((project): [ImageFolder, string] => ["covers", project.image]),
  ];
  if (images.some(([folder, image]) => isDataUrl(image) && !isStorableImage(folder, image)))
    throw new Error("Invalid image: not a JPEG the form makes");
  const previous = await storedImages(db, userId);
  const uploaded: string[] = [];
  const resolve = async (folder: ImageFolder, image: string) => {
    if (!image) return "";
    if (!isDataUrl(image)) return previous.includes(image) ? image : "";
    const url = await storeImage(folder, userId, image);
    uploaded.push(url);
    return url;
  };
  let profile: LocalProfile;
  try {
    profile = {
      ...input,
      photo: await resolve("photos", input.photo),
      projects: await Promise.all(
        input.projects.map(async (project) => ({
          ...project,
          image: await resolve("covers", project.image),
        })),
      ),
    };
    await writeProfile(db, userId, profile);
  } catch (error) {
    await removeImages(uploaded);
    throw error;
  }
  const kept = new Set([profile.photo, ...profile.projects.map((project) => project.image)]);
  await removeImages(previous.filter((url) => !kept.has(url)));
}

async function writeProfile(db: Db, userId: string, profile: LocalProfile) {
  await db.transaction(async (tx) => {
    const fields = {
      name: profile.name,
      role: profile.role,
      location: profile.location,
      seniority: profile.seniority,
      workMode: profile.workMode,
      availability: profile.availability,
      hiringTypes: profile.hiringTypes,
      experienceYears: profile.experienceYears,
      hourlyRate: profile.rate,
      bio: profile.bio,
      photo: profile.photo,
      githubUrl: profile.github,
      linkedinUrl: profile.linkedin,
      websiteUrl: profile.website,
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
  });
}

/** Profiles keyed by account id, in the form's shape; every developer's when `userIds` is omitted. */
async function loadProfiles(db: Db, userIds?: string[]): Promise<Map<string, LocalProfile>> {
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
        rate: row.hourlyRate,
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

export async function loadProfile(db: Db, userId: string): Promise<LocalProfile | null> {
  return (await loadProfiles(db, [userId])).get(userId) ?? null;
}

/** Every developer profile companies can find, as catalog entries. */
export async function loadPublishedProfiles(db: Db, userIds?: string[]): Promise<Developer[]> {
  const profiles = await loadProfiles(db, userIds);
  return [...profiles].map(([userId, profile]) => localProfileToDeveloper(profile, userId));
}

/**
 * The Discover filters as a condition on developer_profiles. Options inside a group combine with
 * OR; groups combine with AND. The rate filter at its maximum means no limit; below it, profiles
 * without a rate (developers who left it blank) are left out instead of guessed.
 */
function matchingFilters(db: Db, filters: Filters) {
  const rate = filters.rate[0] ?? maxRate;
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
    rate < maxRate ? lte(developerProfiles.hourlyRate, rate) : undefined,
  );
}

export type ProfileSearch = {
  filters: Filters;
  /** Profiles to leave out: the ones the company had saved when the Discover round began. */
  exclude: string[];
  offset: number;
  limit: number;
};

/**
 * A page of the profiles that match the Discover filters, in the order they were first published.
 * `total` counts every match outside `exclude`; `hidden`, the matches `exclude` left out.
 */
export async function searchProfiles(db: Db, { filters, exclude, offset, limit }: ProfileSearch) {
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
    .orderBy(asc(developerProfiles.createdAt), asc(developerProfiles.userId))
    .offset(offset)
    .limit(limit);
  const hidden = counts?.hidden ?? 0;
  return {
    developers: page.length
      ? await loadPublishedProfiles(
          db,
          page.map((row) => row.id),
        )
      : [],
    total: (counts?.matching ?? 0) - hidden,
    hidden,
  };
}

export async function loadPublishedProfile(db: Db, userId: string): Promise<Developer | null> {
  const profile = await loadProfile(db, userId);
  return profile && localProfileToDeveloper(profile, userId);
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
