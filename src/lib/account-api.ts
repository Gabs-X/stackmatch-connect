import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  changePassword,
  confirmEmailChange,
  deleteAccount,
  requestEmailChange,
} from "@/server/account-settings";
import {
  clearSessionToken,
  clientIp,
  currentUser,
  database,
  readSessionToken,
} from "@/server/session";
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  verifyEmailSchema,
} from "./auth";

/** Settings the signed-in account changes about itself (see src/server/account-settings.ts). */
const language = z.enum(["pt", "en"]).default("pt");

async function signedIn() {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

/** Changing the e-mail or password needs a confirmed account; deleting it doesn't. */
async function confirmedAccount() {
  const user = await signedIn();
  if (!user.emailVerified) throw new Error("E-mail not confirmed.");
  return user;
}

export const changePasswordFn = createServerFn({ method: "POST" })
  .validator(changePasswordSchema)
  .handler(async ({ data }) =>
    changePassword(
      await database(),
      await confirmedAccount(),
      data,
      readSessionToken(),
      clientIp(),
    ),
  );

export const requestEmailChangeFn = createServerFn({ method: "POST" })
  .validator(changeEmailSchema.extend({ language }))
  .handler(async ({ data: { language: lang, ...input } }) =>
    requestEmailChange(await database(), await confirmedAccount(), input, lang, clientIp()),
  );

export const confirmEmailChangeFn = createServerFn({ method: "POST" })
  .validator(verifyEmailSchema.extend({ language }))
  .handler(async ({ data }) =>
    confirmEmailChange(await database(), await confirmedAccount(), data.code, data.language),
  );

export const deleteAccountFn = createServerFn({ method: "POST" })
  .validator(deleteAccountSchema)
  .handler(async ({ data }) => {
    const result = await deleteAccount(
      await database(),
      await signedIn(),
      data.password,
      clientIp(),
    );
    if ("ok" in result) clearSessionToken();
    return result;
  });
