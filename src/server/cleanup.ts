import { and, eq, lte, notExists } from "drizzle-orm";
import { outreachLimits } from "@/lib/outreach";
import type { Db } from "./db";
import {
  developerSkills,
  emailCodes,
  interestEvents,
  loginFailures,
  projectSkills,
  sessions,
  skills,
} from "./db/schema";
import { loginWindowMinutes } from "./login-throttle";

/**
 * Deletes what no longer matters: expired sessions and e-mail codes, sign-in failures outside the
 * throttle window, interest marks older than the longest limit that reads them, and typed skills
 * nobody uses (the reference catalog stays). Run daily by Vercel Cron (/api/cron/cleanup).
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
          ),
        )
        .returning({ id: skills.id })
    ).length,
  };
  return deleted;
}
