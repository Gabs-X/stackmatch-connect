import { and, asc, count, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import type { CompanySettings } from "@/lib/company-settings";
import {
  jobStages,
  maxJobsPerCompany,
  type Job,
  type JobCandidate,
  jobTexts,
  type JobInput,
  type JobSnapshot,
  type JobStage,
  type JobStatus,
  type JobSummary,
  toSnapshot,
} from "@/lib/jobs";
import type { Db } from "./db";
import { lockKeys } from "./db/locks";
import { companyTexts, savedSettings } from "./companies";
import { interests, jobCandidates, jobSkills, jobs, meetingRequests, skills } from "./db/schema";
import { skillIds, uniqueIds, type Tx } from "./profiles";
import { developerExists } from "./saved-talents";
import { loadTranslations, updateTranslations } from "./translations";

type JobRow = typeof jobs.$inferSelect;

/** Rows as the screens use them, with each job's stack split into must-haves and the rest. */
export async function toJobs(db: Db | Tx, rows: JobRow[]): Promise<Job[]> {
  if (!rows.length) return [];
  const stack = await db
    .select({ jobId: jobSkills.jobId, name: skills.name, required: jobSkills.required })
    .from(jobSkills)
    .innerJoin(skills, eq(jobSkills.skillId, skills.id))
    .where(
      inArray(
        jobSkills.jobId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(jobSkills.position));
  return rows.map((row) => {
    const own = stack.filter((skill) => skill.jobId === row.id);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      requiredSkills: own.filter((skill) => skill.required).map((skill) => skill.name),
      desiredSkills: own.filter((skill) => !skill.required).map((skill) => skill.name),
      seniority: row.seniority as Job["seniority"],
      workModes: row.workModes as Job["workModes"],
      hiringTypes: row.hiringTypes as Job["hiringTypes"],
      availability: row.availability as Job["availability"],
      location: row.location,
      compensationMin: row.compensationMin,
      compensationMax: row.compensationMax,
      compensationPeriod: row.compensationPeriod,
      status: row.status,
      listed: row.listed,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

const jobFields = (input: JobInput) => ({
  title: input.title,
  description: input.description,
  seniority: input.seniority,
  workModes: input.workModes,
  hiringTypes: input.hiringTypes,
  availability: input.availability,
  location: input.location,
  compensationMin: input.compensationMin,
  compensationMax: input.compensationMax,
  compensationPeriod: input.compensationPeriod,
  listed: input.listed,
});

/** Replaces the job's stack. A skill listed as both must-have and nice-to-have is a must-have. */
async function writeSkills(tx: Tx, jobId: string, input: JobInput) {
  await tx.delete(jobSkills).where(eq(jobSkills.jobId, jobId));
  const ids = await skillIds(tx, [...input.requiredSkills, ...input.desiredSkills]);
  const required = uniqueIds(ids, input.requiredSkills);
  const desired = uniqueIds(ids, input.desiredSkills).filter((id) => !required.includes(id));
  const rows = [
    ...required.map((skillId) => ({ skillId, required: true })),
    ...desired.map((skillId) => ({ skillId, required: false })),
  ].map((row, position) => ({ ...row, jobId, position }));
  if (rows.length) await tx.insert(jobSkills).values(rows);
}

/**
 * The company's jobs, open ones first, then newest first, with how many are at each stage and how
 * many offered themselves.
 */
export async function listJobs(db: Db, companyId: string): Promise<JobSummary[]> {
  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.companyId, companyId))
    .orderBy(desc(jobs.status), desc(jobs.createdAt));
  const counted = rows.length
    ? await db
        .select({
          jobId: jobCandidates.jobId,
          stage: jobCandidates.stage,
          total: count(),
          applied: count(jobCandidates.appliedAt),
        })
        .from(jobCandidates)
        .where(
          inArray(
            jobCandidates.jobId,
            rows.map((row) => row.id),
          ),
        )
        .groupBy(jobCandidates.jobId, jobCandidates.stage)
    : [];
  return (await toJobs(db, rows)).map((job) => {
    const counts = Object.fromEntries(jobStages.map((stage) => [stage, 0])) as Record<
      JobStage,
      number
    >;
    let applied = 0;
    for (const row of counted)
      if (row.jobId === job.id) {
        counts[row.stage] = row.total;
        applied += row.applied;
      }
    return { ...job, counts, applied };
  });
}

/** The job, if it belongs to the company. */
export async function loadJob(db: Db, companyId: string, jobId: string): Promise<Job | null> {
  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
    .limit(1);
  return row ? ((await toJobs(db, [row]))[0] ?? null) : null;
}

export async function ownsJob(db: Db, companyId: string, jobId: string) {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
    .limit(1);
  return row !== undefined;
}

export type CreateJobResult = { job: Job } | { error: "job-limit" };

/**
 * Creates a job, unless the company already has as many as it may. Expects validated input.
 * Counting and creating are one step under the company's lock, so jobs created at once can't all
 * take the last one allowed.
 */
export async function createJob(
  db: Db,
  companyId: string,
  input: JobInput,
): Promise<CreateJobResult> {
  const id = await db.transaction(async (tx) => {
    await lockKeys(tx, [`jobs:${companyId}`]);
    const [existing] = await tx
      .select({ total: count() })
      .from(jobs)
      .where(eq(jobs.companyId, companyId));
    if ((existing?.total ?? 0) >= maxJobsPerCompany) return null;
    const [row] = await tx
      .insert(jobs)
      .values({ companyId, ...jobFields(input) })
      .returning({ id: jobs.id });
    if (!row) throw new Error("Job not saved.");
    await writeSkills(tx, row.id, input);
    return row.id;
  });
  if (id === null) return { error: "job-limit" };
  const job = await loadJob(db, companyId, id);
  if (!job) throw new Error("Job not saved.");
  return { job };
}

/** Saves the job's new details; null when the company has no such job. */
export async function updateJob(db: Db, companyId: string, jobId: string, input: JobInput) {
  if (!(await ownsJob(db, companyId, jobId))) return null;
  await db.transaction(async (tx) => {
    await tx
      .update(jobs)
      .set({ ...jobFields(input), updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    await writeSkills(tx, jobId, input);
  });
  return loadJob(db, companyId, jobId);
}

/** Closes or reopens the job; false when the company has no such job. */
export async function setJobStatus(db: Db, companyId: string, jobId: string, status: JobStatus) {
  const updated = await db
    .update(jobs)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
    .returning({ id: jobs.id });
  return updated.length > 0;
}

/** Deletes the job and its stages; the saves, marks and proposals themselves stay. */
export async function deleteJob(db: Db, companyId: string, jobId: string) {
  await db.delete(jobs).where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)));
}

/** The developers in the job, in the order they were added; null when it isn't the company's. */
export async function listCandidates(
  db: Db,
  companyId: string,
  jobId: string,
): Promise<JobCandidate[] | null> {
  if (!(await ownsJob(db, companyId, jobId))) return null;
  const rows = await db
    .select()
    .from(jobCandidates)
    .where(eq(jobCandidates.jobId, jobId))
    .orderBy(asc(jobCandidates.createdAt), asc(jobCandidates.developerId));
  return rows.map((row) => ({
    developerId: row.developerId,
    stage: row.stage,
    stageChangedAt: row.stageChangedAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
    applicationMessage: row.applicationMessage,
  }));
}

/**
 * Holds the job's row until the transaction ends, so it can't be closed or deleted while a
 * developer is being put in it; the job's `status`, `listed` and company, or nothing when there's
 * no such job. Closing and deleting wait for the transaction, and it waits for them.
 */
export async function lockJob(tx: Tx, jobId: string) {
  const [job] = await tx
    .select({ companyId: jobs.companyId, status: jobs.status, listed: jobs.listed })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .for("share");
  return job ?? null;
}

/** The stage's place in jobStages, in SQL, to compare stages inside the database (see stageRank). */
const rankOf = (stage: SQL) =>
  sql`array_position(array[${sql.join(
    jobStages.map((name) => sql`${name}`),
    sql`, `,
  )}]::text[], ${stage})`;

/**
 * Adds the developer to the company's job at `stage`, or moves them up to it. Never moves anyone
 * back: proposing a call to someone already "contacted" keeps them there, not at "saved". False
 * when the job isn't the company's or the profile doesn't exist.
 *
 * One statement adds or moves the developer, comparing with the stage they have at that moment, so
 * advances made at once end at the highest of them, and two that both add the developer don't lose
 * one. Moving by hand (moveCandidate) is the only way back.
 */
export async function advanceCandidate(
  db: Db,
  companyId: string,
  jobId: string,
  developerId: string,
  stage: JobStage,
  now = Date.now(),
) {
  if (!(await developerExists(db, developerId))) return false;
  return db.transaction(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (job?.companyId !== companyId) return false;
    await tx
      .insert(jobCandidates)
      .values({
        jobId,
        developerId,
        stage,
        stageChangedAt: new Date(now),
        createdAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: [jobCandidates.jobId, jobCandidates.developerId],
        set: { stage, stageChangedAt: new Date(now) },
        setWhere: sql`${rankOf(sql`${jobCandidates.stage}`)} < ${rankOf(sql`excluded.stage`)}`,
      });
    return true;
  });
}

/** Puts a developer already in the job at any stage, by hand; false when there's no such one. */
export async function moveCandidate(
  db: Db,
  companyId: string,
  jobId: string,
  developerId: string,
  stage: JobStage,
) {
  if (!(await ownsJob(db, companyId, jobId))) return false;
  const moved = await db
    .update(jobCandidates)
    .set({ stage, stageChangedAt: new Date() })
    .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)))
    .returning({ developerId: jobCandidates.developerId });
  return moved.length > 0;
}

/** Takes the developer out of the job; their save, mark or proposal stays. */
export async function removeCandidate(
  db: Db,
  companyId: string,
  jobId: string,
  developerId: string,
) {
  if (!(await ownsJob(db, companyId, jobId))) return;
  await db
    .delete(jobCandidates)
    .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)));
}

/** The job as developers are told about it, with its translated texts; null if not the company's. */
export async function jobSnapshot(db: Db, companyId: string, jobId: string) {
  const job = await loadJob(db, companyId, jobId);
  if (!job) return null;
  const { id: _id, status: _status, createdAt: _created, updatedAt: _updated, ...input } = job;
  const snapshot = toSnapshot(input);
  return {
    snapshot,
    translations: await loadTranslations(db, [companyId], jobTexts(snapshot)),
  };
}

/**
 * Every text of the company that gets translated: its details, its jobs, and the jobs as they were
 * sent to developers with a mark or proposal. Translations are kept per account and the ones of
 * texts not passed are dropped, so all of them go together.
 */
export async function companyAccountTexts(
  db: Db,
  companyId: string,
  settings?: Pick<CompanySettings, "about" | "contactRole"> | null,
) {
  const details = settings === undefined ? await savedSettings(db, companyId) : settings;
  const current = await db
    .select({ title: jobs.title, description: jobs.description })
    .from(jobs)
    .where(eq(jobs.companyId, companyId));
  const sent = [
    ...(await db
      .select({ job: interests.job })
      .from(interests)
      .where(and(eq(interests.companyId, companyId), isNotNull(interests.job)))),
    ...(await db
      .select({ job: meetingRequests.job })
      .from(meetingRequests)
      .where(and(eq(meetingRequests.companyId, companyId), isNotNull(meetingRequests.job)))),
  ].flatMap((row) => (row.job ? [row.job] : []));
  return [
    ...(details ? companyTexts(details) : []),
    ...[...current, ...sent].flatMap((job) => jobTexts(job)),
  ];
}

/** Translates whatever of the company's texts is new; see companyAccountTexts. */
export async function translateCompanyTexts(
  db: Db,
  companyId: string,
  settings?: Pick<CompanySettings, "about" | "contactRole"> | null,
  options?: Parameters<typeof updateTranslations>[3],
) {
  await updateTranslations(
    db,
    companyId,
    await companyAccountTexts(db, companyId, settings),
    options,
  );
}
