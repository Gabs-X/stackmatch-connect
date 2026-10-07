import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { requestPasswordReset, sendVerificationCode } from "./account-email";
import { createAccount } from "./auth";
import type { Db } from "./db";
import { outbox } from "./email";
import {
  emailLimitFor,
  emailWindowMinutes,
  maxEmailsPerIp,
  recordEmailSend,
} from "./email-throttle";
import { createTestDb } from "./test-db";

let db: Db;
let ana: AuthUser;
const ip = "203.0.113.7";

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

/** Uses up the IP's e-mails, the first one at `start` and one a second after another. */
async function useUp(start: number) {
  for (let sent = 0; sent < maxEmailsPerIp; sent++)
    await recordEmailSend(db, ip, start + sent * 1000);
}

describe("emailLimitFor", () => {
  it("holds once the IP sent the most e-mails the window allows, until the oldest leaves it", async () => {
    const start = Date.now();
    await useUp(start);
    const now = start + maxEmailsPerIp * 1000;
    expect(await emailLimitFor(db, ip, now)).toBe(emailWindowMinutes * 60 - maxEmailsPerIp);
    // Other addresses, and requests whose address is unknown, aren't held.
    expect(await emailLimitFor(db, "198.51.100.1", now)).toBe(0);
    expect(await emailLimitFor(db, null, now)).toBe(0);
    expect(await emailLimitFor(db, ip, start + emailWindowMinutes * 60_000)).toBe(0);
  });
});

describe("e-mails with a code", () => {
  it("aren't sent while the IP is held, whether or not the address has an account", async () => {
    const now = Date.now();
    await useUp(now - 60_000);
    expect(await sendVerificationCode(db, ana, "pt", ip, now)).toEqual({
      retryInSeconds: expect.any(Number),
    });
    const held = await requestPasswordReset(db, "ana@example.com", "pt", ip, now);
    expect(held).toEqual({ retryInSeconds: expect.any(Number) });
    expect(await requestPasswordReset(db, "ninguem@example.com", "pt", ip, now)).toEqual(held);
    expect(outbox()).toHaveLength(0);
  });

  it("count only when one is actually sent", async () => {
    const now = Date.now();
    await requestPasswordReset(db, "ninguem@example.com", "pt", ip, now);
    expect(await sendVerificationCode(db, ana, "pt", ip, now)).toEqual({ sent: true });
    // Within the account's cooldown no e-mail goes out, so it doesn't count either.
    await sendVerificationCode(db, ana, "pt", ip, now + 1000);
    for (let sent = 1; sent < maxEmailsPerIp - 1; sent++) await recordEmailSend(db, ip, now + 2000);
    expect(await emailLimitFor(db, ip, now + 3000)).toBe(0);
    await recordEmailSend(db, ip, now + 3000);
    expect(await emailLimitFor(db, ip, now + 4000)).toBeGreaterThan(0);
  });
});
