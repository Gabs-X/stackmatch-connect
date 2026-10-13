import { createHash, randomInt } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import type { Db } from "./db";
import { emailCodes } from "./db/schema";
import type { Tx } from "./profiles";

/**
 * Six-digit codes e-mailed to confirm an address, reset a password or change the e-mail. Only a hash is stored; a
 * code expires after a while and stops working after a few wrong guesses, which together keep the
 * million possible codes out of reach.
 */
export type CodePurpose = "VERIFY_EMAIL" | "RESET_PASSWORD" | "CHANGE_EMAIL";

export const codeLifetimeMinutes = 15;
export const maxCodeAttempts = 5;
/** Wait before sending another code to the same account for the same purpose. */
export const resendCooldownSeconds = 60;

const hashCode = (userId: string, purpose: CodePurpose, code: string) =>
  createHash("sha256").update(`${userId}:${purpose}:${code}`).digest("hex");

const sameCode = (userId: string, purpose: CodePurpose) =>
  and(eq(emailCodes.userId, userId), eq(emailCodes.purpose, purpose));

/**
 * A new code that replaces the previous one, or how long to wait when one was sent moments ago.
 * The caller e-mails the code; it is never stored. For CHANGE_EMAIL, `targetEmail` is the new
 * address the code goes to, which a right code then confirms.
 */
export async function issueCode(
  db: Db,
  userId: string,
  purpose: CodePurpose,
  now = Date.now(),
  targetEmail: string | null = null,
): Promise<{ code: string } | { retryInSeconds: number }> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const fields = {
    codeHash: hashCode(userId, purpose, code),
    expiresAt: new Date(now + codeLifetimeMinutes * 60_000),
    attempts: 0,
    targetEmail,
    createdAt: new Date(now),
  };
  // One statement checks the cooldown and replaces the code, so two requests at once can't both
  // send one; a check of the current code holds its row and finishes first (see consumeCodeIn).
  const [issued] = await db
    .insert(emailCodes)
    .values({ userId, purpose, ...fields })
    .onConflictDoUpdate({
      target: [emailCodes.userId, emailCodes.purpose],
      set: fields,
      setWhere: lte(emailCodes.createdAt, new Date(now - resendCooldownSeconds * 1000)),
    })
    .returning({ userId: emailCodes.userId });
  if (issued) return { code };
  const [current] = await db
    .select({ createdAt: emailCodes.createdAt })
    .from(emailCodes)
    .where(sameCode(userId, purpose));
  const elapsed = current ? (now - current.createdAt.getTime()) / 1000 : 0;
  return { retryInSeconds: Math.max(1, Math.ceil(resendCooldownSeconds - elapsed)) };
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
  return (await consumeCodeFor(db, userId, purpose, typed, now)).check;
}

/** Like consumeCode, also returning the address a CHANGE_EMAIL code was sent to. */
export function consumeCodeFor(
  db: Db,
  userId: string,
  purpose: CodePurpose,
  typed: string,
  now = Date.now(),
): Promise<{ check: CodeCheck; targetEmail: string | null }> {
  return db.transaction((tx) => consumeCodeIn(tx, userId, purpose, typed, now));
}

/**
 * consumeCodeFor inside the caller's transaction, for changes that a right code allows: they and
 * the use of the code are saved together or not at all. The code's row stays locked until the
 * transaction ends, so concurrent checks take turns: one right code works once, every wrong guess
 * counts, and a new code sent meanwhile is never touched by a check of the old one.
 */
export async function consumeCodeIn(
  tx: Tx,
  userId: string,
  purpose: CodePurpose,
  typed: string,
  now = Date.now(),
): Promise<{ check: CodeCheck; targetEmail: string | null }> {
  const [current] = await tx
    .select()
    .from(emailCodes)
    .where(sameCode(userId, purpose))
    .for("update");
  if (!current) return { check: "invalid", targetEmail: null };
  const result = (check: CodeCheck) => ({ check, targetEmail: current.targetEmail });
  // The row is locked, so these statements change the very code read above.
  const remove = () => tx.delete(emailCodes).where(sameCode(userId, purpose));
  if (current.expiresAt.getTime() <= now) {
    await remove();
    return result("expired");
  }
  if (current.codeHash === hashCode(userId, purpose, typed.trim())) {
    await remove();
    return result("ok");
  }
  const attempts = current.attempts + 1;
  if (attempts >= maxCodeAttempts) {
    await remove();
    return result("too-many-attempts");
  }
  await tx.update(emailCodes).set({ attempts }).where(sameCode(userId, purpose));
  return result("invalid");
}
