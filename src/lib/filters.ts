import { z } from "zod";

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

const options = z.array(z.string().max(100)).max(100);

/** Filters as the server receives them: see searchProfiles (src/server/profiles.ts). */
export const filtersSchema = z.object({
  skills: options,
  seniority: options,
  mode: options,
  hiring: options,
  availability: options,
  rate: z.array(z.number().min(0).max(maxRate)).max(1),
});
