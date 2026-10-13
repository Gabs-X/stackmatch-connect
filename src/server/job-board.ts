import { and, arrayOverlaps, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { parseLocation } from "@/lib/cities";
import type { Developer } from "@/lib/developers";
import { matchWeights } from "@/lib/job-match";
import {
  jobBoardPageSize,
  jobBoardQuerySchema,
  jobTexts,
  toSnapshot,
  type BoardJob,
  type JobBoardPage,
  type JobBoardQuery,
} from "@/lib/jobs";
import type { Db } from "./db";
import { jobApplications, jobSkills, jobs, skills, textTranslations, users } from "./db/schema";
import { toJobs } from "./jobs";
import { loadPublishedProfile } from "./profiles";
import { loadTranslations } from "./translations";

/**
 * The job board: open jobs their companies listed, searched, filtered, ordered and paged here, so
 * every listed job can be reached, whatever their number.
 */

const key = (value: string) => value.trim().toLowerCase();

/**
 * How much of each job the developer's profile meets, in SQL, as matchJob (src/lib/job-match.ts)
 * scores it: the rounded share of the job's own criteria, or -1 when the job asks for nothing to
 * compare, so those come last, as on the screen.
 */
function boardMatch(profile: Developer) {
  const has = [...new Set(profile.skills.map(key))];
  const skillCriterion = (required: boolean, weight: number) => {
    const wanted = sql`(select count(*) from ${jobSkills} where ${jobSkills.jobId} = ${jobs.id} and ${jobSkills.required} = ${required})`;
    const met = has.length
      ? sql`(select count(*) from ${jobSkills} inner join ${skills} on ${skills.id} = ${jobSkills.skillId} where ${jobSkills.jobId} = ${jobs.id} and ${jobSkills.required} = ${required} and lower(trim(${skills.name})) in (${sql.join(
          has.map((name) => sql`${name}`),
          sql`, `,
        )}))`
      : sql`0`;
    return {
      weight: sql`(case when ${wanted} > 0 then ${weight} else 0 end)`,
      earned: sql`(case when ${wanted} > 0 then ${weight}::float * ${met} / ${wanted} else 0 end)`,
    };
  };
  /** A group of options the job accepts: counts when not empty, met when it has the profile's. */
  const option = (column: SQL, value: string, weight: number) => ({
    weight: sql`(case when cardinality(${column}) > 0 then ${weight} else 0 end)`,
    earned: sql`(case when ${value} = any(${column}) then ${weight} else 0 end)`,
  });
  const { uf } = parseLocation(profile.location);
  const jobState = sql`upper(trim(substring(${jobs.location} from ',([^,]*)$')))`;
  // A city was given and the job isn't remote only (see locationApplies).
  const locationApplies = sql`(${jobs.location} <> '' and not (cardinality(${jobs.workModes}) = 1 and ${jobs.workModes}[1] = 'Remoto'))`;
  const criteria = [
    skillCriterion(true, matchWeights.requiredSkills),
    skillCriterion(false, matchWeights.desiredSkills),
    option(sql`${jobs.seniority}`, profile.seniority, matchWeights.seniority),
    option(sql`${jobs.workModes}`, profile.workMode, matchWeights.workMode),
    {
      weight: sql`(case when cardinality(${jobs.hiringTypes}) > 0 then ${matchWeights.hiringTypes} else 0 end)`,
      earned: profile.hiringTypes.length
        ? sql`(case when ${arrayOverlaps(jobs.hiringTypes, [...profile.hiringTypes])} then ${matchWeights.hiringTypes} else 0 end)`
        : sql`0`,
    },
    option(sql`${jobs.availability}`, profile.availability, matchWeights.availability),
    {
      weight: sql`(case when ${locationApplies} then ${matchWeights.location} else 0 end)`,
      earned: sql`(case when not ${locationApplies} then 0 when lower(trim(${jobs.location})) = ${key(profile.location)} then ${matchWeights.location}::float when ${jobState} <> '' and ${jobState} = ${uf || null} then ${matchWeights.location / 2}::float else 0 end)`,
    },
  ];
  const total = sql`(${sql.join(
    criteria.map((criterion) => criterion.weight),
    sql` + `,
  )})`;
  const earned = sql`(${sql.join(
    criteria.map((criterion) => criterion.earned),
    sql` + `,
  )})`;
  return sql<number>`(case when ${total} > 0 then round((${earned} * 100 / ${total})::numeric)::int else -1 end)`;
}

/** Words to find, as a case-insensitive LIKE pattern, its wildcards taken literally. */
const containing = (search: string) => `%${search.replace(/[\\%_]/g, "\\$&")}%`;

/** Where the next page starts: after this job, in this order. */
const cursorSchema = z.object({
  sort: z.enum(["match", "recent"]),
  /** The job's score, for "match". */
  score: z.number().int().optional(),
  /** created_at to the microsecond, as Postgres keeps it. */
  at: z.string().max(40),
  id: z.string().max(200),
});
type Cursor = z.infer<typeof cursorSchema>;

const encodeCursor = (cursor: Cursor) =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

/** The cursor, or null when it's malformed: the search then starts over. */
function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString()));
    return parsed.success && !Number.isNaN(Date.parse(parsed.data.at)) ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * A page of the job board: only open jobs their companies listed, found by the search and work
 * models, with the company's name and when the developer applied. By match first when the
 * developer has a published profile to compare (ties newest first), else newest first.
 *
 * Pages follow a cursor on the order itself (score, creation time, id), not an offset: jobs
 * published, closed or unlisted between two pages don't make the next one repeat or skip any of
 * the others. A job's score changes only with the job or the profile, so editing either while
 * paging may move a job across pages.
 */
export async function listJobBoard(
  db: Db,
  developerId: string,
  query: JobBoardQuery = {},
): Promise<JobBoardPage> {
  const { search, modes, sort: wanted, after } = jobBoardQuerySchema.parse(query);
  const profile = wanted === "match" ? await loadPublishedProfile(db, developerId) : null;
  const sort = profile ? "match" : "recent";
  const score = profile ? boardMatch(profile) : sql<number>`0`;
  const pattern = containing(search);
  const filters = and(
    eq(jobs.listed, true),
    eq(jobs.status, "open"),
    search
      ? sql`(${jobs.title} ilike ${pattern} or ${users.companyName} ilike ${pattern} or exists (select 1 from ${jobSkills} inner join ${skills} on ${skills.id} = ${jobSkills.skillId} where ${jobSkills.jobId} = ${jobs.id} and ${skills.name} ilike ${pattern}) or exists (select 1 from ${textTranslations} where ${textTranslations.ownerId} = ${jobs.companyId} and ${textTranslations.hash} = encode(sha256(convert_to(${jobs.title}, 'UTF8')), 'hex') and ${textTranslations.text} ilike ${pattern}))`
      : undefined,
    modes.length
      ? sql`(cardinality(${jobs.workModes}) = 0 or ${arrayOverlaps(jobs.workModes, modes)})`
      : undefined,
  );
  const cursor = decodeCursor(after);
  const from =
    cursor?.sort === sort
      ? sort === "match"
        ? sql`(${score}, ${jobs.createdAt}, ${jobs.id}) < (${cursor.score ?? -1}, ${cursor.at}::timestamptz, ${cursor.id})`
        : sql`(${jobs.createdAt}, ${jobs.id}) < (${cursor.at}::timestamptz, ${cursor.id})`
      : undefined;

  const [counted] = await db
    .select({ total: count() })
    .from(jobs)
    .innerJoin(users, eq(users.id, jobs.companyId))
    .where(filters);
  const rows = await db
    .select({
      job: jobs,
      company: users.companyName,
      appliedAt: jobApplications.appliedAt,
      withdrawnAt: jobApplications.withdrawnAt,
      score,
      at: sql<string>`to_char(${jobs.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(jobs)
    .innerJoin(users, eq(users.id, jobs.companyId))
    .leftJoin(
      jobApplications,
      and(eq(jobApplications.jobId, jobs.id), eq(jobApplications.developerId, developerId)),
    )
    .where(and(filters, from))
    .orderBy(...(profile ? [desc(score)] : []), desc(jobs.createdAt), desc(jobs.id))
    .limit(jobBoardPageSize + 1);
  const page = rows.slice(0, jobBoardPageSize);
  const board: BoardJob[] = (
    await toJobs(
      db,
      page.map((row) => row.job),
    )
  ).map(({ id, status: _status, createdAt: _created, updatedAt: _updated, ...job }, index) => {
    const row = page[index];
    return {
      ...toSnapshot(job),
      id,
      companyId: row?.job.companyId ?? "",
      company: row?.company ?? "",
      appliedAt: row?.appliedAt?.toISOString() ?? null,
      withdrawnAt: row?.withdrawnAt?.toISOString() ?? null,
    };
  });
  const last = page.at(-1);
  return {
    jobs: board,
    translations: await loadTranslations(
      db,
      [...new Set(board.map((job) => job.companyId))],
      board.flatMap((job) => jobTexts(job)),
    ),
    next:
      rows.length > jobBoardPageSize && last
        ? encodeCursor({
            sort,
            ...(sort === "match" ? { score: Number(last.score) } : {}),
            at: last.at,
            id: last.job.id,
          })
        : null,
    total: counted?.total ?? 0,
    sort,
  };
}
