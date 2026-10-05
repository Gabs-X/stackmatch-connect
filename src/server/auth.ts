import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { eq, lte } from "drizzle-orm";
import { onlyDigits, type AccountType, type AuthUser, type SignUpInput } from "@/lib/auth";
import type { Db } from "./db";
import { sessions, users, type UserRow } from "./db/schema";

// Passwords: scrypt with a random salt per password, stored as "scrypt$<salt>$<key>" in base64.
const keyLength = 64;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keyLength, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await deriveKey(password, Buffer.from(salt, "base64"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Compared against when the e-mail is unknown, so both failures take the same time.
const unknownUserHash = hashPassword(randomBytes(16).toString("hex"));

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const toAccountType = (value: UserRow["accountType"]): AccountType =>
  value === "COMPANY" ? "company" : "developer";

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    accountType: toAccountType(row.accountType),
    company: row.companyName ?? "",
    cnpj: row.cnpj ?? "",
    jobTitle: row.jobTitle,
  };
}

/** Creates the account, or returns null when the e-mail is taken. Expects validated input. */
export async function createAccount(db: Db, input: SignUpInput): Promise<AuthUser | null> {
  const company = input.accountType === "company";
  // The unique e-mail settles concurrent sign-ups: the second insert does nothing.
  const [row] = await db
    .insert(users)
    .values({
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
      accountType: company ? "COMPANY" : "DEVELOPER",
      name: input.name.trim(),
      jobTitle: input.jobTitle.trim(),
      companyName: company ? input.company.trim() : null,
      cnpj: company ? onlyDigits(input.cnpj) : null,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();
  return row ? toAuthUser(row) : null;
}

/** The account for an e-mail and password, or null. */
export async function authenticate(
  db: Db,
  login: string,
  password: string,
): Promise<AuthUser | null> {
  const email = normalizeEmail(login);
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = await verifyPassword(password, row?.passwordHash ?? (await unknownUserHash));
  return row && valid ? toAuthUser(row) : null;
}

// Sessions: the browser keeps a random token in an httpOnly cookie; the table keeps its hash.
export const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: string, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  await db
    .insert(sessions)
    .values({ id: hashToken(token), userId, expiresAt: new Date(now + sessionDurationMs) });
  return token;
}

export async function userForSession(
  db: Db,
  token: string,
  now = Date.now(),
): Promise<AuthUser | null> {
  const [found] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);
  if (!found) return null;
  if (found.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(lte(sessions.expiresAt, new Date(now)));
    return null;
  }
  return toAuthUser(found.user);
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
