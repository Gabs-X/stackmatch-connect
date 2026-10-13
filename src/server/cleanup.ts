import { and, eq, inArray, lte, notExists } from "drizzle-orm";
import { outreachLimits } from "@/lib/outreach";
import { assistantWindowMinutes } from "./assistant-throttle";
import type { Db } from "./db";
import {
  assistantRequests,
  developerSkills,
  emailCodes,
  emailOutbox,
  emailSends,
  interestEvents,
  jobSkills,
  loginFailures,
  notifications,
  projectSkills,
  sessions,
  skills,
  translationRequests,
} from "./db/schema";
import { emailWindowMinutes } from "./email-throttle";
import { loginWindowMinutes } from "./login-throttle";
import { translationWindowHours } from "./translation-throttle";

/** Days a notification stays in the center. */
export const notificationRetentionDays = 180;
/** Days the record of an e-mail that went out (or was given up) is kept. */
export const outboxRetentionDays = 30;

/**
 * Deletes what no longer matters: expired sessions and e-mail codes, sign-in failures, e-mail
 * sends, assistant questions and translations outside their limits' windows, interest marks older than the longest limit that reads them, typed skills
 * no profile, project or job uses (the reference catalog stays), notifications older than
 * notificationRetentionDays and the e-mails that finished more than outboxRetentionDays ago. Run
 * daily by Vercel Cron (/api/cron/cleanup).
 */
export async function cleanup(db: Db, now = Date.now()) {
  const before = (ms: number) => new Date(now - ms);
  const deleted = {
    sessions: (
      await db
        .delete(sessions)
        .where(lte(sessions.expiresAt, new Date(now)))
        .returning({
          id: sessions.id,
        })
    ).length,
    emailCodes: (
      await db
        .delete(emailCodes)
        .where(lte(emailCodes.expiresAt, new Date(now)))
        .returning({
          userId: emailCodes.userId,
        })
    ).length,
    loginFailures: (
      await db
        .delete(loginFailures)
        .where(lte(loginFailures.createdAt, before(loginWindowMinutes * 60_000)))
        .returning({ id: loginFailures.id })
    ).length,
    emailSends: (
      await db
        .delete(emailSends)
        .where(lte(emailSends.createdAt, before(emailWindowMinutes * 60_000)))
        .returning({ id: emailSends.id })
    ).length,
    assistantRequests: (
      await db
        .delete(assistantRequests)
        .where(lte(assistantRequests.createdAt, before(assistantWindowMinutes * 60_000)))
        .returning({ id: assistantRequests.id })
    ).length,
    translationRequests: (
      await db
        .delete(translationRequests)
        .where(lte(translationRequests.createdAt, before(translationWindowHours * 3_600_000)))
        .returning({ id: translationRequests.id })
    ).length,
    interestEvents: (
      await db
        .delete(interestEvents)
        .where(
          lte(interestEvents.createdAt, before(outreachLimits.interestEmailEveryDays * 86_400_000)),
        )
        .returning({ id: interestEvents.id })
    ).length,
    unusedSkills: (
      await db
        .delete(skills)
        .where(
          and(
            eq(skills.curated, false),
            notExists(
              db.select().from(developerSkills).where(eq(developerSkills.skillId, skills.id)),
            ),
            notExists(db.select().from(projectSkills).where(eq(projectSkills.skillId, skills.id))),
            notExists(db.select().from(jobSkills).where(eq(jobSkills.skillId, skills.id))),
          ),
        )
        .returning({ id: skills.id })
    ).length,
    notifications: (
      await db
        .delete(notifications)
        .where(lte(notifications.createdAt, before(notificationRetentionDays * 86_400_000)))
        .returning({ id: notifications.id })
    ).length,
    emails: (
      await db
        .delete(emailOutbox)
        .where(
          and(
            inArray(emailOutbox.status, ["sent", "skipped", "failed"]),
            lte(emailOutbox.createdAt, before(outboxRetentionDays * 86_400_000)),
          ),
        )
        .returning({ id: emailOutbox.id })
    ).length,
  };
  return deleted;
}
