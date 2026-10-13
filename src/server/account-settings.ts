import { eq } from "drizzle-orm";
import type { AuthUser, CodeErrorCode } from "@/lib/auth";
import { deleteOtherSessions, hashPassword, toAuthUser, verifyPassword } from "./auth";
import type { Db } from "./db";
import { users, type UserRow } from "./db/schema";
import { codeEmail, emailChangedNotice, sendEmail, type EmailLanguage } from "./email";
import { codeLifetimeMinutes, consumeCodeIn, issueCode } from "./email-codes";
import { releaseEmailSend, reserveEmailSend } from "./email-throttle";
import { releaseLoginAttempt, reserveLoginAttempt } from "./login-throttle";
import { lockProfile, storedImages, type Tx } from "./profiles";
import { removeImages } from "./storage";

/**
 * What a signed-in account changes about itself: its password, its e-mail and the account itself.
 * Each asks for the current password; a wrong one counts against the sign-in limit, so these
 * screens can't be used to guess it.
 */
export type PasswordCheck =
  { error: "wrong-password" } | { error: "login-locked"; retryInSeconds: number };

async function checkPassword(
  db: Db,
  user: AuthUser,
  password: string,
  ip: string | null,
  now: number,
): Promise<PasswordCheck | null> {
  const attempt = await reserveLoginAttempt(db, user.email, ip, now);
  if ("retryInSeconds" in attempt)
    return { error: "login-locked", retryInSeconds: attempt.retryInSeconds };
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(password, row.passwordHash)))
    return { error: "wrong-password" };
  await releaseLoginAttempt(db, attempt.reserved);
  return null;
}

/**
 * Sets a new password and ends the account's other sessions; the current one stays. Both are saved
 * together, so a failure never leaves a new password with the old sessions still open.
 */
export async function changePassword(
  db: Db,
  user: AuthUser,
  input: { currentPassword: string; password: string },
  sessionToken: string | undefined,
  ip: string | null = null,
  now = Date.now(),
): Promise<{ ok: true } | PasswordCheck> {
  const refused = await checkPassword(db, user, input.currentPassword, ip, now);
  if (refused) return refused;
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await deleteOtherSessions(tx, user.id, sessionToken);
  });
  return { ok: true };
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const emailTaken = async (db: Db | Tx, email: string) =>
  (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)).length > 0;

export type EmailChangeRequest =
  | { sent: true }
  | { retryInSeconds: number }
  | { error: "same-email" | "email-taken" }
  | PasswordCheck;

/** Step 1 of changing the e-mail: sends a code to the new address, which only its owner can read. */
export async function requestEmailChange(
  db: Db,
  user: AuthUser,
  input: { email: string; password: string },
  language: EmailLanguage,
  ip: string | null = null,
  now = Date.now(),
): Promise<EmailChangeRequest> {
  const email = normalizeEmail(input.email);
  if (email === user.email) return { error: "same-email" };
  const refused = await checkPassword(db, user, input.password, ip, now);
  if (refused) return refused;
  if (await emailTaken(db, email)) return { error: "email-taken" };
  const reservation = await reserveEmailSend(db, ip, now);
  if ("retryInSeconds" in reservation) return reservation;
  const issued = await issueCode(db, user.id, "CHANGE_EMAIL", now, email);
  if (!("code" in issued)) {
    await releaseEmailSend(db, reservation.reserved);
    return issued;
  }
  await sendEmail(codeEmail(email, "change", issued.code, codeLifetimeMinutes, language));
  return { sent: true };
}

type ChangeError = { error: CodeErrorCode | "email-taken" };

/**
 * Step 2: with the code from the new address, the account switches to it (confirmed, since the
 * code reached it) and the old address is told, in case the change wasn't its owner's.
 */
export async function confirmEmailChange(
  db: Db,
  user: AuthUser,
  code: string,
  language: EmailLanguage,
  now = Date.now(),
): Promise<{ user: AuthUser } | ChangeError> {
  // The use of the code and the new address are saved together or not at all.
  const outcome = await db
    .transaction(async (tx): Promise<{ row: UserRow; targetEmail: string } | ChangeError> => {
      const { check, targetEmail } = await consumeCodeIn(tx, user.id, "CHANGE_EMAIL", code, now);
      if (check === "expired") return { error: "expired-code" };
      if (check === "too-many-attempts") return { error: "too-many-attempts" };
      if (check !== "ok" || !targetEmail) return { error: "invalid-code" };
      // Someone may have signed up with it since the code was sent.
      if (await emailTaken(tx, targetEmail)) return { error: "email-taken" };
      const [row] = await tx
        .update(users)
        .set({ email: targetEmail, emailVerifiedAt: new Date(now) })
        .where(eq(users.id, user.id))
        .returning();
      if (!row) throw new Error("Account not found.");
      return { row, targetEmail };
    })
    // Or in the instant between that check and the update: the unique address refuses it.
    .catch((error: unknown): ChangeError => {
      if (isUniqueViolation(error)) return { error: "email-taken" };
      throw error;
    });
  if ("error" in outcome) return outcome;
  await sendEmail(emailChangedNotice(user.email, outcome.targetEmail, language)).catch(
    (error: unknown) => console.error("E-mail change notice not sent:", error),
  );
  return { user: toAuthUser(outcome.row) };
}

/** Whether the database refused a write for repeating a unique value (Postgres code 23505). */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  return code === "23505" || isUniqueViolation(cause);
}

/**
 * Deletes the account and everything that depends on it: profile, projects, company details,
 * sessions, shortlists, interest marks and proposals, and its images in file storage.
 */
export async function deleteAccount(
  db: Db,
  user: AuthUser,
  password: string,
  ip: string | null = null,
  now = Date.now(),
): Promise<{ ok: true } | PasswordCheck> {
  const refused = await checkPassword(db, user, password, ip, now);
  if (refused) return refused;
  // Under the profile's lock: a save finishing meanwhile either ends before (its images are
  // listed here) or finds the account gone (and deletes its own new images).
  const images = await db.transaction(async (tx) => {
    await lockProfile(tx, user.id);
    const stored = await storedImages(tx, user.id);
    await tx.delete(users).where(eq(users.id, user.id));
    return stored;
  });
  // After the account is gone: a failure to delete an image leaves a file, never a broken profile.
  await removeImages(images);
  return { ok: true };
}
