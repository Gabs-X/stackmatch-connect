import type { Translations } from "./translations";
// Option values double as filter keys and are stored as is; tv() translates them for display.
export const seniorityOptions = ["Júnior", "Pleno", "Sênior"] as const;
export const workModeOptions = ["Remoto", "Híbrido", "Presencial"] as const;
export const hiringOptions = ["Freelancer", "Contrato", "CLT", "PJ"] as const;
export const availabilityOptions = ["Disponível agora", "Em 15 dias", "Em 30 dias"] as const;

export type Project = {
  name: string;
  description: string;
  tech: string[];
  color: string;
  image: string;
  links: { github: string; demo: string };
};

export type ProfessionalLinks = { github: string; linkedin: string; website?: string };

/** A published developer profile, as companies see it. `id` is the developer's account id. */
export type Developer = {
  id: string;
  name: string;
  role: string;
  seniority: string;
  location: string;
  hiringTypes: string[];
  workMode: string;
  availability: string;
  bio: string;
  skills: string[];
  experience: string;
  image: string;
  rate: number;
  projects: Project[];
  links: ProfessionalLinks;
  /** Role, bio and project descriptions in both languages, when they were translated. */
  translations?: Translations;
};

/**
 * Public avatar of the GitHub account in profileUrl, always the owner's current photo.
 * Returns undefined for non-GitHub or malformed addresses.
 */
export function githubAvatarUrl(profileUrl: string, size = 768): string | undefined {
  try {
    const url = new URL(profileUrl);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return undefined;
    const user = url.pathname.split("/").find(Boolean);
    // GitHub usernames: letters, digits and hyphens, up to 39 characters.
    return user && /^[a-z\d][a-z\d-]{0,38}$/i.test(user)
      ? `https://github.com/${user}.png?size=${size}`
      : undefined;
  } catch {
    return undefined;
  }
}
