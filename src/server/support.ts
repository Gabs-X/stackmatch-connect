import { and, count, desc, eq, gt, or } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";
import type {
  AdminTicket,
  AdminTicketList,
  CreateTicketResult,
  TicketCategory,
  TicketFilter,
  TicketInput,
  TicketStatus,
  TicketSummary,
} from "@/lib/support";
import { loadConversation } from "./assistant-conversations";
import type { Db } from "./db";
import { supportTickets, users } from "./db/schema";
import { messageEmail, sendEmail, type Email } from "./email";

/**
 * Support tickets: a person who needs a human (Ada couldn't help, a bug, a locked account) writes
 * from the Support page. The ticket is stored and e-mailed to SUPPORT_EMAIL with Reply-To set to
 * its author, so the team answers from their inbox.
 */
export const ticketWindowMinutes = 60;
export const maxTicketsPerWindow = 5;

const windowMs = ticketWindowMinutes * 60_000;

/** Seconds until another ticket from this IP or account is accepted, or 0 when it may go now. */
export async function ticketLimitFor(
  db: Db,
  ip: string | null,
  userId: string | null,
  now = Date.now(),
) {
  const who = [
    ...(ip ? [eq(supportTickets.ip, ip)] : []),
    ...(userId ? [eq(supportTickets.userId, userId)] : []),
  ];
  if (who.length === 0) return 0;
  const recent = await db
    .select({ createdAt: supportTickets.createdAt })
    .from(supportTickets)
    .where(and(or(...who), gt(supportTickets.createdAt, new Date(now - windowMs))))
    .orderBy(desc(supportTickets.createdAt))
    .limit(maxTicketsPerWindow);
  const oldest = recent.length >= maxTicketsPerWindow ? recent[maxTicketsPerWindow - 1] : undefined;
  return oldest ? Math.ceil((oldest.createdAt.getTime() + windowMs - now) / 1000) : 0;
}

const summary = (row: typeof supportTickets.$inferSelect): TicketSummary => ({
  id: row.id,
  category: row.category,
  subject: row.subject,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

/** The account's tickets, newest first. */
export async function listTickets(db: Db, userId: string): Promise<TicketSummary[]> {
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt), desc(supportTickets.id));
  return rows.map(summary);
}

const categoryNames: Record<TicketCategory, string> = {
  bug: "Problema ou bug",
  account: "Conta e acesso",
  question: "Dúvida",
  suggestion: "Sugestão",
  other: "Outro assunto",
};

/** What the team receives: who wrote, about what, the message and the chat with Ada if attached. */
export function ticketEmail(
  to: string,
  ticket: typeof supportTickets.$inferSelect,
  user: AuthUser | null,
): Email {
  const author = user
    ? `${ticket.name} <${ticket.email}>, conta de ${user.accountType === "developer" ? "desenvolvedor" : "empresa"}${user.emailVerified ? "" : " (e-mail não confirmado)"}`
    : `${ticket.name} <${ticket.email}>, visitante sem login`;
  const chat = ticket.conversation?.length
    ? [
        "Conversa com a Ada anexada:",
        ticket.conversation
          .map((message) => `${message.role === "user" ? "Pessoa" : "Ada"}: ${message.content}`)
          .join("\n\n"),
      ]
    : [];
  return messageEmail({
    to,
    subject: `[Ticket #${ticket.id}] ${categoryNames[ticket.category]}: ${ticket.subject}`,
    paragraphs: [`De: ${author}`, `Assunto: ${ticket.subject}`],
    quote: [ticket.message, ...chat].join("\n\n"),
    closing: "Responda este e-mail para falar com quem abriu o ticket.",
    replyTo: ticket.email,
  });
}

const confirmationCopy = {
  pt: {
    subject: (id: number) => `Recebemos seu ticket #${id}`,
    body: (id: number, subject: string) =>
      `Recebemos seu ticket #${id} ("${subject}"). A equipe do StackMatch vai responder por e-mail.`,
    closing: "Você pode acompanhar seus tickets na página Suporte.",
  },
  en: {
    subject: (id: number) => `We received your ticket #${id}`,
    body: (id: number, subject: string) =>
      `We received your ticket #${id} ("${subject}"). The StackMatch team will reply by e-mail.`,
    closing: "You can follow your tickets on the Support page.",
  },
};

/**
 * Stores the ticket and e-mails the team, then (for confirmed accounts only, so nobody can make
 * the app write to someone else's address) a receipt to the author. An e-mail that fails goes
 * to the log; the ticket stays.
 */
export async function createTicket(
  db: Db,
  input: TicketInput,
  user: AuthUser | null,
  ip: string | null,
  now = Date.now(),
): Promise<CreateTicketResult> {
  const wait = await ticketLimitFor(db, ip, user?.id ?? null, now);
  if (wait > 0) return { error: "rate-limited", retryInSeconds: wait };

  const conversation = user && input.attachConversation ? await loadConversation(db, user.id) : [];
  const [row] = await db
    .insert(supportTickets)
    .values({
      userId: user?.id ?? null,
      name: user?.name ?? input.name,
      email: user?.email ?? input.email,
      category: input.category,
      subject: input.subject,
      message: input.message,
      conversation: conversation.length ? conversation : null,
      ip,
      createdAt: new Date(now),
    })
    .returning();
  if (!row) throw new Error("Ticket not stored.");

  const team = process.env["SUPPORT_EMAIL"]?.trim();
  if (team) {
    try {
      await sendEmail(ticketEmail(team, row, user));
    } catch (error) {
      console.error(`Ticket #${row.id} stored, but its e-mail to the team failed:`, error);
    }
  } else {
    console.warn(`Ticket #${row.id} stored; set SUPPORT_EMAIL so the team receives tickets.`);
  }

  if (user?.emailVerified) {
    const copy = confirmationCopy[input.language];
    try {
      await sendEmail(
        messageEmail({
          to: row.email,
          subject: copy.subject(row.id),
          paragraphs: [copy.body(row.id, row.subject)],
          closing: copy.closing,
          ...(team ? { replyTo: team } : {}),
        }),
      );
    } catch (error) {
      console.error(`Ticket #${row.id}: the receipt to its author failed:`, error);
    }
  }
  return { ticket: summary(row) };
}

/** The most tickets the admin page loads at once, newest first. */
export const adminTicketLimit = 200;

/** Tickets for the admin page, with how many are open and closed. */
export async function listAdminTickets(db: Db, filter: TicketFilter): Promise<AdminTicketList> {
  const rows = await db
    .select({ ticket: supportTickets, accountType: users.accountType })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.userId))
    .where(filter === "all" ? undefined : eq(supportTickets.status, filter))
    .orderBy(desc(supportTickets.createdAt), desc(supportTickets.id))
    .limit(adminTicketLimit);
  const totals = await db
    .select({ status: supportTickets.status, total: count() })
    .from(supportTickets)
    .groupBy(supportTickets.status);
  const counts: Record<TicketStatus, number> = { open: 0, closed: 0 };
  for (const { status, total } of totals) counts[status] = total;
  return {
    counts,
    tickets: rows.map(({ ticket, accountType }): AdminTicket => ({
      ...summary(ticket),
      name: ticket.name,
      email: ticket.email,
      message: ticket.message,
      accountType:
        accountType === "DEVELOPER" ? "developer" : accountType === "COMPANY" ? "company" : null,
      conversation: ticket.conversation,
      closedAt: ticket.closedAt?.toISOString() ?? null,
      closedBy: ticket.closedBy,
    })),
  };
}

/** Resolves or reopens a ticket, recording who resolved it. False when there's no such ticket. */
export async function setTicketStatus(
  db: Db,
  id: number,
  status: TicketStatus,
  adminEmail: string,
  now = Date.now(),
) {
  const updated = await db
    .update(supportTickets)
    .set(
      status === "closed"
        ? { status, closedAt: new Date(now), closedBy: adminEmail }
        : { status, closedAt: null, closedBy: null },
    )
    .where(eq(supportTickets.id, id))
    .returning({ id: supportTickets.id });
  return updated.length > 0;
}
