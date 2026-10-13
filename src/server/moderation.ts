import { and, count, desc, eq, gt, inArray, isNotNull, sql, type AnyColumn } from "drizzle-orm";
import {
  reportsPerDay,
  type AdminReport,
  type ReportInput,
  type ReportResult,
  type SuspendedAccount,
} from "@/lib/moderation";
import { adminEmails } from "./admin";
import type { Db } from "./db";
import { lockKeys } from "./db/locks";
import { accountSuspensions, developerProfiles, jobs, reports, sessions, users } from "./db/schema";
import { log } from "./log";
import type { Tx } from "./profiles";

/**
 * Reports and suspensions (what suspending does is in src/lib/moderation.ts). Accounts report
 * content they can see; admins (src/server/admin.ts) review the reports, suspend the account the
 * content belongs to and lift it, each step kept in the account's history.
 */

const dayMs = 24 * 60 * 60_000;

/** True for accounts the team didn't suspend: the condition every public listing adds. */
export const notSuspended = (accountId: AnyColumn) =>
  sql`not exists (select 1 from ${users} where ${users.id} = ${accountId} and ${users.suspendedAt} is not null)`;

export async function isSuspended(db: Db | Tx, accountId: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, accountId), isNotNull(users.suspendedAt)))
    .limit(1);
  return row !== undefined;
}

/** The suspended ones among these accounts. */
export async function suspendedAmong(db: Db | Tx, accountIds: string[]) {
  if (!accountIds.length) return new Set<string>();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, accountIds), isNotNull(users.suspendedAt)));
  return new Set(rows.map((row) => row.id));
}

/** The account the reported content belongs to and how it's named; null if there's no such content. */
async function reportTarget(db: Db | Tx, { targetType, targetId }: ReportInput) {
  if (targetType === "job") {
    const [job] = await db
      .select({ accountId: jobs.companyId, label: jobs.title })
      .from(jobs)
      .where(eq(jobs.id, targetId))
      .limit(1);
    return job ?? null;
  }
  if (targetType === "profile") {
    const [profile] = await db
      .select({ accountId: developerProfiles.userId, label: developerProfiles.name })
      .from(developerProfiles)
      .where(eq(developerProfiles.userId, targetId))
      .limit(1);
    return profile ?? null;
  }
  const [company] = await db
    .select({ accountId: users.id, label: users.companyName })
    .from(users)
    .where(and(eq(users.id, targetId), eq(users.accountType, "COMPANY")))
    .limit(1);
  return company ? { accountId: company.accountId, label: company.label ?? "" } : null;
}

/**
 * Files the account's report, up to reportsPerDay every 24 hours. Reporting what it already
 * reported, while that's still open, changes nothing. An account can't report its own content.
 */
export async function fileReport(
  db: Db,
  reporterId: string,
  input: ReportInput,
  now = Date.now(),
): Promise<ReportResult> {
  const target = await reportTarget(db, input);
  if (!target) return { error: "unknown-target" };
  if (target.accountId === reporterId) return { error: "own-content" };
  const result = await db.transaction(async (tx): Promise<ReportResult> => {
    await lockKeys(tx, [`reports:${reporterId}`]);
    const [recent] = await tx
      .select({ total: count() })
      .from(reports)
      .where(and(eq(reports.reporterId, reporterId), gt(reports.createdAt, new Date(now - dayMs))));
    if ((recent?.total ?? 0) >= reportsPerDay) return { error: "report-limit" };
    await tx
      .insert(reports)
      .values({
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        targetAccountId: target.accountId,
        targetLabel: target.label,
        reason: input.reason,
        details: input.details,
        createdAt: new Date(now),
      })
      .onConflictDoNothing();
    return { ok: true };
  });
  if ("ok" in result)
    log("info", "report.filed", {
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
    });
  return result;
}

/** Reports for the admin panel, newest first: the open ones or all, the latest 200. */
export async function listReports(db: Db, filter: "open" | "all"): Promise<AdminReport[]> {
  const rows = await db
    .select({ report: reports })
    .from(reports)
    .where(filter === "open" ? eq(reports.status, "open") : undefined)
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(200);
  const accountIds = [
    ...new Set(
      rows.flatMap(({ report }) =>
        [report.reporterId, report.targetAccountId].filter((id): id is string => id !== null),
      ),
    ),
  ];
  const accounts = new Map(
    (accountIds.length
      ? await db
          .select({
            id: users.id,
            name: users.name,
            companyName: users.companyName,
            email: users.email,
            suspendedAt: users.suspendedAt,
          })
          .from(users)
          .where(inArray(users.id, accountIds))
      : []
    ).map((account) => [account.id, account]),
  );
  return rows.map(({ report }) => {
    const account = report.targetAccountId ? accounts.get(report.targetAccountId) : undefined;
    const reporter = report.reporterId ? accounts.get(report.reporterId) : undefined;
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      targetLabel: report.targetLabel,
      account: account
        ? {
            id: account.id,
            name: account.companyName ?? account.name,
            email: account.email,
            suspended: account.suspendedAt !== null,
          }
        : null,
      reason: report.reason,
      details: report.details,
      reporter: reporter ? { name: reporter.name, email: reporter.email } : null,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
      reviewedBy: report.reviewedBy,
      reviewNote: report.reviewNote,
    };
  });
}

/** Closes an open report without action; false when it isn't open (anymore). */
export async function dismissReport(
  db: Db,
  reportId: string,
  admin: string,
  note: string,
  now = Date.now(),
) {
  const [dismissed] = await db
    .update(reports)
    .set({ status: "dismissed", reviewedAt: new Date(now), reviewedBy: admin, reviewNote: note })
    .where(and(eq(reports.id, reportId), eq(reports.status, "open")))
    .returning({ id: reports.id });
  if (dismissed) log("info", "report.dismissed", { reportId, admin });
  return dismissed !== undefined;
}

export type SuspendResult =
  { ok: true } | { error: "unknown-account" | "already-suspended" | "admin-account" };

/**
 * Suspends the account: from now on it can't sign in, its sessions end and its content leaves the
 * public listings (see src/lib/moderation.ts). Its open reports are closed as acted on, and the
 * history records who did it and why. Admins can't be suspended here: take them out of
 * ADMIN_EMAILS first.
 */
export async function suspendAccount(
  db: Db,
  accountId: string,
  { reason, admin, reportId = null }: { reason: string; admin: string; reportId?: string | null },
  now = Date.now(),
): Promise<SuspendResult> {
  const result = await db.transaction(async (tx): Promise<SuspendResult> => {
    await lockKeys(tx, [`suspension:${accountId}`]);
    const [account] = await tx
      .select({ email: users.email, suspendedAt: users.suspendedAt })
      .from(users)
      .where(eq(users.id, accountId))
      .for("update");
    if (!account) return { error: "unknown-account" };
    if (adminEmails().includes(account.email.toLowerCase())) return { error: "admin-account" };
    if (account.suspendedAt) return { error: "already-suspended" };
    const at = new Date(now);
    await tx.update(users).set({ suspendedAt: at }).where(eq(users.id, accountId));
    await tx.delete(sessions).where(eq(sessions.userId, accountId));
    await tx.insert(accountSuspensions).values({
      userId: accountId,
      action: "suspended",
      reason,
      reportId,
      by: admin,
      createdAt: at,
    });
    await tx
      .update(reports)
      .set({ status: "actioned", reviewedAt: at, reviewedBy: admin, reviewNote: reason })
      .where(and(eq(reports.targetAccountId, accountId), eq(reports.status, "open")));
    return { ok: true };
  });
  log("ok" in result ? "info" : "warn", "account.suspend", {
    accountId,
    admin,
    reportId,
    outcome: "ok" in result ? "suspended" : result.error,
  });
  return result;
}

/** Lifts the suspension; false when the account isn't suspended. */
export async function liftSuspension(
  db: Db,
  accountId: string,
  { reason, admin }: { reason: string; admin: string },
  now = Date.now(),
) {
  const lifted = await db.transaction(async (tx) => {
    await lockKeys(tx, [`suspension:${accountId}`]);
    const [row] = await tx
      .update(users)
      .set({ suspendedAt: null })
      .where(and(eq(users.id, accountId), isNotNull(users.suspendedAt)))
      .returning({ id: users.id });
    if (!row) return false;
    await tx.insert(accountSuspensions).values({
      userId: accountId,
      action: "lifted",
      reason,
      by: admin,
      createdAt: new Date(now),
    });
    return true;
  });
  if (lifted) log("info", "account.suspension_lifted", { accountId, admin });
  return lifted;
}

/** The suspended accounts, most recent first, each with its whole history. */
export async function listSuspended(db: Db): Promise<SuspendedAccount[]> {
  const accounts = await db
    .select()
    .from(users)
    .where(isNotNull(users.suspendedAt))
    .orderBy(desc(users.suspendedAt));
  if (!accounts.length) return [];
  const history = await db
    .select()
    .from(accountSuspensions)
    .where(
      inArray(
        accountSuspensions.userId,
        accounts.map((account) => account.id),
      ),
    )
    .orderBy(desc(accountSuspensions.createdAt));
  return accounts.map((account) => ({
    id: account.id,
    name: account.companyName ?? account.name,
    email: account.email,
    accountType: account.accountType === "COMPANY" ? "company" : "developer",
    suspendedAt: account.suspendedAt?.toISOString() ?? "",
    history: history
      .filter((event) => event.userId === account.id)
      .map((event) => ({
        action: event.action,
        reason: event.reason,
        by: event.by,
        at: event.createdAt.toISOString(),
      })),
  }));
}
