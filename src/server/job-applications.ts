import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { dictionaries } from "@/lib/i18n";
import {
  applicationPageSize,
  applicationStatusFor,
  isActiveApplication,
  isFinalStage,
  jobTexts,
  toSnapshot,
  type ApplicationEvent,
  type ApplicationInput,
  type ApplicationPage,
  type OpenJob,
} from "@/lib/jobs";
import type { Translations } from "@/lib/translations";
import { toAuthUser } from "./auth";
import { loadCompanySettings } from "./companies";
import type { Db } from "./db";
import { queueWithdrawalNotice } from "./application-notices";
import { jobApplications, jobCandidateEvents, jobCandidates, jobs, users } from "./db/schema";
import { messageEmail } from "./email";
import { loadJob, lockJob, recordEvents, toJobs } from "./jobs";
import { companyReachedDeveloper } from "./meetings";
import { developerEmail, jobEmailDetails } from "./notifications";
import { deliverQueued, notify, recipient, type Conn } from "./outbox";
import { developerExists } from "./saved-talents";
import { loadTranslations } from "./translations";

/**
 * Developers offering themselves for a job. A developer sees the open jobs of a company that
 * reached them, on that company's page, and the open jobs companies put in the job board (see
 * job-board.ts); they can
 * offer themselves for each one once. The application is theirs (job_applications): they follow it
 * in My applications and can withdraw it, for good, while it waits on the company.
 */

/** The developer's application for each job, joined to a query on jobs. */
const ownApplication = (developerId: string) =>
  and(eq(jobApplications.jobId, jobs.id), eq(jobApplications.developerId, developerId));

/** The company's open jobs, newest first, for a developer it reached; null if it never did. */
export async function listOpenJobsFor(
  db: Db,
  companyId: string,
  developerId: string,
): Promise<{ jobs: OpenJob[]; translations: Translations } | null> {
  if (!(await companyReachedDeveloper(db, companyId, developerId))) return null;
  const rows = await db
    .select({
      job: jobs,
      appliedAt: jobApplications.appliedAt,
      withdrawnAt: jobApplications.withdrawnAt,
    })
    .from(jobs)
    .leftJoin(jobApplications, ownApplication(developerId))
    .where(and(eq(jobs.companyId, companyId), eq(jobs.status, "open")))
    .orderBy(desc(jobs.createdAt));
  const open: OpenJob[] = (
    await toJobs(
      db,
      rows.map((row) => row.job),
    )
  ).map(({ id, status: _status, createdAt: _created, updatedAt: _updated, ...job }, index) => ({
    ...toSnapshot(job),
    id,
    appliedAt: rows[index]?.appliedAt?.toISOString() ?? null,
    withdrawnAt: rows[index]?.withdrawnAt?.toISOString() ?? null,
  }));
  return {
    jobs: open,
    translations: await loadTranslations(
      db,
      [companyId],
      open.flatMap((job) => jobTexts(job)),
    ),
  };
}

export type ApplicationResult =
  { appliedAt: string } | { error: "unknown-job" | "no-profile" | "already-applied" };

/**
 * Offers the developer for the job: records their application, with the job as it is now, puts
 * them in the job (at "saved" when they weren't there yet, or where the company already had them)
 * and e-mails the company's contact. Only for an open job in the job board or of a company that
 * reached them, and once per job, also after withdrawing.
 *
 * Offers sent at once are recorded once: the application's unique index lets one in, so only that
 * call keeps its message and tells the company; the others are "already-applied". The job stays as
 * it was checked until the offer is saved: closing or deleting it waits, and an offer made after
 * that finds it closed or gone.
 */
export async function applyToJob(
  db: Db,
  developerId: string,
  { jobId, message, language = "pt" }: ApplicationInput,
  appUrl: string,
  now = Date.now(),
): Promise<ApplicationResult> {
  if (!(await developerExists(db, developerId))) return { error: "no-profile" };
  const at = new Date(now);
  type Outcome = { queued: string | null } | { error: "unknown-job" | "already-applied" };
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const job = await lockJob(tx, jobId);
    if (
      !job ||
      job.status !== "open" ||
      (!job.listed && !(await companyReachedDeveloper(tx, job.companyId, developerId)))
    )
      return { error: "unknown-job" };
    const [row] = await tx.select().from(jobs).where(eq(jobs.id, jobId));
    const [current] = row ? await toJobs(tx, [row]) : [];
    if (!current) return { error: "unknown-job" };
    const {
      id: _id,
      status: _status,
      createdAt: _created,
      updatedAt: _updated,
      ...input
    } = current;
    // Already in the job: they stay at the stage the company gave them.
    const [added] = await tx
      .insert(jobCandidates)
      .values({ jobId, developerId, stage: "saved", stageChangedAt: at, createdAt: at })
      .onConflictDoNothing()
      .returning({ stage: jobCandidates.stage });
    const [candidate] = added
      ? [added]
      : await tx
          .select({ stage: jobCandidates.stage })
          .from(jobCandidates)
          .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)));
    const [application] = await tx
      .insert(jobApplications)
      .values({
        jobId,
        companyId: job.companyId,
        developerId,
        job: toSnapshot(input),
        message,
        language,
        status: applicationStatusFor(candidate?.stage ?? "saved"),
        appliedAt: at,
        updatedAt: at,
      })
      .onConflictDoNothing({ target: [jobApplications.jobId, jobApplications.developerId] })
      .returning({ id: jobApplications.id });
    if (!application) return { error: "already-applied" };
    await recordEvents(tx, [
      {
        jobId,
        companyId: job.companyId,
        developerId,
        applicationId: application.id,
        kind: "applied",
        actor: "developer",
        visibleToDeveloper: true,
        createdAt: at,
      },
    ]);
    return {
      queued: await queueApplication(
        tx,
        job.companyId,
        developerId,
        jobId,
        application.id,
        message,
        appUrl,
      ),
    };
  });
  if ("error" in outcome) return { error: outcome.error };
  await deliverQueued(db, [outcome.queued]);
  return { appliedAt: at.toISOString() };
}

/**
 * Tells the company the developer offered themselves, by e-mail to its contact in the company's
 * language; replies go to the developer.
 */
async function queueApplication(
  db: Conn,
  companyId: string,
  developerId: string,
  jobId: string,
  applicationId: string,
  message: string,
  appUrl: string,
) {
  const job = await loadJob(db, companyId, jobId);
  const [company] = await db.select().from(users).where(eq(users.id, companyId)).limit(1);
  const [developer] = await db.select().from(users).where(eq(users.id, developerId)).limit(1);
  if (!job || !company || !developer) return null;
  const language = (await recipient(db, companyId)).language;
  const contact = await loadCompanySettings(db, toAuthUser(company));
  const translations = await loadTranslations(db, [companyId], jobTexts(job));
  const t = dictionaries[language].applicationEmail;
  const title = translations[job.title]?.[language] ?? job.title;
  return notify(db, {
    userId: companyId,
    kind: "application_received",
    data: { actor: developer.name, job: job.title, path: `/jobs/${jobId}` },
    dedupeKey: `application:${applicationId}:received`,
    email: messageEmail({
      to: contact.contactEmail,
      subject: t.subject(developer.name, title),
      paragraphs: [
        t.greeting(contact.contactName.split(/\s+/)[0] || contact.contactName),
        t.intro(developer.name, title),
      ],
      details: jobEmailDetails(job, language, translations),
      ...(message ? { quote: message } : {}),
      action: { label: t.action, url: new URL(`/jobs/${jobId}`, appUrl).href },
      closing: t.closing(developer.name.split(/\s+/)[0] || developer.name),
      replyTo: await developerEmail(db, developerId),
    }),
  });
}

export type WithdrawResult = { ok: true } | { error: "unknown-application" | "not-active" };

/**
 * Withdraws the developer's application, for good, while it waits on the company and the job is
 * open; the company is notified and keeps them in the job, marked as withdrawn. Takes turns with
 * the company's changes to the job and to them in it: whichever comes second sees the first.
 */
export async function withdrawApplication(
  db: Db,
  developerId: string,
  applicationId: string,
  appUrl: string,
  now = Date.now(),
): Promise<WithdrawResult> {
  const own = and(
    eq(jobApplications.id, applicationId),
    eq(jobApplications.developerId, developerId),
  );
  const [found] = await db
    .select({ jobId: jobApplications.jobId })
    .from(jobApplications)
    .where(own);
  if (!found) return { error: "unknown-application" };
  const at = new Date(now);
  const result = await db.transaction(
    async (
      tx,
    ): Promise<{ ok: true; queued: string | null } | Exclude<WithdrawResult, { ok: true }>> => {
      // The job first, as the company's changes take it.
      const job = found.jobId ? await lockJob(tx, found.jobId) : null;
      const [application] = await tx.select().from(jobApplications).where(own).for("update");
      if (!application) return { error: "unknown-application" };
      if (!isActiveApplication(application.status) || job?.status !== "open")
        return { error: "not-active" };
      await tx
        .update(jobApplications)
        .set({ status: "withdrawn", withdrawnAt: at, updatedAt: at })
        .where(eq(jobApplications.id, applicationId));
      await recordEvents(tx, [
        {
          jobId: application.jobId,
          companyId: application.companyId,
          developerId,
          applicationId,
          kind: "withdrawn",
          actor: "developer",
          visibleToDeveloper: true,
          createdAt: at,
        },
      ]);
      return { ok: true, queued: await queueWithdrawalNotice(tx, applicationId, appUrl) };
    },
  );
  if (!("ok" in result)) return result;
  await deliverQueued(db, [result.queued]);
  return { ok: true };
}

/** What the developer sees of an event of their application; null for those they don't. */
function toApplicationEvent(row: typeof jobCandidateEvents.$inferSelect): ApplicationEvent | null {
  const at = row.createdAt.toISOString();
  switch (row.kind) {
    case "applied":
    case "withdrawn":
    case "job_closed":
    case "job_reopened":
    case "job_deleted":
      return { kind: row.kind, at };
    case "removed":
      return { kind: "outcome", outcome: "not_advanced", at };
    case "stage_changed":
      return row.toStage && isFinalStage(row.toStage)
        ? { kind: "outcome", outcome: row.toStage, at }
        : null;
    default:
      return null;
  }
}

/**
 * The developer's applications, newest first, a page at a time: after the one `after` names, when
 * given. Each comes with the job as they applied, the company's name, the status they see and the
 * history they see; never the company's stage or notes.
 */
export async function listMyApplications(
  db: Db,
  developerId: string,
  after?: string,
): Promise<ApplicationPage> {
  const rows = await db
    .select({ application: jobApplications, company: users.companyName, jobStatus: jobs.status })
    .from(jobApplications)
    .innerJoin(users, eq(users.id, jobApplications.companyId))
    .leftJoin(jobs, eq(jobs.id, jobApplications.jobId))
    .where(
      and(
        eq(jobApplications.developerId, developerId),
        after
          ? sql`(${jobApplications.appliedAt}, ${jobApplications.id}) < (select applied_at, id from job_applications where id = ${after} and developer_id = ${developerId})`
          : undefined,
      ),
    )
    .orderBy(desc(jobApplications.appliedAt), desc(jobApplications.id))
    .limit(applicationPageSize + 1);
  const page = rows.slice(0, applicationPageSize);
  const ids = page.map((row) => row.application.id);
  const events = ids.length
    ? await db
        .select()
        .from(jobCandidateEvents)
        .where(
          and(
            inArray(jobCandidateEvents.applicationId, ids),
            eq(jobCandidateEvents.visibleToDeveloper, true),
          ),
        )
        .orderBy(desc(jobCandidateEvents.createdAt), desc(jobCandidateEvents.id))
    : [];
  const applications = page.map(({ application, company, jobStatus }) => ({
    id: application.id,
    job: application.job,
    companyId: application.companyId,
    company: company ?? "",
    message: application.message,
    appliedAt: application.appliedAt.toISOString(),
    withdrawnAt: application.withdrawnAt?.toISOString() ?? null,
    // Waiting on a job that closed or went away.
    status:
      isActiveApplication(application.status) && jobStatus !== "open"
        ? ("job_closed" as const)
        : application.status,
    history: events
      .filter((event) => event.applicationId === application.id)
      .flatMap((event) => toApplicationEvent(event) ?? []),
  }));
  return {
    applications,
    next: rows.length > applicationPageSize ? (page.at(-1)?.application.id ?? null) : null,
    translations: await loadTranslations(
      db,
      [...new Set(applications.map((application) => application.companyId))],
      applications.flatMap((application) => jobTexts(application.job)),
    ),
  };
}
