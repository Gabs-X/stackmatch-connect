import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { ticketSchema, type TicketInput } from "@/lib/support";
import { saveConversation } from "./assistant-conversations";
import { createAccount } from "./auth";
import type { Db } from "./db";
import { supportTickets, users } from "./db/schema";
import { outbox } from "./email";
import { createTicket, listTickets, maxTicketsPerWindow, ticketWindowMinutes } from "./support";
import { createTestDb } from "./test-db";

let db: Db;
let ana: AuthUser;

const input: TicketInput = {
  category: "bug",
  subject: "O código não chega",
  message: "Pedi o código de confirmação três vezes e nenhum chegou.",
  name: "Visitante",
  email: "visitante@example.com",
  attachConversation: true,
  language: "pt",
};

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  vi.stubEnv("SUPPORT_EMAIL", "suporte@stackmatch.test");
  const user = await createAccount(db, {
    accountType: "developer",
    name: "Ana Souza",
    company: "",
    cnpj: "",
    jobTitle: "Frontend Developer",
    email: "ana@example.com",
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  ana = user;
});

afterEach(() => vi.unstubAllEnvs());

describe("ticketSchema", () => {
  it("refuses short or invalid fields", () => {
    const result = ticketSchema.safeParse({
      ...input,
      subject: "Oi",
      message: "curta",
      email: "nope",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).sort()).toEqual([
      "email-invalid",
      "message-short",
      "subject-short",
    ]);
  });
});

describe("createTicket", () => {
  it("stores a visitor's ticket and e-mails the team with Reply-To set to the author", async () => {
    const result = await createTicket(db, input, null, "203.0.113.7");
    if (!("ticket" in result)) throw new Error("ticket refused");

    expect(result.ticket).toMatchObject({ category: "bug", status: "open" });
    const [row] = await db.select().from(supportTickets);
    expect(row).toMatchObject({ userId: null, email: "visitante@example.com", conversation: null });
    // Only the team gets an e-mail: a visitor's address isn't confirmed, so no receipt goes to it.
    expect(outbox()).toHaveLength(1);
    expect(outbox()[0]).toMatchObject({
      to: "suporte@stackmatch.test",
      replyTo: "visitante@example.com",
      subject: `[Ticket #${result.ticket.id}] Problema ou bug: O código não chega`,
    });
    expect(outbox()[0]?.text).toContain("visitante sem login");
  });

  it("uses the account's name and e-mail, attaches the chat and sends a receipt", async () => {
    const verified = { ...ana, emailVerified: true };
    await saveConversation(db, ana.id, [
      { role: "user", content: "Meu código não chega" },
      { role: "assistant", content: "Confira o spam." },
    ]);

    const result = await createTicket(
      db,
      { ...input, name: "Outra", email: "outra@example.com" },
      verified,
      null,
    );
    if (!("ticket" in result)) throw new Error("ticket refused");

    const [row] = await db.select().from(supportTickets);
    expect(row).toMatchObject({ userId: ana.id, name: "Ana Souza", email: "ana@example.com" });
    expect(row?.conversation).toHaveLength(2);
    expect(outbox().map((email) => email.to)).toEqual([
      "suporte@stackmatch.test",
      "ana@example.com",
    ]);
    expect(outbox()[0]?.text).toContain("Ada: Confira o spam.");
    expect(outbox()[1]?.subject).toBe(`Recebemos seu ticket #${result.ticket.id}`);
    expect(await listTickets(db, ana.id)).toEqual([result.ticket]);
  });

  it("leaves the chat out when not asked to attach it", async () => {
    await saveConversation(db, ana.id, [{ role: "user", content: "Oi" }]);
    await createTicket(db, { ...input, attachConversation: false }, ana, null);
    const [row] = await db.select().from(supportTickets);
    expect(row?.conversation).toBeNull();
  });

  it("keeps the ticket when the team's e-mail can't be sent", async () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await createTicket(db, input, null, null);
    expect("ticket" in result).toBe(true);
    expect(outbox()).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("limits tickets per IP and per account", async () => {
    const now = Date.now();
    for (let index = 0; index < maxTicketsPerWindow; index++)
      await createTicket(
        db,
        input,
        null,
        "203.0.113.7",
        now - (maxTicketsPerWindow - index) * 1000,
      );

    const refused = await createTicket(db, input, null, "203.0.113.7", now);
    expect(refused).toEqual({
      error: "rate-limited",
      retryInSeconds: ticketWindowMinutes * 60 - maxTicketsPerWindow,
    });
    expect("ticket" in (await createTicket(db, input, null, "198.51.100.1", now))).toBe(true);

    for (let index = 0; index < maxTicketsPerWindow; index++)
      await createTicket(db, input, ana, null, now);
    expect(await createTicket(db, input, ana, "192.0.2.1", now)).toMatchObject({
      error: "rate-limited",
    });
  });

  it("keeps tickets when the account is deleted, without the link to it", async () => {
    await createTicket(db, input, ana, null);
    await db.delete(users).where(eq(users.id, ana.id));
    const [row] = await db.select().from(supportTickets);
    expect(row?.userId).toBeNull();
  });
});
