import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { ensureDemoAccounts, sessionDurationMs, userForSession } from "./auth";
import type { AccountType } from "@/lib/auth";
import { getDb, type Db } from "./db";
import { ensureDemoProfile } from "./profiles";

const store = globalThis as unknown as { __stackmatchReadyDb?: Promise<Db> | undefined };

/** The database, with the demo accounts and profile in place before the first request uses it. */
export function database(): Promise<Db> {
  store.__stackmatchReadyDb ??= getDb()
    .then(async (db) => {
      await ensureDemoAccounts(db);
      await ensureDemoProfile(db);
      return db;
    })
    .catch((error: unknown) => {
      store.__stackmatchReadyDb = undefined;
      throw error;
    });
  return store.__stackmatchReadyDb;
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
