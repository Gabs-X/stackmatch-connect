import { z } from "zod";
import { isLocation } from "./cities";
import {
  availabilityOptions,
  hiringOptions,
  seniorityOptions,
  workModeOptions,
} from "./developers";
import type { Filters } from "./filters";

/**
 * A company's job opening (or project scope): what it looks for, used to search Discover, to keep
 * the developers it reached for it in stages, and to tell them what it's about.
 */

/** Where a developer is in a job: only moves forward on its own (see stageRank). */
export const jobStages = ["saved", "interest", "contacted", "meeting"] as const;
export type JobStage = (typeof jobStages)[number];

export const stageRank = (stage: JobStage) => jobStages.indexOf(stage);

/** Whether the pay range is per hour or per month. */
export const compensationPeriods = ["hour", "month"] as const;
export type CompensationPeriod = (typeof compensationPeriods)[number];

/** Openings a company can have at once, open or closed; it deletes old ones to make room. */
export const maxJobsPerCompany = 50;

const text = (max: number) => z.string().trim().max(max);
const skillList = z.array(text(50).min(1)).max(20);
const amount = z.number().int().min(0).max(1_000_000).nullable();

export const jobInputSchema = z
  .object({
    title: text(120).min(1, "required"),
    description: text(4000),
    /** Must-haves; the rest of the stack goes in desiredSkills. */
    requiredSkills: skillList,
    desiredSkills: skillList,
    seniority: z.array(z.enum(seniorityOptions)),
    workModes: z.array(z.enum(workModeOptions)),
    hiringTypes: z.array(z.enum(hiringOptions)),
    availability: z.array(z.enum(availabilityOptions)),
    /** A city with its state, or "" when it doesn't matter (remote work). */
    location: text(120).refine((value) => !value || isLocation(value), "location"),
    compensationMin: amount,
    compensationMax: amount,
    compensationPeriod: z.enum(compensationPeriods),
  })
  .refine(
    (job) =>
      job.compensationMin === null ||
      job.compensationMax === null ||
      job.compensationMin <= job.compensationMax,
    { message: "compensation", path: ["compensationMax"] },
  );

export type JobInput = z.infer<typeof jobInputSchema>;

export const emptyJob: JobInput = {
  title: "",
  description: "",
  requiredSkills: [],
  desiredSkills: [],
  seniority: [],
  workModes: [],
  hiringTypes: [],
  availability: [],
  location: "",
  compensationMin: null,
  compensationMax: null,
  compensationPeriod: "month",
};

export type JobStatus = "open" | "closed";

export type Job = JobInput & {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * The job as it was when the company reached a developer from it, kept with the interest mark or
 * the proposal: what the developer was told stays the same if the job changes or goes away.
 */
export type JobSnapshot = JobInput;

/** A job in the company's list, with how many developers are at each stage. */
export type JobSummary = Job & { counts: Record<JobStage, number> };

export type JobCandidate = { developerId: string; stage: JobStage; stageChangedAt: string };

/**
 * The Discover filters a job starts with: its whole stack, and the options it accepts. Its city
 * ranks profiles (see matchJob) instead of leaving any out.
 */
export function jobFilters(job: JobInput): Filters {
  return {
    skills: [...new Set([...job.requiredSkills, ...job.desiredSkills])],
    seniority: [...job.seniority],
    mode: [...job.workModes],
    hiring: [...job.hiringTypes],
    availability: [...job.availability],
    places: [],
  };
}

/** The free text of a job, the part that gets machine-translated. */
export const jobTexts = (job: Pick<JobInput, "title" | "description">) => [
  job.title,
  job.description,
];

type CompensationTexts = {
  from: (value: string) => string;
  upTo: (value: string) => string;
  per: Record<CompensationPeriod, string>;
};

/** The pay range as a phrase ("R$ 8.000 – R$ 12.000 por mês"), or "" when none was given. */
export function compensationLabel(
  job: Pick<JobInput, "compensationMin" | "compensationMax" | "compensationPeriod">,
  texts: CompensationTexts,
  money: (value: number) => string,
) {
  const { compensationMin: min, compensationMax: max } = job;
  if (min === null && max === null) return "";
  const range =
    min !== null && max !== null
      ? min === max
        ? money(min)
        : `${money(min)} – ${money(max)}`
      : min !== null
        ? texts.from(money(min))
        : texts.upTo(money(max ?? 0));
  return `${range} ${texts.per[job.compensationPeriod]}`;
}
