import { and, asc, desc, eq } from "drizzle-orm";
import { defaultCompanySettings } from "@/lib/company-settings";
import type { JobSnapshot } from "@/lib/jobs";
import type { ProfileInterest } from "@/lib/profile-interests";
import { toAuthUser } from "./auth";
import type { Db } from "./db";
import { companyProfiles, interests, users } from "./db/schema";
import { withJobTranslations } from "./meetings";
import { developerExists } from "./saved-talents";

/** Developer ids the company marked, in the order it marked them. */
export async function listInterestsBy(db: Db, companyId: string): Promise<string[]> {
  const rows = await db
    .select({ developerId: interests.developerId })
    .from(interests)
    .where(eq(interests.companyId, companyId))
    .orderBy(asc(interests.createdAt), asc(interests.developerId));
  return rows.map((row) => row.developerId);
}

/**
 * Marks interest: "created" the first time, "existing" when the company had already marked the
 * profile (the first mark stays, now pointing to the job when one is given), "unknown" when there
 * is no such profile.
 */
export async function markInterest(
  db: Db,
  companyId: string,
  developerId: string,
  job: { id: string; snapshot: JobSnapshot } | null = null,
): Promise<"created" | "existing" | "unknown"> {
  if (!(await developerExists(db, developerId))) return "unknown";
  const created = await db
    .insert(interests)
    .values({ companyId, developerId, jobId: job?.id ?? null, job: job?.snapshot ?? null })
    .onConflictDoNothing()
    .returning({ id: interests.id });
  if (!created.length && job) await setInterestJob(db, companyId, developerId, job);
  return created.length ? "created" : "existing";
}

/** Points the mark to the job it was made from again, as the job is now. */
export async function setInterestJob(
  db: Db,
  companyId: string,
  developerId: string,
  job: { id: string; snapshot: JobSnapshot },
) {
  await db
    .update(interests)
    .set({ jobId: job.id, job: job.snapshot })
    .where(and(eq(interests.companyId, companyId), eq(interests.developerId, developerId)));
}

export async function removeInterest(db: Db, companyId: string, developerId: string) {
  await db
    .delete(interests)
    .where(and(eq(interests.companyId, companyId), eq(interests.developerId, developerId)));
}

/**
 * Companies that marked the developer, newest first, signed with each company's current contact:
 * what it saved in its details, or its sign-up details until then.
 */
export async function listInterestsFor(db: Db, developerId: string): Promise<ProfileInterest[]> {
  const rows = await db
    .select({ interest: interests, company: users, contact: companyProfiles })
    .from(interests)
    .innerJoin(users, eq(interests.companyId, users.id))
    .leftJoin(companyProfiles, eq(companyProfiles.userId, users.id))
    .where(eq(interests.developerId, developerId))
    .orderBy(desc(interests.createdAt));
  const items = rows.map(({ interest, company, contact }): ProfileInterest => {
    const fallback = defaultCompanySettings(toAuthUser(company));
    return {
      id: interest.id,
      developerId: interest.developerId,
      companyId: interest.companyId,
      company: company.companyName ?? "",
      contactName: contact?.contactName ?? fallback.contactName,
      email: contact?.contactEmail ?? fallback.contactEmail,
      at: interest.createdAt.toISOString(),
      ...(interest.job ? { job: interest.job } : {}),
    };
  });
  return withJobTranslations(db, items);
}
