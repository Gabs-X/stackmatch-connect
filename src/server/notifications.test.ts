import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { defaultCompanySettings } from "@/lib/company-settings";
import { createAccount } from "./auth";
import { saveCompanySettings } from "./companies";
import type { Db } from "./db";
import { outbox } from "./email";
import { listSentBy, sendMeetingRequest } from "./meetings";
import { interestNotice } from "./notifications";
import { deliverEmails, notify, saveLanguage } from "./outbox";
import { createDeveloper, createTestDb } from "./test-db";

let db: Db;
let marina: string;
let acme: AuthUser;

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
  const user = await createAccount(db, {
    accountType: "company",
    name: "Bia Santos",
    company: "Acme",
    cnpj: "11222333000181",
    jobTitle: "Tech Recruiter",
    email: "bia@acme.com",
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  acme = user;
  await saveCompanySettings(db, acme.id, {
    ...defaultCompanySettings(acme),
    contactName: "Carla Dias",
    contactEmail: "carla@acme.com",
  });
});

/** Notifies the developer of Acme's interest and sends the e-mail. */
async function notifyInterest() {
  const notice = await interestNotice(db, acme.id, marina, "https://stackmatch.example", null, "t");
  await deliverEmails(db, { ids: [(await notify(db, notice)) ?? ""] });
}

describe("interest e-mail", () => {
  it("tells the developer who marked them, with replies going to the company", async () => {
    await notifyInterest();
    expect(outbox().at(-1)).toMatchObject({
      to: "marina@example.com",
      subject: "Acme tem interesse no seu perfil no StackMatch",
      replyTo: "carla@acme.com",
    });
    const { text, html } = outbox().at(-1) ?? { text: "", html: "" };
    expect(text).toContain("Olá, Marina!");
    expect(text).toContain("Carla Dias, da Acme, marcou interesse no seu perfil");
    expect(text).toContain("https://stackmatch.example/interests");
    expect(html).toContain('href="https://stackmatch.example/interests"');
  });

  it("goes out in the developer's language", async () => {
    await saveLanguage(db, marina, "en");
    await notifyInterest();
    expect(outbox().at(-1)?.subject).toBe("Acme is interested in your StackMatch profile");
  });
});

describe("meeting request e-mail", () => {
  // Noon in Brasília on 2026-10-01; proposal times are in GMT-3.
  const now = Date.parse("2026-10-01T12:00:00-03:00");
  const proposal = () => ({
    developerId: marina,
    date: "2026-10-02",
    time: "10:30",
    message: "Projeto de <dashboard> em React.",
  });

  it("is sent as the preview shows it, with replies going to the company", async () => {
    await sendMeetingRequest(db, acme, proposal(), now, "pt");
    const email = outbox().at(-1);
    expect(email).toMatchObject({
      to: "marina@example.com",
      subject: "Acme quer conversar com você pelo StackMatch",
      replyTo: "carla@acme.com",
    });
    expect(email?.text).toContain("Olá, Marina!");
    expect(email?.text).toContain(
      "Carla Dias (Acme) propôs uma conversa de 30 minutos em sexta-feira, 2 de outubro, às 10:30",
    );
    expect(email?.text).toContain("> Projeto de <dashboard> em React.");
    // What the company typed can't inject HTML.
    expect(email?.html).toContain("Projeto de &#60;dashboard&#62; em React.");
  });

  it("goes out in the developer's language, whatever the company's screen", async () => {
    await saveLanguage(db, marina, "en");
    await sendMeetingRequest(db, acme, proposal(), now, "pt");
    expect(outbox().at(-1)?.subject).toBe("Acme wants to talk with you on StackMatch");
  });

  describe("when the e-mail can't be sent", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("keeps the proposal and sends the e-mail on a later try", async () => {
      // In production without RESEND_API_KEY, sending fails.
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RESEND_API_KEY", "");
      expect(await sendMeetingRequest(db, acme, proposal(), now, "pt")).toHaveProperty("request");
      expect(await listSentBy(db, acme.id)).toHaveLength(1);
      expect(outbox()).toEqual([]);
      vi.unstubAllEnvs();
      // Due a minute after the failure.
      expect(await deliverEmails(db, { others: 10, now: Date.now() + 60_000 })).toMatchObject({
        sent: 1,
      });
      expect(outbox().at(-1)?.subject).toBe("Acme quer conversar com você pelo StackMatch");
    });
  });
});
