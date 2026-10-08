import { parseLocation } from "./cities";
import type { Developer } from "./developers";
import type { JobInput } from "./jobs";

/**
 * How well a developer's profile meets a job's requirements, criterion by criterion. It compares
 * what both sides filled in; it doesn't judge the developer. Only what the job asks for counts: a
 * group left empty ("any") or a city not given is left out, so the score is the share of the
 * job's own criteria the profile meets. The same weights rank Discover inside a job (see
 * rankedMatching in src/server/profiles.ts).
 */

export const matchWeights = {
  requiredSkills: 40,
  desiredSkills: 15,
  seniority: 15,
  workMode: 10,
  hiringTypes: 10,
  availability: 5,
  location: 5,
} as const;

export type MatchCriterion = keyof typeof matchWeights;

export type CriterionResult = {
  criterion: MatchCriterion;
  weight: number;
  /** 0 to 1: the share of the criterion met. */
  met: number;
  /** For skills: the ones the profile has and lacks, as the job wrote them. */
  matched?: string[];
  missing?: string[];
};

export type JobMatch = {
  /** 0 to 100, rounded; null when the job asks for nothing to compare. */
  score: number | null;
  criteria: CriterionResult[];
};

const key = (value: string) => value.trim().toLowerCase();

/** Whether the job cares where the developer lives: a city was given and it isn't remote only. */
export const locationApplies = (job: Pick<JobInput, "location" | "workModes">) =>
  Boolean(job.location) && !(job.workModes.length === 1 && job.workModes[0] === "Remoto");

/** 1 in the same city, 0.5 in the same state, 0 elsewhere. */
export function locationMet(jobLocation: string, developerLocation: string) {
  if (key(jobLocation) === key(developerLocation)) return 1;
  const job = parseLocation(jobLocation);
  const developer = parseLocation(developerLocation);
  return job.uf && job.uf === developer.uf ? 0.5 : 0;
}

export function matchJob(
  job: JobInput,
  developer: Pick<
    Developer,
    "skills" | "seniority" | "workMode" | "hiringTypes" | "availability" | "location"
  >,
): JobMatch {
  const has = new Set(developer.skills.map(key));
  const skills = (criterion: "requiredSkills" | "desiredSkills"): CriterionResult | null => {
    const wanted = job[criterion];
    if (!wanted.length) return null;
    const matched = wanted.filter((skill) => has.has(key(skill)));
    return {
      criterion,
      weight: matchWeights[criterion],
      met: matched.length / wanted.length,
      matched,
      missing: wanted.filter((skill) => !has.has(key(skill))),
    };
  };
  const option = (
    criterion: "seniority" | "workMode" | "availability",
    accepted: readonly string[],
    value: string,
  ): CriterionResult | null =>
    accepted.length
      ? { criterion, weight: matchWeights[criterion], met: accepted.includes(value) ? 1 : 0 }
      : null;
  const criteria = [
    skills("requiredSkills"),
    skills("desiredSkills"),
    option("seniority", job.seniority, developer.seniority),
    option("workMode", job.workModes, developer.workMode),
    job.hiringTypes.length
      ? {
          criterion: "hiringTypes" as const,
          weight: matchWeights.hiringTypes,
          met: developer.hiringTypes.some((type) =>
            (job.hiringTypes as readonly string[]).includes(type),
          )
            ? 1
            : 0,
        }
      : null,
    option("availability", job.availability, developer.availability),
    locationApplies(job)
      ? {
          criterion: "location" as const,
          weight: matchWeights.location,
          met: locationMet(job.location, developer.location),
        }
      : null,
  ].filter((criterion): criterion is CriterionResult => criterion !== null);
  const total = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const earned = criteria.reduce((sum, criterion) => sum + criterion.weight * criterion.met, 0);
  return { score: total ? Math.round((earned / total) * 100) : null, criteria };
}
