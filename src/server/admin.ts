import type { AuthUser } from "@/lib/auth";

/**
 * Admins are the confirmed accounts whose e-mail is listed in ADMIN_EMAILS (comma-separated, set
 * in the Vercel project). There's no admin flag in the database: the list is the only switch.
 */
export function adminEmails() {
  return (process.env["ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdmin = (user: AuthUser | null): user is AuthUser =>
  Boolean(user?.emailVerified && adminEmails().includes(user.email.toLowerCase()));
