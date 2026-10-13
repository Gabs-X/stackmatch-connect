import { eq } from "drizzle-orm";
import type { AuthUser, CodeErrorCode } from "@/lib/auth";
import { hashPassword } from "./auth";
import type { Db } from "./db";
import { sessions, users } from "./db/schema";
import { codeEmail, sendEmail, type EmailLanguage } from "./email";
import { releaseEmailSend, reserveEmailSend } from "./email-throttle";
import { clearLoginFailures } from "./login-throttle";
import { codeLifetimeMinutes, consumeCodeIn, issueCode, type CodeCheck } from "./email-codes";
import { log } from "./log";

/** Sent, or how long to wait before asking for another code. */
export type SendResult = { sent: true } | { retryInSeconds: number };

const codeError: Record<Exclude<CodeCheck, "ok">, CodeErrorCode> = {
  invalid: "invalid-code",
  expired: "expired-code",
  "too-many-attempts": "too-many-attempts",
};

/**
 * How long each password recovery step takes at least. E-mailing a code takes time an unknown
 * address wouldn't, and so does checking one; answering no sooner than this keeps the response time
 * from telling which addresses have an account, as long as the work fits in it.
 */
export const passwordResetResponseMs = 1500;

/** Runs the task and settles no sooner than `ms` after it started, whether it succeeds or fails. */
export async function atLeast<T>(ms: number, task: () => Promise<T>): Promise<T> {
  const floor = new Promise((resolve) => setTimeout(resolve, ms));
  try {
    return await task();
  } finally {
    await floor;
  }
}

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
  const reservation = await reserveEmailSend(db, ip, now);
  if ("retryInSeconds" in reservation) return reservation;
  const issued = await issueCode(db, user.id, "VERIFY_EMAIL", now);
  if (!("code" in issued)) {
    await releaseEmailSend(db, reservation.reserved);
    return issued;
  }
  await sendEmail(codeEmail(user.email, "verify", issued.code, codeLifetimeMinutes, language));
  return { sent: true };
}

/** Confirms the account's e-mail when the code is right; both are saved together. */
export async function confirmEmail(
  db: Db,
  userId: string,
  code: string,
  now = Date.now(),
): Promise<{ ok: true } | { error: CodeErrorCode }> {
  const check = await db.transaction(async (tx) => {
    const { check } = await consumeCodeIn(tx, userId, "VERIFY_EMAIL", code, now);
    if (check === "ok")
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date(now) })
        .where(eq(users.id, userId));
    return check;
  });
  return check === "ok" ? { ok: true } : { error: codeError[check] };
}

const findByEmail = async (db: Db, email: string) =>
  (await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1))[0];

/**
 * E-mails a password reset code when the address has an account. Says nothing either way, so the
 * screen can't be used to find out which addresses are registered. Only the IP address's limit is
 * told; it's checked before looking the address up, and every request it lets through counts
 * against it, account or not, so the limit says nothing about the address either. A failure to
 * send is logged rather than told, for the same reason.
 */
export async function requestPasswordReset(
  db: Db,
  email: string,
  language: EmailLanguage,
  ip: string | null = null,
  now = Date.now(),
): Promise<SendResult> {
  const reservation = await reserveEmailSend(db, ip, now);
  if ("retryInSeconds" in reservation) return reservation;
  const user = await findByEmail(db, email);
  if (!user) return { sent: true };
  const issued = await issueCode(db, user.id, "RESET_PASSWORD", now);
  // Asked again within the cooldown: the code sent moments ago still works.
  if ("code" in issued)
    await sendEmail(
      codeEmail(user.email, "reset", issued.code, codeLifetimeMinutes, language),
    ).catch((error: unknown) => log("error", "email.code_not_sent", { purpose: "reset", error }));
  return { sent: true };
}

/**
 * Sets a new password when the code is right. Every open session ends, and the e-mail counts as
 * confirmed: the code reached that inbox. An unknown address fails like a wrong code. The use of
 * the code, the new password and the end of the sessions are saved together or not at all.
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
  // Hashed before the transaction, which holds the code's row: hashing is the slow part.
  const passwordHash = await hashPassword(password);
  const check = await db.transaction(async (tx) => {
    const { check } = await consumeCodeIn(tx, user.id, "RESET_PASSWORD", code, now);
    if (check !== "ok") return check;
    await tx
      .update(users)
      .set({ passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date(now) })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    // The owner proved access to the inbox: wrong passwords tried before don't lock them out.
    await clearLoginFailures(tx, user.email);
    return check;
  });
  return check === "ok" ? { ok: true } : { error: codeError[check] };
}
