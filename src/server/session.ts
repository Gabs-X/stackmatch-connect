import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { sessionDurationMs, userForSession } from "./auth";
import type { AccountType } from "@/lib/auth";
import { getDb } from "./db";

/** The database. */
export const database = getDb;

/**
 * The client's address, as Vercel's proxy reports it, for the sign-in and e-mail limits; null when
 * unknown (as in some local runs).
 */
export function clientIp() {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    return null;
  }
}

const cookieName = "stackmatch_session";

export const readSessionToken = () => getCookie(cookieName);

export function writeSessionToken(token: string) {
  setCookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: sessionDurationMs / 1000,
  });
}

export const clearSessionToken = () => deleteCookie(cookieName, { path: "/" });

/** The signed-in account for this request, or null. */
export async function currentUser() {
  const token = readSessionToken();
  return token ? userForSession(await database(), token) : null;
}

export class AccessError extends Error {
  constructor() {
    super("This action needs a signed-in, confirmed account of another type.");
    this.name = "AccessError";
  }
}

/** The signed-in account, which must be of `type` and have confirmed its e-mail; else refused. */
export async function requireAccount(type: AccountType) {
  const user = await currentUser();
  if (user?.accountType !== type || !user.emailVerified) throw new AccessError();
  return user;
}
