import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { ensureDemoAccounts, sessionDurationMs, userForSession } from "./auth";
import { getDb, type Db } from "./db";

const store = globalThis as unknown as { __stackmatchReadyDb?: Promise<Db> | undefined };

/** The database, with the demo accounts in place before the first request uses it. */
export function database(): Promise<Db> {
  store.__stackmatchReadyDb ??= getDb()
    .then(async (db) => {
      await ensureDemoAccounts(db);
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
