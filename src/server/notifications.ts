import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { eq } from "drizzle-orm";
import { dictionaries, type Lang } from "@/lib/i18n";
import { optionLabel } from "@/lib/option-labels";
import { compensationLabel, type JobSnapshot } from "@/lib/jobs";
import type { MeetingRequest } from "@/lib/meeting-requests";
import type { Translations } from "@/lib/translations";
import { toAuthUser } from "./auth";
import { loadCompanySettings } from "./companies";
import type { Db } from "./db";
import { users } from "./db/schema";
import { messageEmail, sendEmail, type Email } from "./email";

/**
 * E-mails developers get when a company reaches them. They go out in the language of the company's
 * screen, the one its preview showed, and replies go to the company's contact.
 */
const firstName = (name: string) => name.split(/\s+/)[0] || name;

async function account(db: Db, id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) throw new Error(`No account ${id}`);
  return row;
}

/** The longest part of a job description an e-mail quotes; the rest is on the site. */
const descriptionExcerpt = 400;

/**
 * The main points of a job, for the e-mails sent from it: options, place, pay, stack and the start
 * of the description, in the e-mail's language (the company's text translated when it was).
 */
export function jobEmailDetails(job: JobSnapshot, language: Lang, translations: Translations = {}) {
  const t = dictionaries[language].jobs;
  const text = (value: string) => translations[value]?.[language] ?? value;
  const list = (values: readonly string[]) =>
    values.length ? values.map((value) => optionLabel(value, language)).join(", ") : t.any;
  const money = (value: number) =>
    new Intl.NumberFormat(language === "pt" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  const pay = compensationLabel(job, t, money);
  const description = text(job.description);
  const rows: [string, string][] = [
    [t.form.seniority, list(job.seniority)],
    [t.form.workModes, list(job.workModes) + (job.location ? ` · ${job.location}` : "")],
    [t.form.hiringTypes, list(job.hiringTypes)],
    [t.form.availability, list(job.availability)],
    ...(pay ? [[t.form.compensation, pay] as [string, string]] : []),
    ...(job.requiredSkills.length
      ? [[t.form.requiredSkills, job.requiredSkills.join(", ")] as [string, string]]
      : []),
    ...(job.desiredSkills.length
      ? [[t.form.desiredSkills, job.desiredSkills.join(", ")] as [string, string]]
      : []),
    ...(description
      ? [
          [
            t.form.description,
            description.length > descriptionExcerpt
              ? `${description.slice(0, descriptionExcerpt).trimEnd()}…`
              : description,
          ] as [string, string],
        ]
      : []),
  ];
  return { title: t.emailTitle(text(job.title)), rows };
}

/**
 * Tells the developer a company marked interest, with a link to their interested companies; with
 * the job it came from, when there was one.
 */
export async function notifyInterest(
  db: Db,
  companyId: string,
  developerId: string,
  language: Lang,
  appUrl: string,
  job: { snapshot: JobSnapshot; translations: Translations } | null = null,
) {
  const [developer, company] = await Promise.all([
    account(db, developerId),
    account(db, companyId),
  ]);
  const contact = await loadCompanySettings(db, toAuthUser(company));
  const t = dictionaries[language].interestEmail;
  const companyName = company.companyName ?? "";
  await sendEmail(
    messageEmail({
      to: developer.email,
      subject: t.subject(companyName),
      paragraphs: [
        t.greeting(firstName(developer.name)),
        t.intro(contact.contactName, companyName),
      ],
      details: job ? jobEmailDetails(job.snapshot, language, job.translations) : undefined,
      action: { label: t.action, url: new URL("/interests", appUrl).href },
      closing: t.closing,
      replyTo: contact.contactEmail,
    }),
  );
}

/** The meeting proposal, worded like the preview the company saw before sending. */
export function meetingEmail(
  request: MeetingRequest,
  developerEmail: string,
  language: Lang,
  /** Of the job's texts, when the proposal is about one. */
  translations: Translations = {},
): Email {
  const t = dictionaries[language].schedule;
  // Noon keeps the day the same in any server time zone.
  const day = format(new Date(`${request.date}T12:00:00`), t.dateFormat, {
    locale: language === "pt" ? ptBR : enUS,
  });
  const when = `${day}, ${t.at} ${request.time}`;
  return messageEmail({
    to: developerEmail,
    subject: t.subject(request.company),
    paragraphs: [
      t.greeting(firstName(request.developerName)),
      t.intro(request.contactName, request.company, when),
    ],
    details: request.job ? jobEmailDetails(request.job, language, translations) : undefined,
    ...(request.message ? { quote: request.message } : {}),
    closing: t.closing,
    replyTo: request.email,
  });
}

/** The account e-mail of a developer, where their notifications go. */
export async function developerEmail(db: Db, developerId: string) {
  return (await account(db, developerId)).email;
}
