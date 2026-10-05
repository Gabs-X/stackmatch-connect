import { createHash, randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "./db";
import { emailCodes } from "./db/schema";

/**
 * Six-digit codes e-mailed to confirm an address or reset a password. Only a hash is stored; a
 * code expires after a while and stops working after a few wrong guesses, which together keep the
 * million possible codes out of reach.
 */
export type CodePurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";

export const codeLifetimeMinutes = 15;
export const maxCodeAttempts = 5;
/** Wait before sending another code to the same account for the same purpose. */
export const resendCooldownSeconds = 60;

const hashCode = (userId: string, purpose: CodePurpose, code: string) =>
  createHash("sha256").update(`${userId}:${purpose}:${code}`).digest("hex");

const findCode = async (db: Db, userId: string, purpose: CodePurpose) =>
  (
    await db
      .select()
      .from(emailCodes)
      .where(and(eq(emailCodes.userId, userId), eq(emailCodes.purpose, purpose)))
  )[0];

const deleteCode = (db: Db, userId: string, purpose: CodePurpose) =>
  db.delete(emailCodes).where(and(eq(emailCodes.userId, userId), eq(emailCodes.purpose, purpose)));

/**
 * A new code that replaces the previous one, or how long to wait when one was sent moments ago.
 * The caller e-mails the code; it is never stored.
 */
export async function issueCode(
  db: Db,
  userId: string,
  purpose: CodePurpose,
  now = Date.now(),
): Promise<{ code: string } | { retryInSeconds: number }> {
  const current = await findCode(db, userId, purpose);
  const elapsed = current ? (now - current.createdAt.getTime()) / 1000 : Infinity;
  if (elapsed < resendCooldownSeconds)
    return { retryInSeconds: Math.ceil(resendCooldownSeconds - elapsed) };
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const fields = {
    codeHash: hashCode(userId, purpose, code),
    expiresAt: new Date(now + codeLifetimeMinutes * 60_000),
    attempts: 0,
    createdAt: new Date(now),
  };
  await db
    .insert(emailCodes)
    .values({ userId, purpose, ...fields })
    .onConflictDoUpdate({ target: [emailCodes.userId, emailCodes.purpose], set: fields });
  return { code };
}

export type CodeCheck = "ok" | "invalid" | "expired" | "too-many-attempts";

/** Checks a code; a right one is used up, and too many wrong ones throw the code away. */
export async function consumeCode(
  db: Db,
  userId: string,
  purpose: CodePurpose,
  typed: string,
  now = Date.now(),
): Promise<CodeCheck> {
  const current = await findCode(db, userId, purpose);
  if (!current) return "invalid";
  if (current.expiresAt.getTime() <= now) {
    await deleteCode(db, userId, purpose);
    return "expired";
  }
  if (current.codeHash === hashCode(userId, purpose, typed.trim())) {
    await deleteCode(db, userId, purpose);
    return "ok";
  }
  const attempts = current.attempts + 1;
  if (attempts >= maxCodeAttempts) {
    await deleteCode(db, userId, purpose);
    return "too-many-attempts";
  }
  await db
    .update(emailCodes)
    .set({ attempts })
    .where(and(eq(emailCodes.userId, userId), eq(emailCodes.purpose, purpose)));
  return "invalid";
}
