import { z } from "zod";
import { isLocation } from "./cities";
import {
  availabilityOptions,
  hiringOptions,
  seniorityOptions,
  workModeOptions,
} from "./developers";
import type { Filters } from "./filters";
import type { Translations } from "./translations";

/**
 * A company's job opening (or project scope): what it looks for, used to search Discover, to keep
 * the developers it reached for it in stages, and to tell them what it's about.
 */

/**
 * Where a developer is in a job. The first four follow what the company did and only move forward
 * on their own (see stageRank); the last three end the process and are only set by hand, so nothing
 * the company does later moves a developer out of them.
 */
export const jobStages = [
  "saved",
  "interest",
  "contacted",
  "meeting",
  "hired",
  "not_advanced",
  "closed",
] as const;
export type JobStage = (typeof jobStages)[number];

export const finalStages = ["hired", "not_advanced", "closed"] as const;
export type FinalStage = (typeof finalStages)[number];
export const isFinalStage = (stage: JobStage): stage is FinalStage =>
  (finalStages as readonly string[]).includes(stage);

export const stageRank = (stage: JobStage) => jobStages.indexOf(stage);

/**
 * A developer's application for a job, as stored. It belongs to the developer and outlives the
 * company's organization of the job: taking them out of it, closing or deleting the job.
 * "submitted" and "in_progress" are active; the rest are final.
 */
export const applicationStatuses = [
  "submitted",
  "in_progress",
  "hired",
  "not_advanced",
  "closed",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const isActiveApplication = (status: ApplicationStatus) =>
  status === "submitted" || status === "in_progress";

/**
 * What the developer is told of the stage the company gives them: whether the company acted on it
 * yet (they already heard of contacts and calls by e-mail) and the outcome, never the stage itself.
 */
export function applicationStatusFor(stage: JobStage): Exclude<ApplicationStatus, "withdrawn"> {
  if (isFinalStage(stage)) return stage;
  return stage === "contacted" || stage === "meeting" ? "in_progress" : "submitted";
}

/** An application as its developer sees it: "job_closed" when the job closed or went away first. */
export type ApplicationView = ApplicationStatus | "job_closed";

/** What happened to an application, as its developer sees it. */
export type ApplicationEvent = {
  kind: "applied" | "withdrawn" | "outcome" | "job_closed" | "job_reopened" | "job_deleted";
  /** For "outcome". */
  outcome?: FinalStage;
  at: string;
};

export type MyApplication = {
  id: string;
  /** The job as it was when they applied. */
  job: JobSnapshot;
  companyId: string;
  company: string;
  message: string;
  appliedAt: string;
  withdrawnAt: string | null;
  status: ApplicationView;
  /** Newest first. */
  history: ApplicationEvent[];
};

/**
 * A page of the developer's applications, with the translations of their jobs; `next` asks for
 * the following page.
 */
export type ApplicationPage = {
  applications: MyApplication[];
  next: string | null;
  translations: Translations;
};

/** How many applications a page brings. */
export const applicationPageSize = 20;

/** What happened to a developer in a job, as its company keeps it. */
export const candidateEventKinds = [
  "added",
  "stage_changed",
  "applied",
  "withdrawn",
  "removed",
  "job_closed",
  "job_reopened",
  "job_deleted",
] as const;
export type CandidateEventKind = (typeof candidateEventKinds)[number];

export type CandidateEvent = {
  kind: CandidateEventKind;
  fromStage: JobStage | null;
  toStage: JobStage | null;
  actor: "company" | "developer" | "system";
  at: string;
};

/** The longest private note a company keeps on a developer in a job. */
export const maxCandidateNote = 2000;

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
    /** In the job board, for any developer to see while it's open (see listJobBoard). */
    listed: z.boolean().default(false),
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
  // New jobs go to the job board unless the company unticks it.
  listed: true,
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
export type JobSnapshot = Omit<JobInput, "listed">;

/** The job without what only its company needs, as developers are shown it. */
export function toSnapshot(job: JobInput): JobSnapshot {
  const { listed: _listed, ...snapshot } = job;
  return snapshot;
}

/**
 * A job in the company's list, with how many developers are at each stage and how many offered
 * themselves for it.
 */
export type JobSummary = Job & { counts: Record<JobStage, number>; applied: number };

export type JobCandidate = {
  developerId: string;
  stage: JobStage;
  stageChangedAt: string;
  /** When the developer offered themselves for the job, or null if the company found them. */
  appliedAt: string | null;
  /** What they wrote when offering themselves, or "". */
  applicationMessage: string;
  /** When they withdrew that application, or null. */
  withdrawnAt: string | null;
  /** The company's private note on them, never shown to the developer. */
  note: string;
};

/** The longest message a developer can send with an offer for a job. */
export const maxApplicationMessage = 1000;

export const applicationInputSchema = z.object({
  jobId: z.string().min(1).max(200),
  message: text(maxApplicationMessage),
  /** The screen's language, to tell the developer about the application in; Portuguese if left out. */
  language: z.enum(["pt", "en"]).optional(),
});
export type ApplicationInput = z.infer<typeof applicationInputSchema>;

/**
 * An open job of a company that reached the developer, as the developer sees it on the company's
 * page, with when they offered themselves for it.
 */
export type OpenJob = JobSnapshot & {
  id: string;
  appliedAt: string | null;
  /** When they withdrew that application, or null. */
  withdrawnAt: string | null;
};

/** A job of the job board: an open job of any company, with the company's name. */
export type BoardJob = OpenJob & { companyId: string; company: string };

/** How many jobs a page of the job board brings. */
export const jobBoardPageSize = 20;

/** Best match with the developer's profile first, or newest first. */
export const jobBoardSorts = ["match", "recent"] as const;
export type JobBoardSort = (typeof jobBoardSorts)[number];

/**
 * A search of the job board: words to find in the title (as written or translated), the company
 * or a skill; work models (a job open to any model fits every choice); the order; and, for the
 * next page, the `next` the previous one gave.
 */
export const jobBoardQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  modes: z.array(z.enum(workModeOptions)).max(workModeOptions.length).default([]),
  sort: z.enum(jobBoardSorts).default("match"),
  after: z.string().max(500).optional(),
});
export type JobBoardQuery = z.input<typeof jobBoardQuerySchema>;

export type JobBoardPage = {
  jobs: BoardJob[];
  translations: Translations;
  /** Asks for the following page; null on the last one. */
  next: string | null;
  /** Every job the search finds, on all pages. */
  total: number;
  /** The order used: by match only with a published profile to compare, else newest first. */
  sort: JobBoardSort;
};

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
