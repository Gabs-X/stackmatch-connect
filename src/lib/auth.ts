import { z } from "zod";

/**
 * Front-end stand-in for the authentication API. Accounts and the session live in this browser's
 * localStorage. When the backend exists, replace signUp/signIn/requestPasswordReset with fetch
 * calls that return the same shapes, and keep the session handling in auth-context.
 */

export type AccountType = "company" | "developer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  /** Company name for hiring accounts; empty for developers. */
  company: string;
  /** Professional title for developers (required) or the recruiter's role (optional). */
  jobTitle: string;
};

export type AuthSession = { user: AuthUser; token: string };

export type AuthErrorCode = "email-taken" | "invalid-credentials";

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

// Form validation. Messages are codes the screens translate (t.auth.errors[code]).
// Check the format only once something was typed, so an empty field reports just "required".
const email = z.string().trim().min(1, "required").pipe(z.string().email("email"));
export const passwordRules = {
  length: (value: string) => value.length >= 8,
  letter: (value: string) => /\p{L}/u.test(value),
  number: (value: string) => /\d/.test(value),
};

export const signInSchema = z.object({
  // An e-mail, or a demo account's username ("teste.dev").
  email: z.string().trim().min(1, "required"),
  password: z.string().min(1, "required"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    accountType: z.enum(["company", "developer"]),
    name: z.string().trim().min(2, "name"),
    company: z.string().trim(),
    jobTitle: z.string().trim(),
    email,
    password: z
      .string()
      .refine(passwordRules.length, "passwordLength")
      .refine((value) => passwordRules.letter(value) && passwordRules.number(value), "passwordMix"),
    acceptTerms: z.boolean().refine(Boolean, "terms"),
  })
  .refine((data) => data.accountType !== "company" || data.company.length > 0, {
    message: "company",
    path: ["company"],
  })
  .refine((data) => data.accountType !== "developer" || data.jobTitle.length > 0, {
    message: "jobTitle",
    path: ["jobTitle"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const passwordResetSchema = z.object({ email });

// Storage.
const MOCK_LATENCY_MS = 600;
const usersKey = "stackmatch-users";
export const sessionStorageKey = "stackmatch-session";

const storedUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  accountType: z.enum(["company", "developer"]),
  company: z.string(),
  jobTitle: z.string().default(""),
  passwordHash: z.string(),
});
type StoredUser = z.infer<typeof storedUserSchema>;

const sessionSchema = z.object({
  token: z.string(),
  user: storedUserSchema.omit({ passwordHash: true }),
});

const delay = () => new Promise<void>((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Prototype only: hashing in the browser keeps plain passwords out of storage, nothing more. */
export async function hashPassword(emailAddress: string, password: string) {
  const data = new TextEncoder().encode(`${normalizeEmail(emailAddress)}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readUsers(): StoredUser[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(usersKey) ?? "[]");
    const result = z.array(storedUserSchema).safeParse(value);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

/**
 * Ready-made accounts for trying each side of the app without signing up. They live in code, not
 * in storage, so clearing site data never removes them. Sign in with the e-mail or the username.
 */
export const demoPassword = "teste1234";
export const demoDeveloperId = "demo-developer";
export const demoAccounts: (AuthUser & { username: string })[] = [
  {
    id: demoDeveloperId,
    username: "teste.dev",
    name: "Gabriel Botelho",
    email: "teste.dev@stackmatch.app",
    accountType: "developer",
    company: "",
    jobTitle: "Full Stack Developer",
  },
  {
    id: "demo-company",
    username: "teste.emp",
    name: "Recrutadora Teste",
    email: "teste.emp@stackmatch.app",
    accountType: "company",
    company: "Empresa Teste",
    jobTitle: "Tech Recruiter",
  },
];

const findDemoAccount = (login: string) =>
  demoAccounts.find((account) => account.email === login || account.username === login);

const toSession = ({ passwordHash: _hash, ...user }: StoredUser): AuthSession => ({
  user,
  token: createId(),
});

export async function signUp(input: SignUpInput): Promise<AuthSession> {
  await delay();
  const users = readUsers();
  const address = normalizeEmail(input.email);
  if (findDemoAccount(address) || users.some((user) => user.email === address))
    throw new AuthError("email-taken");
  const user: StoredUser = {
    id: createId(),
    name: input.name.trim(),
    email: address,
    accountType: input.accountType,
    company: input.accountType === "company" ? input.company.trim() : "",
    jobTitle: input.jobTitle.trim(),
    passwordHash: await hashPassword(address, input.password),
  };
  window.localStorage.setItem(usersKey, JSON.stringify([...users, user]));
  return toSession(user);
}

export async function signIn(input: SignInInput): Promise<AuthSession> {
  await delay();
  const address = normalizeEmail(input.email);
  const demo = findDemoAccount(address);
  if (demo) {
    if (input.password !== demoPassword) throw new AuthError("invalid-credentials");
    const { username: _username, ...user } = demo;
    return { user, token: createId() };
  }
  const user = readUsers().find((item) => item.email === address);
  // Same error for unknown e-mail and wrong password, so the form doesn't reveal accounts.
  if (!user || user.passwordHash !== (await hashPassword(address, input.password)))
    throw new AuthError("invalid-credentials");
  return toSession(user);
}

/** Always resolves, whether or not the account exists, so the screen can't be used to probe. */
export async function requestPasswordReset(_email: string): Promise<void> {
  await delay();
}

export function loadSession(): AuthSession | null {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(sessionStorageKey) ?? "null");
    const result = sessionSchema.safeParse(value);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession | null) {
  try {
    if (session) window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    else window.localStorage.removeItem(sessionStorageKey);
  } catch {
    /* The session still works for this visit without persistence. */
  }
}

/** Only same-site paths, so a crafted ?redirect= can't send users to another site. */
export function safeRedirect(value: unknown, fallback: string) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

export const homeFor = (user: AuthUser) =>
  user.accountType === "developer" ? "/create-profile" : "/discover";
