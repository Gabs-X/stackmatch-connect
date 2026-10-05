import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { sessionDurationMs, userForSession } from "./auth";
import type { AccountType } from "@/lib/auth";
import { getDb } from "./db";

/** The database. */
export const database = getDb;

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
    super("This action needs a signed-in account of another type.");
    this.name = "AccessError";
  }
}

/** The signed-in account, which must be of `type`; anything else is refused. */
export async function requireAccount(type: AccountType) {
  const user = await currentUser();
  if (user?.accountType !== type) throw new AccessError();
  return user;
}
