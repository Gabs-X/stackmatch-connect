import { and, desc, eq } from "drizzle-orm";
import { dictionaries, type Lang } from "@/lib/i18n";
import { jobTexts, type ApplicationInput, type OpenJob } from "@/lib/jobs";
import type { Translations } from "@/lib/translations";
import { toAuthUser } from "./auth";
import { loadCompanySettings } from "./companies";
import type { Db } from "./db";
import { jobCandidates, jobs, meetingRequests, users } from "./db/schema";
import { messageEmail, sendEmail } from "./email";
import { loadJob, toJobs } from "./jobs";
import { companyReachedDeveloper } from "./meetings";
import { developerEmail, jobEmailDetails } from "./notifications";
import { developerExists } from "./saved-talents";
import { loadTranslations } from "./translations";

/**
 * Developers offering themselves for a job. Jobs have no public page: a developer only sees the
 * open jobs of a company that reached them, on that company's page, and can offer themselves for
 * each one once.
 */

/** The company's open jobs, newest first, for a developer it reached; null if it never did. */
export async function listOpenJobsFor(
  db: Db,
  companyId: string,
  developerId: string,
): Promise<{ jobs: OpenJob[]; translations: Translations } | null> {
  if (!(await companyReachedDeveloper(db, companyId, developerId))) return null;
  const rows = await db
    .select({ job: jobs, appliedAt: jobCandidates.appliedAt })
    .from(jobs)
    .leftJoin(
      jobCandidates,
      and(eq(jobCandidates.jobId, jobs.id), eq(jobCandidates.developerId, developerId)),
    )
    .where(and(eq(jobs.companyId, companyId), eq(jobs.status, "open")))
    .orderBy(desc(jobs.createdAt));
  const open: OpenJob[] = (
    await toJobs(
      db,
      rows.map((row) => row.job),
    )
  ).map(({ status: _status, createdAt: _created, updatedAt: _updated, ...job }, index) => ({
    ...job,
    appliedAt: rows[index]?.appliedAt?.toISOString() ?? null,
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
 * Offers the developer for the job: puts them in it (at "saved" when they weren't there yet, or
 * where the company already had them) with their message, and e-mails the company's contact. Only
 * for an open job of a company that reached them, and once per job.
 */
export async function applyToJob(
  db: Db,
  developerId: string,
  { jobId, message }: ApplicationInput,
  appUrl: string,
  now = Date.now(),
): Promise<ApplicationResult> {
  const [job] = await db
    .select({ companyId: jobs.companyId, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (
    !job ||
    job.status !== "open" ||
    !(await companyReachedDeveloper(db, job.companyId, developerId))
  )
    return { error: "unknown-job" };
  if (!(await developerExists(db, developerId))) return { error: "no-profile" };
  const at = new Date(now);
  const [current] = await db
    .select({ appliedAt: jobCandidates.appliedAt })
    .from(jobCandidates)
    .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)))
    .limit(1);
  if (current?.appliedAt) return { error: "already-applied" };
  if (current)
    await db
      .update(jobCandidates)
      .set({ appliedAt: at, applicationMessage: message })
      .where(and(eq(jobCandidates.jobId, jobId), eq(jobCandidates.developerId, developerId)));
  else
    await db.insert(jobCandidates).values({
      jobId,
      developerId,
      stage: "saved",
      stageChangedAt: at,
      createdAt: at,
      appliedAt: at,
      applicationMessage: message,
    });
  try {
    await notifyApplication(db, job.companyId, developerId, jobId, message, appUrl);
  } catch (error) {
    // The offer stands; the company still sees it on the job's page.
    console.error("Job application not e-mailed:", error);
  }
  return { appliedAt: at.toISOString() };
}

/**
 * The language the company last wrote to the developer in (its latest proposal), else Portuguese:
 * the company hears back in it.
 */
async function companyLanguage(db: Db, companyId: string, developerId: string): Promise<Lang> {
  const [latest] = await db
    .select({ language: meetingRequests.language })
    .from(meetingRequests)
    .where(
      and(eq(meetingRequests.companyId, companyId), eq(meetingRequests.developerId, developerId)),
    )
    .orderBy(desc(meetingRequests.sentAt))
    .limit(1);
  return latest?.language ?? "pt";
}

/** Tells the company's contact the developer offered themselves; replies go to the developer. */
async function notifyApplication(
  db: Db,
  companyId: string,
  developerId: string,
  jobId: string,
  message: string,
  appUrl: string,
) {
  const job = await loadJob(db, companyId, jobId);
  const [company] = await db.select().from(users).where(eq(users.id, companyId)).limit(1);
  const [developer] = await db.select().from(users).where(eq(users.id, developerId)).limit(1);
  if (!job || !company || !developer) return;
  const language = await companyLanguage(db, companyId, developerId);
  const contact = await loadCompanySettings(db, toAuthUser(company));
  const translations = await loadTranslations(db, [companyId], jobTexts(job));
  const t = dictionaries[language].applicationEmail;
  const title = translations[job.title]?.[language] ?? job.title;
  await sendEmail(
    messageEmail({
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
  );
}
