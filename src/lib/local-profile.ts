import { z } from "zod";

const profileSchema = z.object({
  name: z.string(),
  role: z.string(),
  location: z.string(),
  seniority: z.string(),
  availability: z.string(),
  bio: z.string(),
  github: z.string(),
  linkedin: z.string(),
  website: z.string(),
  skills: z.array(z.string()),
  projects: z.array(z.string()),
});

export type LocalProfile = z.infer<typeof profileSchema>;

export const emptyProfile: LocalProfile = {
  name: "",
  role: "",
  location: "",
  seniority: "",
  availability: "",
  bio: "",
  github: "",
  linkedin: "",
  website: "",
  skills: ["React", "TypeScript"],
  projects: [],
};

const storageKey = "stackmatch-profile";

export function loadLocalProfile(): LocalProfile | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const result = profileSchema.safeParse(JSON.parse(stored));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveLocalProfile(profile: LocalProfile): LocalProfile {
  const saved = profileSchema.parse(profile);
  window.localStorage.setItem(storageKey, JSON.stringify(saved));
  return saved;
}

export function profileLink(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
