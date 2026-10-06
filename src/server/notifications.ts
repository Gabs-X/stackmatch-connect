import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { eq } from "drizzle-orm";
import { dictionaries, type Lang } from "@/lib/i18n";
import type { MeetingRequest } from "@/lib/meeting-requests";
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

/** Tells the developer a company marked interest, with a link to their interested companies. */
export async function notifyInterest(
  db: Db,
  companyId: string,
  developerId: string,
  language: Lang,
  appUrl: string,
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
    ...(request.message ? { quote: request.message } : {}),
    closing: t.closing,
    replyTo: request.email,
  });
}

/** The account e-mail of a developer, where their notifications go. */
export async function developerEmail(db: Db, developerId: string) {
  return (await account(db, developerId)).email;
}
