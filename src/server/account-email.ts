import { eq } from "drizzle-orm";
import type { AuthUser, CodeErrorCode } from "@/lib/auth";
import { hashPassword } from "./auth";
import type { Db } from "./db";
import { sessions, users } from "./db/schema";
import { codeEmail, sendEmail, type EmailLanguage } from "./email";
import { emailLimitFor, recordEmailSend } from "./email-throttle";
import { clearLoginFailures } from "./login-throttle";
import { codeLifetimeMinutes, consumeCode, issueCode, type CodeCheck } from "./email-codes";

/** Sent, or how long to wait before asking for another code. */
export type SendResult = { sent: true } | { retryInSeconds: number };

const codeError: Record<Exclude<CodeCheck, "ok">, CodeErrorCode> = {
  invalid: "invalid-code",
  expired: "expired-code",
  "too-many-attempts": "too-many-attempts",
};

/**
 * E-mails a new confirmation code to an account that hasn't confirmed its address yet, unless the
 * account or the IP address asked for too many lately.
 */
export async function sendVerificationCode(
  db: Db,
  user: AuthUser,
  language: EmailLanguage,
  ip: string | null = null,
  now = Date.now(),
): Promise<SendResult> {
  const wait = await emailLimitFor(db, ip, now);
  if (wait) return { retryInSeconds: wait };
  const issued = await issueCode(db, user.id, "VERIFY_EMAIL", now);
  if (!("code" in issued)) return issued;
  await recordEmailSend(db, ip, now);
  await sendEmail(codeEmail(user.email, "verify", issued.code, codeLifetimeMinutes, language));
  return { sent: true };
}

/** Confirms the account's e-mail when the code is right. */
export async function confirmEmail(
  db: Db,
  userId: string,
  code: string,
  now = Date.now(),
): Promise<{ ok: true } | { error: CodeErrorCode }> {
  const check = await consumeCode(db, userId, "VERIFY_EMAIL", code, now);
  if (check !== "ok") return { error: codeError[check] };
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date(now) })
    .where(eq(users.id, userId));
  return { ok: true };
}

const findByEmail = async (db: Db, email: string) =>
  (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0];

/**
 * E-mails a password reset code when the address has an account. Says nothing either way, so the
 * screen can't be used to find out which addresses are registered. Only the IP address's limit is
 * told, and it's checked before looking the address up, so it says nothing about it either.
 */
export async function requestPasswordReset(
  db: Db,
  email: string,
  language: EmailLanguage,
  ip: string | null = null,
  now = Date.now(),
): Promise<SendResult> {
  const wait = await emailLimitFor(db, ip, now);
  if (wait) return { retryInSeconds: wait };
  const user = await findByEmail(db, email);
  if (!user) return { sent: true };
  const issued = await issueCode(db, user.id, "RESET_PASSWORD", now);
  // Asked again within the cooldown: the code sent moments ago still works.
  if ("code" in issued) {
    await recordEmailSend(db, ip, now);
    await sendEmail(codeEmail(user.email, "reset", issued.code, codeLifetimeMinutes, language));
  }
  return { sent: true };
}

/**
 * Sets a new password when the code is right. Every open session ends, and the e-mail counts as
 * confirmed: the code reached that inbox. An unknown address fails like a wrong code.
 */
export async function resetPassword(
  db: Db,
  email: string,
  code: string,
  password: string,
  now = Date.now(),
): Promise<{ ok: true } | { error: CodeErrorCode }> {
  const user = await findByEmail(db, email);
  if (!user) return { error: "invalid-code" };
  const check = await consumeCode(db, user.id, "RESET_PASSWORD", code, now);
  if (check !== "ok") return { error: codeError[check] };
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(now),
    })
    .where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  // The owner proved access to the inbox: wrong passwords tried before don't lock them out.
  await clearLoginFailures(db, user.email);
  return { ok: true };
}
