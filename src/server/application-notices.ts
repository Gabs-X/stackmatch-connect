import { eq } from "drizzle-orm";
import { dictionaries } from "@/lib/i18n";
import { jobTexts } from "@/lib/jobs";
import type { ApplicationUpdate } from "@/lib/notifications";
import { toAuthUser } from "./auth";
import { loadCompanySettings } from "./companies";
import { jobApplications, users } from "./db/schema";
import { messageEmail } from "./email";
import { notify, recipient, type Conn } from "./outbox";
import { loadTranslations } from "./translations";

/**
 * Notifications about applications once they change: the developer hears when theirs ends without
 * them (not advanced, process closed, job closed or deleted), and the company when one is withdrawn.
 * Being hired, the other stages and the company's notes notify nothing: those are agreed directly,
 * or the developer already heard of them (contacts and calls have their own notifications).
 */

export type ApplicationNoticeKind = ApplicationUpdate;
export type ApplicationNotice = { applicationId: string; kind: ApplicationNoticeKind };

/**
 * Records each notice and queues its e-mail, in the transaction that made the change; returns the
 * e-mails for deliverQueued, once it's saved. `now` tells apart a job closed again after reopening.
 */
export async function queueApplicationNotices(
  db: Conn,
  notices: ApplicationNotice[],
  appUrl: string,
  now = Date.now(),
) {
  const queued: (string | null)[] = [];
  for (const notice of notices) queued.push(await queueApplicationNotice(db, notice, appUrl, now));
  return queued;
}

async function queueApplicationNotice(
  db: Conn,
  { applicationId, kind }: ApplicationNotice,
  appUrl: string,
  now: number,
) {
  const [row] = await db
    .select({ application: jobApplications, developer: users })
    .from(jobApplications)
    .innerJoin(users, eq(users.id, jobApplications.developerId))
    .where(eq(jobApplications.id, applicationId))
    .limit(1);
  if (!row) return null;
  const { application, developer } = row;
  const [company] = await db
    .select({ name: users.companyName })
    .from(users)
    .where(eq(users.id, application.companyId))
    .limit(1);
  const language = developer.language;
  const translations = await loadTranslations(
    db,
    [application.companyId],
    jobTexts(application.job),
  );
  const title = translations[application.job.title]?.[language] ?? application.job.title;
  const t = dictionaries[language].applicationNotice;
  return notify(db, {
    userId: developer.id,
    kind: "application_update",
    data: {
      actor: company?.name ?? "",
      job: application.job.title,
      update: kind,
      path: "/applications",
    },
    dedupeKey: `application:${applicationId}:${kind}:${now}`,
    email: messageEmail({
      to: developer.email,
      subject: t.subject(title),
      paragraphs: [
        t.greeting(developer.name.split(/\s+/)[0] || developer.name),
        t.body[kind](company?.name ?? "", title),
      ],
      action: { label: t.action, url: new URL("/applications", appUrl).href },
      closing: t.closing,
    }),
  });
}

/**
 * Tells the company's contact the developer withdrew their application, in the company's language;
 * replies go to the developer. Withdrawing is final, so it notifies once.
 */
export async function queueWithdrawalNotice(db: Conn, applicationId: string, appUrl: string) {
  const [row] = await db
    .select({ application: jobApplications, developer: users })
    .from(jobApplications)
    .innerJoin(users, eq(users.id, jobApplications.developerId))
    .where(eq(jobApplications.id, applicationId))
    .limit(1);
  if (!row) return null;
  const { application, developer } = row;
  const [company] = await db
    .select()
    .from(users)
    .where(eq(users.id, application.companyId))
    .limit(1);
  if (!company) return null;
  const language = (await recipient(db, company.id)).language;
  const contact = await loadCompanySettings(db, toAuthUser(company));
  const translations = await loadTranslations(
    db,
    [application.companyId],
    jobTexts(application.job),
  );
  const title = translations[application.job.title]?.[language] ?? application.job.title;
  const t = dictionaries[language].withdrawalEmail;
  return notify(db, {
    userId: company.id,
    kind: "application_withdrawn",
    data: {
      actor: developer.name,
      job: application.job.title,
      path: application.jobId ? `/jobs/${application.jobId}` : "/jobs",
    },
    dedupeKey: `application:${applicationId}:withdrawn`,
    email: messageEmail({
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
  });
}
