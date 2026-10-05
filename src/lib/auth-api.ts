import { createServerFn } from "@tanstack/react-start";
import { authenticate, createAccount, createSession, deleteSession } from "@/server/auth";
import {
  clearSessionToken,
  currentUser,
  database,
  readSessionToken,
  writeSessionToken,
} from "@/server/session";
import { signInSchema, signUpSchema, type AuthErrorCode, type AuthUser } from "./auth";

/**
 * Account endpoints. The session lives in an httpOnly cookie the browser sends along; the screens
 * only ever see the account. Expected failures come back as a code instead of an exception, so
 * they keep their meaning across the network.
 */
type AuthResult = { user: AuthUser } | { error: AuthErrorCode };

export const fetchCurrentUser = createServerFn({ method: "GET" }).handler(() => currentUser());

export const signUpFn = createServerFn({ method: "POST" })
  .validator(signUpSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const db = await database();
    const user = await createAccount(db, data);
    if (!user) return { error: "email-taken" };
    writeSessionToken(await createSession(db, user.id));
    return { user };
  });

export const signInFn = createServerFn({ method: "POST" })
  .validator(signInSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const db = await database();
    const user = await authenticate(db, data.email, data.password);
    if (!user) return { error: "invalid-credentials" };
    writeSessionToken(await createSession(db, user.id));
    return { user };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const token = readSessionToken();
  if (token) await deleteSession(await database(), token);
  clearSessionToken();
});
