import { asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Developer } from "@/lib/developers";
import { localProfileToDeveloper, type LocalProfile } from "@/lib/local-profile";
import type { Db } from "./db";
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

/** Creates or replaces the developer's profile, skills and projects. Expects validated input. */
export async function saveProfile(db: Db, userId: string, profile: LocalProfile) {
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
export async function loadPublishedProfiles(db: Db): Promise<Developer[]> {
  const profiles = await loadProfiles(db);
  return [...profiles].map(([userId, profile]) => localProfileToDeveloper(profile, userId));
}

export async function loadPublishedProfile(db: Db, userId: string): Promise<Developer | null> {
  const profile = await loadProfile(db, userId);
  return profile && localProfileToDeveloper(profile, userId);
}

/**
 * Skills in use on any profile or project, most used first, for suggestions in the form. A skill
 * someone typed shows up here once a profile with it is saved; one nobody uses anymore doesn't.
 */
export async function listSkillCatalog(db: Db): Promise<string[]> {
  const uses = db
    .select({ skillId: developerSkills.skillId })
    .from(developerSkills)
    .unionAll(db.select({ skillId: projectSkills.skillId }).from(projectSkills))
    .as("uses");
  const rows = await db
    .select({ name: skills.name, uses: count() })
    .from(skills)
    .innerJoin(uses, eq(uses.skillId, skills.id))
    .groupBy(skills.id, skills.name)
    .orderBy(desc(count()), asc(skills.name));
  return rows.map((row) => row.name);
}
