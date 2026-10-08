/**
 * `npm run jobs:notify-published`: tells each company whose jobs went to the job board on their own
 * (drizzle/0028_publish_existing_jobs.sql) which of its open jobs developers can now see, and how
 * to take one out. Only jobs created before the job board shipped count; newer ones were published
 * by the company in the job form.
 *
 * Without --send it only lists who would get what. With --send it e-mails them, once: running it
 * again sends everything again. Reads DATABASE_URL from .env.migrate.local like db:migrate, and
 * needs RESEND_API_KEY, EMAIL_FROM and APP_URL (the site's address, for the link) set.
 */
import { existsSync } from "node:fs";
import { and, asc, eq, lt } from "drizzle-orm";
import { getDb } from "@/server/db";
import { jobs, users } from "@/server/db/schema";
import { loadCompanySettings } from "@/server/companies";
import { toAuthUser } from "@/server/auth";
import { messageEmail, sendEmail } from "@/server/email";

const migrateEnvFile = ".env.migrate.local";
if (existsSync(migrateEnvFile)) process.loadEnvFile(migrateEnvFile);

/** When the job board shipped (commit f68b310): jobs created before it were published for them. */
const jobBoardShipped = new Date("2026-10-08T16:52:33-03:00");

const send = process.argv.includes("--send");
const appUrl = process.env["APP_URL"]?.trim();
if (!appUrl) {
  console.error("Set APP_URL to the site's address, such as https://stackmatch.example.");
  process.exit(1);
}
if (send && (!process.env["RESEND_API_KEY"]?.trim() || !process.env["EMAIL_FROM"]?.trim())) {
  // Without them sendEmail only logs, and nobody would be told.
  console.error("Set RESEND_API_KEY and EMAIL_FROM to send the e-mails.");
  process.exit(1);
}

const db = await getDb();
const rows = await db
  .select({ title: jobs.title, company: users })
  .from(jobs)
  .innerJoin(users, eq(users.id, jobs.companyId))
  .where(and(eq(jobs.listed, true), eq(jobs.status, "open"), lt(jobs.createdAt, jobBoardShipped)))
  .orderBy(asc(jobs.companyId), asc(jobs.createdAt));

const byCompany = new Map<
  string,
  { company: (typeof rows)[number]["company"]; titles: string[] }
>();
for (const row of rows) {
  const entry = byCompany.get(row.company.id) ?? { company: row.company, titles: [] };
  entry.titles.push(row.title);
  byCompany.set(row.company.id, entry);
}

console.log(
  `${byCompany.size} empresa(s), ${rows.length} vaga(s) aberta(s) publicada(s).${send ? "" : " Nada enviado: use --send para enviar."}`,
);
let failed = 0;
for (const { company, titles } of byCompany.values()) {
  const contact = await loadCompanySettings(db, toAuthUser(company));
  const firstName = contact.contactName.split(/\s+/)[0] || contact.contactName;
  const email = messageEmail({
    to: contact.contactEmail,
    subject:
      titles.length === 1
        ? "Sua vaga agora está no mural de vagas do StackMatch"
        : "Suas vagas agora estão no mural de vagas do StackMatch",
    paragraphs: [
      `Olá, ${firstName}!`,
      "O StackMatch ganhou um mural de vagas: desenvolvedores com conta veem as vagas abertas das empresas, com o nome da empresa, e podem se oferecer para elas. Quem se oferece aparece na página da vaga, e você recebe um e-mail com a mensagem da pessoa.",
      titles.length === 1
        ? "A vaga abaixo, que você criou antes do mural, foi publicada nele:"
        : "As vagas abaixo, que você criou antes do mural, foram publicadas nele:",
      // One paragraph each: the HTML version doesn't keep line breaks inside one.
      ...titles.map((title) => `• ${title}`),
      'Se preferir deixar uma vaga só para os desenvolvedores que você contatar, abra a vaga, clique em "Editar" e desmarque "Publicar no mural de vagas". Encerrar a vaga também a tira do mural.',
    ],
    action: { label: "Ver minhas vagas", url: new URL("/jobs", appUrl).href },
    closing: "Equipe StackMatch",
  });
  console.log(`- ${company.companyName ?? ""} <${email.to}>: ${titles.join(", ")}`);
  // The dry run shows the first e-mail whole, to read before sending.
  if (!send) {
    if (company.id === byCompany.keys().next().value)
      console.log(`
  Assunto: ${email.subject}

${email.text.replace(/^/gm, "  ")}
`);
    continue;
  }
  try {
    await sendEmail(email);
  } catch (error) {
    failed++;
    console.error(`  Não enviado para ${email.to}:`, error);
  }
}
if (send) console.log(failed ? `${failed} e-mail(s) não enviado(s).` : "E-mails enviados.");
// The Postgres client keeps its connection open; the work is done.
process.exit(failed ? 1 : 0);
