import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import {
  confirmEmail,
  requestPasswordReset,
  resetPassword,
  sendVerificationCode,
} from "./account-email";
import { authenticate, createAccount, createSession, userForSession } from "./auth";
import type { Db } from "./db";
import { outbox } from "./email";
import {
  codeLifetimeMinutes,
  consumeCode,
  issueCode,
  maxCodeAttempts,
  resendCooldownSeconds,
} from "./email-codes";
import { createTestDb } from "./test-db";

let db: Db;
let ana: AuthUser;

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
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

/** The code in the last e-mail sent to the address. */
const lastCode = (to: string) =>
  outbox()
    .filter((email) => email.to === to)
    .at(-1)
    ?.text.match(/\b\d{6}\b/)?.[0] ?? "";

describe("codes", () => {
  it("work once, for their purpose only", async () => {
    const issued = await issueCode(db, ana.id, "VERIFY_EMAIL");
    if (!("code" in issued)) throw new Error("no code");
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(await consumeCode(db, ana.id, "RESET_PASSWORD", issued.code)).toBe("invalid");
    expect(await consumeCode(db, ana.id, "VERIFY_EMAIL", issued.code)).toBe("ok");
    expect(await consumeCode(db, ana.id, "VERIFY_EMAIL", issued.code)).toBe("invalid");
  });

  it("expire", async () => {
    const now = Date.now();
    const issued = await issueCode(db, ana.id, "VERIFY_EMAIL", now);
    if (!("code" in issued)) throw new Error("no code");
    const later = now + codeLifetimeMinutes * 60_000;
    expect(await consumeCode(db, ana.id, "VERIFY_EMAIL", issued.code, later)).toBe("expired");
  });

  it("stop working after too many wrong guesses", async () => {
    const issued = await issueCode(db, ana.id, "VERIFY_EMAIL");
    if (!("code" in issued)) throw new Error("no code");
    const wrong = issued.code === "000000" ? "111111" : "000000";
    for (let attempt = 1; attempt < maxCodeAttempts; attempt++)
      expect(await consumeCode(db, ana.id, "VERIFY_EMAIL", wrong)).toBe("invalid");
    expect(await consumeCode(db, ana.id, "VERIFY_EMAIL", wrong)).toBe("too-many-attempts");
    // Even the right one: a new code is needed.
    expect(await consumeCode(db, ana.id, "VERIFY_EMAIL", issued.code)).toBe("invalid");
  });

  it("are sent at most once a minute, and a new one replaces the old", async () => {
    const now = Date.now();
    const first = await issueCode(db, ana.id, "VERIFY_EMAIL", now);
    expect(await issueCode(db, ana.id, "VERIFY_EMAIL", now + 10_000)).toEqual({
      retryInSeconds: resendCooldownSeconds - 10,
    });
    const second = await issueCode(db, ana.id, "VERIFY_EMAIL", now + resendCooldownSeconds * 1000);
    if (!("code" in first) || !("code" in second)) throw new Error("no code");
    if (first.code !== second.code)
      expect(await consumeCode(db, ana.id, "VERIFY_EMAIL", first.code, now + 61_000)).toBe(
        "invalid",
      );
    expect(await consumeCode(db, ana.id, "VERIFY_EMAIL", second.code, now + 61_000)).toBe("ok");
  });
});

describe("e-mail confirmation", () => {
  it("starts unconfirmed and confirms with the e-mailed code", async () => {
    expect(ana.emailVerified).toBe(false);
    expect(await sendVerificationCode(db, ana, "pt")).toEqual({ sent: true });
    const email = outbox().at(-1);
    expect(email).toMatchObject({ to: "ana@example.com" });
    expect(email?.subject).toContain("confirmação");
    expect(email?.html).toContain(lastCode("ana@example.com"));

    const code = lastCode("ana@example.com");
    const wrong = code === "000000" ? "111111" : "000000";
    expect(await confirmEmail(db, ana.id, wrong)).toEqual({ error: "invalid-code" });
    expect(await confirmEmail(db, ana.id, code)).toEqual({ ok: true });
    expect((await authenticate(db, "ana@example.com", "segredo123"))?.emailVerified).toBe(true);
  });

  it("e-mails in the screen's language", async () => {
    await sendVerificationCode(db, ana, "en");
    expect(outbox().at(-1)?.subject).toBe("Your StackMatch confirmation code");
  });
});

describe("password reset", () => {
  it("sets a new password with the code and signs out every session", async () => {
    const token = await createSession(db, ana.id);
    await requestPasswordReset(db, " ANA@example.com ", "pt");
    const code = lastCode("ana@example.com");

    expect(await resetPassword(db, "ana@example.com", code, "novasenha1")).toEqual({ ok: true });
    expect(await authenticate(db, "ana@example.com", "segredo123")).toBeNull();
    const signedIn = await authenticate(db, "ana@example.com", "novasenha1");
    // The code reached the inbox, so the e-mail counts as confirmed.
    expect(signedIn?.emailVerified).toBe(true);
    expect(await userForSession(db, token)).toBeNull();
    // The code is used up.
    expect(await resetPassword(db, "ana@example.com", code, "outrasenha2")).toEqual({
      error: "invalid-code",
    });
  });

  it("says nothing about unknown e-mails and fails them like a wrong code", async () => {
    await requestPasswordReset(db, "ninguem@example.com", "pt");
    expect(outbox()).toHaveLength(0);
    expect(await resetPassword(db, "ninguem@example.com", "123456", "novasenha1")).toEqual({
      error: "invalid-code",
    });
  });
});
