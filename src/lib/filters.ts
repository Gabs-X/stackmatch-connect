import { z } from "zod";

export type Filters = {
  skills: string[];
  seniority: string[];
  mode: string[];
  hiring: string[];
  availability: string[];
};
export type FilterGroup = keyof Filters;

export const defaultFilters: Filters = {
  skills: [],
  seniority: [],
  mode: [],
  hiring: [],
  availability: [],
};

const options = z.array(z.string().max(100)).max(100);

/** Filters as the server receives them: see searchProfiles (src/server/profiles.ts). */
export const filtersSchema = z.object({
  skills: options,
  seniority: options,
  mode: options,
  hiring: options,
  availability: options,
});
