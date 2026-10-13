import { and, desc, eq } from "drizzle-orm";
import { dictionaries, type Lang } from "@/lib/i18n";
import { jobTexts } from "@/lib/jobs";
import { toAuthUser } from "./auth";
import { loadCompanySettings } from "./companies";
import type { Db } from "./db";
import { jobApplications, meetingRequests, users } from "./db/schema";
import { messageEmail, sendEmail } from "./email";
import { loadTranslations } from "./translations";

/**
 * E-mails about applications once they change: the developer hears when theirs ends without them
 * (not advanced, process closed, job closed or deleted), and the company when one is withdrawn.
 * Being hired, the other stages and the company's notes send nothing: those are agreed directly, or
 * the developer already heard of them (contacts and calls have their own e-mails).
 */

export type ApplicationNoticeKind = "not_advanced" | "closed" | "job_closed" | "job_deleted";
export type ApplicationNotice = { applicationId: string; kind: ApplicationNoticeKind };

/** Sends each notice after the change was saved; a failed e-mail doesn't undo the change. */
export async function sendApplicationNotices(db: Db, notices: ApplicationNotice[], appUrl: string) {
  for (const notice of notices)
    try {
      await sendApplicationNotice(db, notice, appUrl);
    } catch (error) {
      console.error("Application notice not e-mailed:", error);
    }
}

async function sendApplicationNotice(
  db: Db,
  { applicationId, kind }: ApplicationNotice,
  appUrl: string,
) {
  const [row] = await db
    .select({ application: jobApplications, developer: users })
    .from(jobApplications)
    .innerJoin(users, eq(users.id, jobApplications.developerId))
    .where(eq(jobApplications.id, applicationId))
    .limit(1);
  if (!row) return;
  const { application, developer } = row;
  const [company] = await db
    .select({ name: users.companyName })
    .from(users)
    .where(eq(users.id, application.companyId))
    .limit(1);
  const language = application.language;
  const translations = await loadTranslations(
    db,
    [application.companyId],
    jobTexts(application.job),
  );
  const title = translations[application.job.title]?.[language] ?? application.job.title;
  const t = dictionaries[language].applicationNotice;
  await sendEmail(
    messageEmail({
      to: developer.email,
      subject: t.subject(title),
      paragraphs: [
        t.greeting(developer.name.split(/\s+/)[0] || developer.name),
        t.body[kind](company?.name ?? "", title),
      ],
      action: { label: t.action, url: new URL("/applications", appUrl).href },
      closing: t.closing,
    }),
  );
}

/** Tells the company's contact the developer withdrew their application; replies go to them. */
export async function sendWithdrawalNotice(db: Db, applicationId: string, appUrl: string) {
  try {
    const [row] = await db
      .select({ application: jobApplications, developer: users })
      .from(jobApplications)
      .innerJoin(users, eq(users.id, jobApplications.developerId))
      .where(eq(jobApplications.id, applicationId))
      .limit(1);
    if (!row) return;
    const { application, developer } = row;
    const [company] = await db
      .select()
      .from(users)
      .where(eq(users.id, application.companyId))
      .limit(1);
    if (!company) return;
    const language = await companyLanguage(db, application.companyId, application.developerId);
    const contact = await loadCompanySettings(db, toAuthUser(company));
    const translations = await loadTranslations(
      db,
      [application.companyId],
      jobTexts(application.job),
    );
    const title = translations[application.job.title]?.[language] ?? application.job.title;
    const t = dictionaries[language].withdrawalEmail;
    await sendEmail(
      messageEmail({
        to: contact.contactEmail,
        subject: t.subject(developer.name, title),
        paragraphs: [
          t.greeting(contact.contactName.split(/\s+/)[0] || contact.contactName),
          t.intro(developer.name, title),
        ],
        ...(application.jobId
          ? {
              action: {
                label: t.action,
                url: new URL(`/jobs/${application.jobId}`, appUrl).href,
              },
            }
          : {}),
        closing: t.closing,
        replyTo: developer.email,
      }),
    );
  } catch (error) {
    // The withdrawal stands; the company still sees it on the job's page.
    console.error("Withdrawal not e-mailed:", error);
  }
}

/**
 * The language the company last wrote to the developer in (its latest proposal), else Portuguese:
 * the company hears back in it.
 */
export async function companyLanguage(
  db: Db,
  companyId: string,
  developerId: string,
): Promise<Lang> {
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
