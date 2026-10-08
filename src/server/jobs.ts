import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import {
  jobStages,
  maxJobsPerCompany,
  stageRank,
  type Job,
  type JobCandidate,
  type JobInput,
  type JobStage,
  type JobStatus,
  type JobSummary,
} from "@/lib/jobs";
import type { Db } from "./db";
import { jobCandidates, jobSkills, jobs, skills } from "./db/schema";
import { skillIds, uniqueIds, type Tx } from "./profiles";
import { developerExists } from "./saved-talents";

type JobRow = typeof jobs.$inferSelect;

/** Rows as the screens use them, with each job's stack split into must-haves and the rest. */
async function toJobs(db: Db | Tx, rows: JobRow[]): Promise<Job[]> {
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

/** The company's jobs, open ones first, then newest first, with how many are at each stage. */
export async function listJobs(db: Db, companyId: string): Promise<JobSummary[]> {
  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.companyId, companyId))
    .orderBy(desc(jobs.status), desc(jobs.createdAt));
  const counted = rows.length
    ? await db
        .select({ jobId: jobCandidates.jobId, stage: jobCandidates.stage, total: count() })
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
    for (const row of counted) if (row.jobId === job.id) counts[row.stage] = row.total;
    return { ...job, counts };
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

/** Creates a job, unless the company already has as many as it may. Expects validated input. */
export async function createJob(
  db: Db,
  companyId: string,
  input: JobInput,
): Promise<CreateJobResult> {
  const [existing] = await db
    .select({ total: count() })
    .from(jobs)
    .where(eq(jobs.companyId, companyId));
  if ((existing?.total ?? 0) >= maxJobsPerCompany) return { error: "job-limit" };
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(jobs)
      .values({ companyId, ...jobFields(input) })
      .returning({ id: jobs.id });
    if (!row) throw new Error("Job not saved.");
    await writeSkills(tx, row.id, input);
    return row.id;
  });
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
  }));
}

/**
 * Adds the developer to the company's job at `stage`, or moves them up to it. Never moves anyone
 * back: proposing a call to someone already "contacted" keeps them there, not at "saved". False
 * when the job isn't the company's or the profile doesn't exist.
 */
export async function advanceCandidate(
  db: Db,
  companyId: string,
  jobId: string,
  developerId: string,
  stage: JobStage,
  now = Date.now(),
) {
  if (!(await ownsJob(db, companyId, jobId)) || !(await developerExists(db, developerId)))
    return false;
  const [current] = await db
    .select({ stage: jobCandidates.stage })
    .from(jobCandidates)
    .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)))
    .limit(1);
  if (!current)
    await db
      .insert(jobCandidates)
      .values({
        jobId,
        developerId,
        stage,
        stageChangedAt: new Date(now),
        createdAt: new Date(now),
      })
      .onConflictDoNothing();
  else if (stageRank(stage) > stageRank(current.stage))
    await db
      .update(jobCandidates)
      .set({ stage, stageChangedAt: new Date(now) })
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)));
  return true;
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
