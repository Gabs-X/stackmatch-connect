import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { eq } from "drizzle-orm";
import { icsFileName, meetingContact, meetingEventFor, toIcs } from "@/lib/calendar";
import { dictionaries, type Lang } from "@/lib/i18n";
import { optionLabel } from "@/lib/option-labels";
import { compensationLabel, type JobSnapshot } from "@/lib/jobs";
import type { MeetingRequest, MeetingSide } from "@/lib/meeting-requests";
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

/**
 * Tells the company's contact that the developer accepted or declined the proposed time. Replies go
 * to the developer, so they can arrange the call.
 */
export function meetingAnswerEmail(
  request: MeetingRequest,
  developerEmail: string,
  language: Lang,
): Email {
  const t = dictionaries[language].meetingAnswerEmail;
  const accepted = request.status === "accepted";
  const day = format(
    new Date(`${request.date}T12:00:00`),
    dictionaries[language].schedule.dateFormat,
    {
      locale: language === "pt" ? ptBR : enUS,
    },
  );
  const when = `${day}, ${dictionaries[language].schedule.at} ${request.time}`;
  const email = messageEmail({
    to: request.email,
    subject: accepted
      ? t.acceptedSubject(request.developerName)
      : t.declinedSubject(request.developerName),
    paragraphs: [
      t.greeting(firstName(request.contactName)),
      accepted ? t.accepted(request.developerName, when) : t.declined(request.developerName, when),
      ...(request.job ? [t.job(request.job.title)] : []),
      accepted ? t.acceptedNext(firstName(request.developerName)) : t.declinedNext,
      ...(accepted ? [dictionaries[language].calendar.attached] : []),
    ],
    closing: t.closing,
    replyTo: developerEmail,
  });
  if (!accepted) return email;
  // The call, ready for the company's calendar, with where to reach the developer.
  return {
    ...email,
    attachments: [calendarAttachment(request, "company", language, developerEmail)],
  };
}

/** "sexta-feira, 2 de outubro, às 10:30", as the proposal e-mails write a time. */
function whenText(date: string, time: string, language: Lang) {
  const t = dictionaries[language].schedule;
  // Noon keeps the day the same in any server time zone.
  const day = format(new Date(`${date}T12:00:00`), t.dateFormat, {
    locale: language === "pt" ? ptBR : enUS,
  });
  return `${day}, ${t.at} ${time}`;
}

/**
 * The calendar file of an accepted call, for the side that receives it, with where to reach the
 * other side: the same contact as its "Add to calendar" button (see meetingContact).
 */
function calendarAttachment(
  request: MeetingRequest,
  side: MeetingSide,
  language: Lang,
  developerEmail: string,
) {
  return {
    filename: icsFileName,
    content: toIcs(
      meetingEventFor(request, side, language, meetingContact(request, side, developerEmail)),
    ),
    contentType: "text/calendar; method=PUBLISH",
  };
}

export type MeetingUpdate =
  | { kind: "rescheduled"; from: { date: string; time: string } }
  | { kind: "canceled" | "accepted" | "declined" };

/**
 * Tells one side what the other did to a call: moved it to another time, canceled it, or (the
 * company, about a time the developer suggested) accepted or declined it. Replies go to the side
 * that acted; the button opens the page where the recipient answers or sees the call.
 */
export function meetingUpdateEmail(
  request: MeetingRequest,
  update: MeetingUpdate,
  /** The side that acted; the e-mail goes to the other one. */
  actor: MeetingSide,
  developerEmail: string,
  language: Lang,
  appUrl: string,
): Email {
  const t = dictionaries[language].meetingUpdateEmail;
  const actorName = actor === "company" ? request.company : request.developerName;
  const toCompany = actor === "developer";
  const when = whenText(request.date, request.time, language);
  const lines = {
    rescheduled: () => [
      t.rescheduled(
        actorName,
        update.kind === "rescheduled" ? whenText(update.from.date, update.from.time, language) : "",
        when,
      ),
      t.rescheduledNext,
    ],
    canceled: () => [t.canceled(actorName, when), t.canceledNext],
    accepted: () => [
      t.accepted(actorName, when),
      t.acceptedNext,
      dictionaries[language].calendar.attached,
    ],
    declined: () => [t.declined(actorName, when), t.declinedNext],
  }[update.kind]();
  const email = messageEmail({
    to: toCompany ? request.email : developerEmail,
    subject: t.subject[update.kind](actorName),
    paragraphs: [
      t.greeting(firstName(toCompany ? request.contactName : request.developerName)),
      lines[0] ?? "",
      ...(request.job ? [t.job(request.job.title)] : []),
      ...lines.slice(1),
    ],
    ...(request.updateMessage && (update.kind === "rescheduled" || update.kind === "canceled")
      ? { quote: request.updateMessage }
      : {}),
    action: {
      label: t.action,
      url: new URL(toCompany ? "/proposals" : "/interests", appUrl).href,
    },
    closing: t.closing,
    replyTo: toCompany ? developerEmail : request.email,
  });
  // Only the company accepts a time here: the developer's calendar gets the call.
  return update.kind === "accepted"
    ? {
        ...email,
        attachments: [calendarAttachment(request, "developer", language, developerEmail)],
      }
    : email;
}

/** The account e-mail of a developer, where their notifications go. */
export async function developerEmail(db: Db, developerId: string) {
  return (await account(db, developerId)).email;
}
