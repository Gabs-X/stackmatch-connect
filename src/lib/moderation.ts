import { z } from "zod";

/**
 * Reports of jobs, profiles and companies, and what the team does about them (see
 * src/server/moderation.ts). Suspending an account:
 * - ends its sessions and refuses its sign-in and every request it makes, on the server;
 * - takes its profile (developer) or its page and jobs (company) out of Discover, the job board,
 *   saved talent, profile pages and company pages, and refuses new saves, marks, proposals and
 *   applications involving it;
 * - skips the notification e-mails still waiting for it;
 * - keeps its data and what others already received from it (interests, proposals, applications)
 *   as history. Lifting the suspension brings everything back as it was.
 */

export const reportTargets = ["job", "profile", "company"] as const;
export type ReportTarget = (typeof reportTargets)[number];

export const reportReasons = [
  "spam",
  "fake",
  "offensive",
  "discrimination",
  "scam",
  "other",
] as const;
export type ReportReason = (typeof reportReasons)[number];

export const reportStatuses = ["open", "dismissed", "actioned"] as const;
export type ReportStatus = (typeof reportStatuses)[number];

/** Reports one account may file every 24 hours. */
export const reportsPerDay = 10;

export const reportInputSchema = z.object({
  targetType: z.enum(reportTargets),
  targetId: z.string().min(1).max(200),
  reason: z.enum(reportReasons),
  details: z.string().trim().max(1000),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

export type ReportResult =
  { ok: true } | { error: "unknown-target" | "own-content" | "report-limit" };

/** A report as the admin panel shows it. */
export type AdminReport = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  /** The job's title, the profile's or the company's name, when it was reported. */
  targetLabel: string;
  /** The account the content belongs to; null once it's deleted. */
  account: { id: string; name: string; email: string; suspended: boolean } | null;
  reason: ReportReason;
  details: string;
  reporter: { name: string; email: string } | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string;
};

export type SuspensionEvent = {
  action: "suspended" | "lifted";
  reason: string;
  by: string;
  at: string;
};

/** A suspended account, with what was done to it. */
export type SuspendedAccount = {
  id: string;
  name: string;
  email: string;
  accountType: "developer" | "company";
  suspendedAt: string;
  history: SuspensionEvent[];
};

export const moderationNoteSchema = z.string().trim().min(1).max(500);
