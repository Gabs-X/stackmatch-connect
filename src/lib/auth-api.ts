import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  confirmEmail,
  requestPasswordReset,
  resetPassword,
  sendVerificationCode,
  type SendResult,
} from "@/server/account-email";
import { authenticate, createAccount, createSession, deleteSession } from "@/server/auth";
import type { Db } from "@/server/db";
import type { EmailLanguage } from "@/server/email";
import { emailLimitFor } from "@/server/email-throttle";
import { clearLoginFailures, loginLockedFor, recordLoginFailure } from "@/server/login-throttle";
import {
  clearSessionToken,
  clientIp,
  currentUser,
  database,
  readSessionToken,
  writeSessionToken,
} from "@/server/session";
import {
  newPasswordSchema,
  passwordResetSchema,
  signInSchema,
  signUpSchema,
  verifyEmailSchema,
  type AuthErrorCode,
  type AuthUser,
  type CodeErrorCode,
} from "./auth";

/**
 * Account endpoints. The session lives in an httpOnly cookie the browser sends along; the screens
 * only ever see the account. Expected failures come back as a code instead of an exception, so
 * they keep their meaning across the network.
 */
type AuthResult = { user: AuthUser } | { error: AuthErrorCode; retryInSeconds?: number };

/** The language of the screen, for the e-mails the request sends. */
const language = z.enum(["pt", "en"]).default("pt");

export const fetchCurrentUser = createServerFn({ method: "GET" }).handler(() => currentUser());

/**
 * E-mails a confirmation code right after sign-up or a sign-in that isn't confirmed yet. A failure
 * to send doesn't fail the request: the confirmation screen can ask for another code.
 */
async function sendCodeAfterSignIn(db: Db, user: AuthUser, lang: EmailLanguage, ip: string | null) {
  if (user.emailVerified) return;
  await sendVerificationCode(db, user, lang, ip).catch((error: unknown) =>
    console.error("Confirmation code not sent:", error),
  );
}

/**
 * Creates the account, unless its IP address already caused too many e-mails lately: every new
 * account gets a confirmation code, so creating them in bulk would send e-mails in bulk.
 */
export const signUpFn = createServerFn({ method: "POST" })
  .validator(signUpSchema.and(z.object({ language })))
  .handler(async ({ data }): Promise<AuthResult> => {
    const db = await database();
    const ip = clientIp();
    const retryInSeconds = await emailLimitFor(db, ip);
    if (retryInSeconds) return { error: "too-many-emails", retryInSeconds };
    const user = await createAccount(db, data);
    if (!user) return { error: "email-taken" };
    writeSessionToken(await createSession(db, user.id));
    await sendCodeAfterSignIn(db, user, data.language, ip);
    return { user };
  });

/**
 * Signs in, unless the e-mail or the address had too many wrong passwords lately: then even the
 * right one is refused until the lock ends, and the screen says when.
 */
export const signInFn = createServerFn({ method: "POST" })
  .validator(signInSchema.extend({ language }))
  .handler(async ({ data }): Promise<AuthResult> => {
    const db = await database();
    const ip = clientIp();
    const retryInSeconds = await loginLockedFor(db, data.email, ip);
    if (retryInSeconds) return { error: "login-locked", retryInSeconds };
    const user = await authenticate(db, data.email, data.password);
    if (!user) {
      await recordLoginFailure(db, data.email, ip);
      return { error: "invalid-credentials" };
    }
    await clearLoginFailures(db, data.email);
    writeSessionToken(await createSession(db, user.id));
    await sendCodeAfterSignIn(db, user, data.language, ip);
    return { user };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const token = readSessionToken();
  if (token) await deleteSession(await database(), token);
  clearSessionToken();
});

/** Confirms the signed-in account's e-mail with the code it received. */
export const verifyEmailFn = createServerFn({ method: "POST" })
  .validator(verifyEmailSchema)
  .handler(async ({ data }): Promise<{ user: AuthUser } | { error: CodeErrorCode }> => {
    const user = await currentUser();
    if (!user) return { error: "invalid-code" };
    if (user.emailVerified) return { user };
    const result = await confirmEmail(await database(), user.id, data.code);
    return "error" in result ? result : { user: { ...user, emailVerified: true } };
  });

/** Sends the signed-in account another confirmation code, at most once a minute. */
export const resendVerificationFn = createServerFn({ method: "POST" })
  .validator(z.object({ language }))
  .handler(async ({ data }): Promise<SendResult> => {
    const user = await currentUser();
    if (!user || user.emailVerified) return { sent: true };
    return sendVerificationCode(await database(), user, data.language, clientIp());
  });

/**
 * Step 1 of password recovery. Answers the same whether or not the address has an account; only
 * the IP address's e-mail limit comes back.
 */
export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .validator(passwordResetSchema.extend({ language }))
  .handler(async ({ data }) =>
    requestPasswordReset(await database(), data.email, data.language, clientIp()),
  );

/** Step 2: sets the new password. The account signs in again with it afterwards. */
export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator(newPasswordSchema.extend({ email: z.string().trim().min(1) }))
  .handler(async ({ data }): Promise<{ ok: true } | { error: CodeErrorCode }> =>
    resetPassword(await database(), data.email, data.code, data.password),
  );
