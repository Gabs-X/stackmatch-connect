import { and, asc, count, desc, eq, inArray, isNotNull, ne, sql, type SQL } from "drizzle-orm";
import type { CompanySettings } from "@/lib/company-settings";
import {
  applicationStatusFor,
  type CandidateEvent,
  isActiveApplication,
  isFinalStage,
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
import { type ApplicationNotice, sendApplicationNotices } from "./application-notices";
import type { Db } from "./db";
import { lockKeys } from "./db/locks";
import { companyTexts, savedSettings } from "./companies";
import {
  interests,
  jobApplications,
  jobCandidateEvents,
  jobCandidates,
  jobSkills,
  jobs,
  meetingRequests,
  skills,
} from "./db/schema";
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
  // Withdrawn ones don't count.
  const applications = rows.length
    ? await db
        .select({ jobId: jobApplications.jobId, total: count() })
        .from(jobApplications)
        .where(
          and(
            inArray(
              jobApplications.jobId,
              rows.map((row) => row.id),
            ),
            ne(jobApplications.status, "withdrawn"),
          ),
        )
        .groupBy(jobApplications.jobId)
    : [];
  return (await toJobs(db, rows)).map((job) => {
    const counts = Object.fromEntries(jobStages.map((stage) => [stage, 0])) as Record<
      JobStage,
      number
    >;
    for (const row of counted) if (row.jobId === job.id) counts[row.stage] = row.total;
    const applied = applications.find((row) => row.jobId === job.id)?.total ?? 0;
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

/** Records what happened to developers in a company's job (see jobCandidateEvents). */
export async function recordEvents(tx: Tx, events: (typeof jobCandidateEvents.$inferInsert)[]) {
  if (events.length) await tx.insert(jobCandidateEvents).values(events);
}

/** The developer's application for the job, held until the transaction ends; null if none. */
export async function lockApplication(tx: Tx, jobId: string, developerId: string) {
  const [row] = await tx
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.jobId, jobId), eq(jobApplications.developerId, developerId)))
    .for("update");
  return row ?? null;
}

/** The job's applications still waiting on the company. */
const activeApplications = (tx: Tx, jobId: string) =>
  tx
    .select({ id: jobApplications.id, developerId: jobApplications.developerId })
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.jobId, jobId),
        inArray(jobApplications.status, ["submitted", "in_progress"]),
      ),
    );

/** The company's job, held against changes until the transaction ends; null if it has none such. */
async function lockOwnJob(tx: Tx, companyId: string, jobId: string) {
  const [job] = await tx
    .select({ status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
    .for("update");
  return job ?? null;
}

/**
 * Closes or reopens the job; false when the company has no such job. Developers whose application
 * is still waiting see the job closed (or open again) and, on closing, hear it by e-mail.
 */
export async function setJobStatus(
  db: Db,
  companyId: string,
  jobId: string,
  status: JobStatus,
  appUrl: string,
  now = Date.now(),
) {
  const notices = await db.transaction(async (tx) => {
    const job = await lockOwnJob(tx, companyId, jobId);
    if (!job) return null;
    if (job.status === status) return [];
    await tx
      .update(jobs)
      .set({ status, updatedAt: new Date(now) })
      .where(eq(jobs.id, jobId));
    const active = await activeApplications(tx, jobId);
    await recordEvents(
      tx,
      active.map((application) => ({
        jobId,
        companyId,
        developerId: application.developerId,
        applicationId: application.id,
        kind: status === "closed" ? ("job_closed" as const) : ("job_reopened" as const),
        actor: "company" as const,
        visibleToDeveloper: true,
        createdAt: new Date(now),
      })),
    );
    return status === "closed"
      ? active.map((application): ApplicationNotice => ({
          applicationId: application.id,
          kind: "job_closed",
        }))
      : [];
  });
  if (notices === null) return false;
  await sendApplicationNotices(db, notices, appUrl);
  return true;
}

/**
 * Deletes the job, its stages, notes and internal history; the saves, marks and proposals
 * themselves stay, and so do the applications, with the job as they were sent and what their
 * developers saw happen. Those still waiting hear the job is gone, unless it was already closed.
 */
export async function deleteJob(
  db: Db,
  companyId: string,
  jobId: string,
  appUrl: string,
  now = Date.now(),
) {
  const notices = await db.transaction(async (tx) => {
    const job = await lockOwnJob(tx, companyId, jobId);
    if (!job) return [];
    const active = await activeApplications(tx, jobId);
    await tx
      .delete(jobCandidateEvents)
      .where(
        and(eq(jobCandidateEvents.jobId, jobId), eq(jobCandidateEvents.visibleToDeveloper, false)),
      );
    await recordEvents(
      tx,
      active.map((application) => ({
        jobId,
        companyId,
        developerId: application.developerId,
        applicationId: application.id,
        kind: "job_deleted" as const,
        actor: "company" as const,
        visibleToDeveloper: true,
        createdAt: new Date(now),
      })),
    );
    await tx.delete(jobs).where(eq(jobs.id, jobId));
    return job.status === "open"
      ? active.map((application): ApplicationNotice => ({
          applicationId: application.id,
          kind: "job_deleted",
        }))
      : [];
  });
  await sendApplicationNotices(db, notices, appUrl);
}

/**
 * The developers in the job, in the order they were added, with their application and the
 * company's note; null when it isn't the company's.
 */
export async function listCandidates(
  db: Db,
  companyId: string,
  jobId: string,
): Promise<JobCandidate[] | null> {
  if (!(await ownsJob(db, companyId, jobId))) return null;
  const rows = await db
    .select({
      candidate: jobCandidates,
      appliedAt: jobApplications.appliedAt,
      message: jobApplications.message,
      withdrawnAt: jobApplications.withdrawnAt,
    })
    .from(jobCandidates)
    .leftJoin(
      jobApplications,
      and(
        eq(jobApplications.jobId, jobCandidates.jobId),
        eq(jobApplications.developerId, jobCandidates.developerId),
      ),
    )
    .where(eq(jobCandidates.jobId, jobId))
    .orderBy(asc(jobCandidates.createdAt), asc(jobCandidates.developerId));
  return rows.map(({ candidate, appliedAt, message, withdrawnAt }) => ({
    developerId: candidate.developerId,
    stage: candidate.stage,
    stageChangedAt: candidate.stageChangedAt.toISOString(),
    appliedAt: appliedAt?.toISOString() ?? null,
    applicationMessage: message ?? "",
    withdrawnAt: withdrawnAt?.toISOString() ?? null,
    note: candidate.note,
  }));
}

/** Keeps the company's private note on a developer in the job; false when there's no such one. */
export async function setCandidateNote(
  db: Db,
  companyId: string,
  jobId: string,
  developerId: string,
  note: string,
) {
  if (!(await ownsJob(db, companyId, jobId))) return false;
  const updated = await db
    .update(jobCandidates)
    .set({ note })
    .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)))
    .returning({ developerId: jobCandidates.developerId });
  return updated.length > 0;
}

/** The most events a developer's history in a job shows: the latest ones. */
export const candidateHistorySize = 100;

/**
 * What happened to the developer in the company's job, newest first, also after they left it;
 * null when the job isn't the company's.
 */
export async function listCandidateHistory(
  db: Db,
  companyId: string,
  jobId: string,
  developerId: string,
): Promise<CandidateEvent[] | null> {
  if (!(await ownsJob(db, companyId, jobId))) return null;
  const rows = await db
    .select()
    .from(jobCandidateEvents)
    .where(
      and(
        eq(jobCandidateEvents.jobId, jobId),
        eq(jobCandidateEvents.companyId, companyId),
        eq(jobCandidateEvents.developerId, developerId),
      ),
    )
    .orderBy(desc(jobCandidateEvents.createdAt), desc(jobCandidateEvents.id))
    .limit(candidateHistorySize);
  return rows.map((row) => ({
    kind: row.kind,
    fromStage: row.fromStage,
    toStage: row.toStage,
    actor: row.actor,
    at: row.createdAt.toISOString(),
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
 * one. Moving by hand (moveCandidate) is the only way back, and out of a final stage. An
 * application still waiting follows the stage ("in progress" once contacted).
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
    const [before] = await tx
      .select({ stage: jobCandidates.stage })
      .from(jobCandidates)
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)))
      .for("update");
    const [after] = await tx
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
      })
      .returning({ stage: jobCandidates.stage });
    // Already at that stage or past it.
    if (!after) return true;
    const application = await lockApplication(tx, jobId, developerId);
    if (application && isActiveApplication(application.status)) {
      const status = applicationStatusFor(after.stage);
      if (status !== application.status)
        await tx
          .update(jobApplications)
          .set({ status, updatedAt: new Date(now) })
          .where(eq(jobApplications.id, application.id));
    }
    await recordEvents(tx, [
      {
        jobId,
        companyId,
        developerId,
        applicationId: application?.id ?? null,
        kind: before ? "stage_changed" : "added",
        fromStage: before?.stage ?? null,
        toStage: after.stage,
        actor: "system",
        createdAt: new Date(now),
      },
    ]);
    return true;
  });
}

/**
 * Puts a developer already in the job at any stage, by hand; false when there's no such one. Their
 * application, unless withdrawn, follows: a final stage is its outcome, which the developer sees,
 * and hears by e-mail when it ends without them while the job is open. Changes made at once take
 * turns, and a withdrawal waits for them or they for it.
 */
export async function moveCandidate(
  db: Db,
  companyId: string,
  jobId: string,
  developerId: string,
  stage: JobStage,
  appUrl: string,
  now = Date.now(),
) {
  const notices = await db.transaction(async (tx) => {
    const job = await lockJob(tx, jobId);
    if (job?.companyId !== companyId) return null;
    const [current] = await tx
      .select({ stage: jobCandidates.stage })
      .from(jobCandidates)
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)))
      .for("update");
    if (!current) return null;
    if (current.stage === stage) return [];
    await tx
      .update(jobCandidates)
      .set({ stage, stageChangedAt: new Date(now) })
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)));
    const application = await lockApplication(tx, jobId, developerId);
    const notices: ApplicationNotice[] = [];
    let visible = false;
    if (application && application.status !== "withdrawn") {
      const status = applicationStatusFor(stage);
      if (status !== application.status) {
        await tx
          .update(jobApplications)
          .set({ status, updatedAt: new Date(now) })
          .where(eq(jobApplications.id, application.id));
        // An outcome shows in the developer's history; going back into the process only changes
        // the status.
        visible = isFinalStage(stage);
        if (
          (status === "not_advanced" || status === "closed") &&
          isActiveApplication(application.status) &&
          job.status === "open"
        )
          notices.push({ applicationId: application.id, kind: status });
      }
    }
    await recordEvents(tx, [
      {
        jobId,
        companyId,
        developerId,
        applicationId: application?.id ?? null,
        kind: "stage_changed",
        fromStage: current.stage,
        toStage: stage,
        actor: "company",
        visibleToDeveloper: visible,
        createdAt: new Date(now),
      },
    ]);
    return notices;
  });
  if (notices === null) return false;
  await sendApplicationNotices(db, notices, appUrl);
  return true;
}

/**
 * Takes the developer out of the job; their save, mark or proposal stays, and so do their
 * application and history. An application still waiting ends as "not advanced", which the
 * developer hears by e-mail while the job is open.
 */
export async function removeCandidate(
  db: Db,
  companyId: string,
  jobId: string,
  developerId: string,
  appUrl: string,
  now = Date.now(),
) {
  const notices = await db.transaction(async (tx): Promise<ApplicationNotice[]> => {
    const job = await lockJob(tx, jobId);
    if (job?.companyId !== companyId) return [];
    const [removed] = await tx
      .delete(jobCandidates)
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)))
      .returning({ stage: jobCandidates.stage });
    if (!removed) return [];
    const application = await lockApplication(tx, jobId, developerId);
    const ends = application !== null && isActiveApplication(application.status);
    if (application && ends)
      await tx
        .update(jobApplications)
        .set({ status: "not_advanced", updatedAt: new Date(now) })
        .where(eq(jobApplications.id, application.id));
    await recordEvents(tx, [
      {
        jobId,
        companyId,
        developerId,
        applicationId: application?.id ?? null,
        kind: "removed",
        fromStage: removed.stage,
        actor: "company",
        visibleToDeveloper: ends,
        createdAt: new Date(now),
      },
    ]);
    return application && ends && job.status === "open"
      ? [{ applicationId: application.id, kind: "not_advanced" }]
      : [];
  });
  await sendApplicationNotices(db, notices, appUrl);
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
 * sent to developers with a mark or proposal, or as developers applied to them. Translations are kept per account and the ones of
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
    ...(await db
      .select({ job: jobApplications.job })
      .from(jobApplications)
      .where(eq(jobApplications.companyId, companyId))),
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
