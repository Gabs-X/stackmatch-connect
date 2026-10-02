import { z } from "zod";
import {
  availabilityOptions,
  demoDeveloperProfile,
  seniorityOptions,
  githubAvatarUrl,
  workModeOptions,
  type Developer,
} from "./developers";

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tech: z.array(z.string()),
  /** JPEG data URL produced by readProjectImage, or "" when there is no cover. */
  image: z.string(),
  github: z.string(),
  demo: z.string(),
});

export type LocalProject = z.infer<typeof projectSchema>;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function newProject(fields: Partial<LocalProject> = {}): LocalProject {
  return {
    id: createId(),
    name: "",
    description: "",
    tech: [],
    image: "",
    github: "",
    demo: "",
    ...fields,
  };
}

/** Maps free text from older profiles ("pleno", "remoto") onto catalog values used by filters. */
function matchOption(value: string, options: readonly string[]) {
  const normalized = value.trim().toLowerCase();
  return options.find((option) => option.toLowerCase() === normalized) ?? value.trim();
}

const profileSchema = z.object({
  name: z.string(),
  role: z.string(),
  location: z.string(),
  seniority: z.string().transform((value) => matchOption(value, seniorityOptions)),
  availability: z.string().transform((value) => matchOption(value, availabilityOptions)),
  // Added after the first release; older saved profiles don't have it.
  workMode: z
    .string()
    .default("")
    .transform((value) => matchOption(value, workModeOptions)),
  bio: z.string(),
  github: z.string(),
  linkedin: z.string(),
  website: z.string(),
  skills: z.array(z.string()),
  // Profiles saved before projects had details stored only each project's name.
  projects: z.array(z.union([projectSchema, z.string().transform((name) => newProject({ name }))])),
});

export type LocalProfile = z.output<typeof profileSchema>;

export const emptyProfile: LocalProfile = {
  name: "",
  role: "",
  location: "",
  seniority: "",
  availability: "",
  workMode: "",
  bio: "",
  github: "",
  linkedin: "",
  website: "",
  skills: ["React", "TypeScript"],
  projects: [],
};

export const localProfileStorageKey = "stackmatch-profile";

export function loadLocalProfile(): LocalProfile | null {
  try {
    const stored = window.localStorage.getItem(localProfileStorageKey);
    if (!stored) return null;
    const result = profileSchema.safeParse(JSON.parse(stored));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * The developer profile this browser shows to companies: the one saved here or, until a developer
 * saves one, the demo account's profile.
 */
export function loadPublishedProfile(): LocalProfile {
  return loadLocalProfile() ?? demoDeveloperProfile;
}

export function saveLocalProfile(profile: LocalProfile): LocalProfile {
  const saved = profileSchema.parse(profile);
  window.localStorage.setItem(localProfileStorageKey, JSON.stringify(saved));
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

const maxImageWidth = 960;
const maxImageHeight = 600;

/**
 * Downscales an uploaded cover to a small JPEG data URL. The profile lives in localStorage
 * (about 5 MB per site), so storing original photos would fail after one or two projects.
 */
export function readProjectImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Not an image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxImageWidth / image.width, maxImageHeight / image.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      // JPEG has no transparency; paint white so transparent PNGs don't turn black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unreadable image"));
    };
    image.src = url;
  });
}

export const localDeveloperId = "local-profile";

const projectColors = ["project-blue", "project-green", "project-violet", "project-ink"];

/**
 * Presents the browser-saved profile as a catalog entry. Fields the form doesn't collect stay
 * empty (rate is NaN), so filters on them exclude this profile instead of guessing.
 */
export function localProfileToDeveloper(profile: LocalProfile): Developer {
  return {
    id: localDeveloperId,
    isLocal: true,
    name: profile.name.trim(),
    role: profile.role.trim(),
    // loadLocalProfile already mapped these onto catalog values.
    seniority: profile.seniority,
    location: profile.location.trim(),
    workMode: profile.workMode,
    availability: profile.availability,
    bio: profile.bio.trim(),
    skills: profile.skills,
    experience: "",
    // The GitHub avatar stands in for a photo; the form has no upload for one.
    image: githubAvatarUrl(profileLink(profile.github) ?? "") ?? "",
    rate: Number.NaN,
    hiringTypes: [],
    // Addresses the developer typed themselves, so they open for real.
    links: {
      github: profileLink(profile.github) ?? "",
      linkedin: profileLink(profile.linkedin) ?? "",
      ...(profileLink(profile.website) ? { website: profileLink(profile.website) ?? "" } : {}),
      verified: true,
    },
    projects: profile.projects.map((project, index) => ({
      name: project.name,
      description: project.description,
      tech: project.tech,
      color: projectColors[index % projectColors.length] ?? "project-blue",
      image: project.image,
      links: { github: profileLink(project.github) ?? "", demo: profileLink(project.demo) ?? "" },
    })),
  };
}
