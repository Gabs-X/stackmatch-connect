import { z } from "zod";

/**
 * Shared by the screens and the server: account shapes and form validation.
 * Sign-up, sign-in and sessions run on the server (src/lib/auth-api.ts).
 */

export type AccountType = "company" | "developer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  /** Company name for hiring accounts; empty for developers. */
  company: string;
  /** CNPJ digits for hiring accounts; empty for developers and accounts created before it. */
  cnpj: string;
  /** Professional title for developers (required) or the recruiter's role (optional). */
  jobTitle: string;
  /** False until the account confirms its e-mail with the code it received; it can't act before. */
  emailVerified: boolean;
};

/**
 * "login-locked": too many wrong passwords lately (src/server/login-throttle.ts). "too-many-emails":
 * the IP address caused too many e-mails lately (src/server/email-throttle.ts).
 */
export type AuthErrorCode =
  "email-taken" | "invalid-credentials" | "login-locked" | "too-many-emails";

/** Why a code from an e-mail wasn't accepted. */
export type CodeErrorCode = "invalid-code" | "expired-code" | "too-many-attempts";

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    /** For "login-locked" and "too-many-emails": seconds until trying again is allowed. */
    readonly retryInSeconds = 0,
  ) {
    super(code);
    this.name = "AuthError";
  }
}

// Form validation. Messages are codes the screens translate (t.auth.errors[code]).
// Check the format only once something was typed, so an empty field reports just "required".
const email = z.string().trim().min(1, "required").pipe(z.string().email("email"));
export const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** Brazilian company registry number: 14 digits, the last two being check digits. */
export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const checkDigit = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
}

/** "11222333000181" -> "11.222.333/0001-81", formatting as far as the digits go. */
export function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  const separators = ["", ".", ".", "/", "-"];
  return [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 12),
    digits.slice(12),
  ]
    .map((part, index) => (part ? (separators[index] ?? "") + part : ""))
    .join("");
}

export const passwordRules = {
  length: (value: string) => value.length >= 8,
  letter: (value: string) => /\p{L}/u.test(value),
  number: (value: string) => /\d/.test(value),
};

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

const newPassword = z
  .string()
  .refine(passwordRules.length, "passwordLength")
  .refine((value) => passwordRules.letter(value) && passwordRules.number(value), "passwordMix");

export const signUpSchema = z
  .object({
    accountType: z.enum(["company", "developer"]),
    name: z.string().trim().min(2, "name"),
    company: z.string().trim(),
    cnpj: z.string().trim(),
    jobTitle: z.string().trim(),
    email,
    password: newPassword,
    acceptTerms: z.boolean().refine(Boolean, "terms"),
  })
  .refine((data) => data.accountType !== "company" || data.company.length > 0, {
    message: "company",
    path: ["company"],
  })
  .refine((data) => data.accountType !== "company" || isValidCnpj(data.cnpj), {
    message: "cnpj",
    path: ["cnpj"],
  })
  .refine((data) => data.accountType !== "developer" || data.jobTitle.length > 0, {
    message: "jobTitle",
    path: ["jobTitle"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

/** The six digits e-mailed to confirm an address or reset a password. */
const emailCode = z
  .string()
  .trim()
  .min(1, "required")
  .regex(/^\d{6}$/, "code");

export const verifyEmailSchema = z.object({ code: emailCode });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Step 1 of password recovery: where to send the code. */
export const passwordResetSchema = z.object({ email });

/** Step 2: the code and the new password, with the same rules as at sign-up. */
export const newPasswordSchema = z.object({ code: emailCode, password: newPassword });
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

/** Broadcasts sign-ins and sign-outs to the other tabs; the session itself is a server cookie. */
export const sessionStorageKey = "stackmatch-session";

/** Only same-site paths, so a crafted ?redirect= can't send users to another site. */
export function safeRedirect(value: unknown, fallback: string) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

export const homeFor = (user: AuthUser) =>
  user.accountType === "developer" ? "/create-profile" : "/discover";

/**
 * Where to go after signing in or up: the requested page, or the account's home; an account that
 * hasn't confirmed its e-mail goes to the confirmation first, which then sends it there.
 */
export function landingFor(user: AuthUser, redirect?: unknown) {
  const target = safeRedirect(redirect, homeFor(user));
  return user.emailVerified ? target : `/verify-email?redirect=${encodeURIComponent(target)}`;
}

// Account settings: each asks for the current password.
const currentPassword = z.string().min(1, "required");

export const changePasswordSchema = z.object({ currentPassword, password: newPassword });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({ email, password: currentPassword });
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const deleteAccountSchema = z.object({
  password: currentPassword,
  confirm: z.boolean().refine(Boolean, "confirmDelete"),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
