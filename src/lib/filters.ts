import type { Developer } from "./developers";

export type Filters = {
  skills: string[];
  seniority: string[];
  mode: string[];
  hiring: string[];
  availability: string[];
  rate: number[];
};
export type FilterGroup = Exclude<keyof Filters, "rate">;

export const maxRate = 300;

export const defaultFilters: Filters = {
  skills: [],
  seniority: [],
  mode: [],
  hiring: [],
  availability: [],
  rate: [maxRate],
};

/**
 * Options inside a group combine with OR; groups combine with AND. Profiles without a rate
 * (developers who left it blank) only pass while the rate filter is untouched.
 */
export function matchesFilters(developer: Developer, filters: Filters): boolean {
  const limit = filters.rate[0] ?? maxRate;
  return (
    (!filters.skills.length || filters.skills.some((skill) => developer.skills.includes(skill))) &&
    (!filters.seniority.length || filters.seniority.includes(developer.seniority)) &&
    (!filters.mode.length || filters.mode.includes(developer.workMode)) &&
    (!filters.hiring.length ||
      filters.hiring.some((type) => developer.hiringTypes.includes(type))) &&
    (!filters.availability.length || filters.availability.includes(developer.availability)) &&
    (Number.isFinite(developer.rate) ? developer.rate <= limit : limit === maxRate)
  );
}
