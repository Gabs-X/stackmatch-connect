import { z } from "zod";
import {
  availabilityOptions,
  githubAvatarUrl,
  hiringOptions,
  seniorityOptions,
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

const text = (max: number) => z.string().trim().max(max);
const link = text(500);

const profileSchema = z.object({
  name: text(120),
  role: text(120),
  location: text(120),
  seniority: z.string(),
  availability: z.string(),
  workMode: z.string(),
  bio: text(2000),
  github: link,
  linkedin: link,
  website: link,
  skills: z.array(text(50).min(1)).max(40),
  experienceYears: z.number().int().min(0).max(60).nullable(),
  rate: z.number().min(0).max(10000).nullable(),
  hiringTypes: z.array(z.string()),
  projects: z
    .array(
      projectSchema.extend({
        name: text(80).min(1),
        description: text(400),
        tech: z.array(text(50).min(1)).max(20),
        // Covers are downscaled to about 100 KB; anything else isn't one of ours.
        image: z
          .string()
          .max(1_000_000)
          .refine((value) => !value || value.startsWith("data:image/jpeg;base64,")),
        github: link,
        demo: link,
      }),
    )
    .max(20),
});

/**
 * What the server accepts when a developer saves their profile: the form's shape, with the
 * required fields filled in and the options the Discover filters know.
 */
export const profileInputSchema = profileSchema
  .extend({
    seniority: z.enum(seniorityOptions),
    availability: z.enum(availabilityOptions),
    workMode: z.enum(workModeOptions),
    hiringTypes: z.array(z.enum(hiringOptions)),
  })
  .refine((profile) => missingProfileFields(profile).length === 0, "required");

export type LocalProfile = z.infer<typeof profileSchema>;

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
  experienceYears: null,
  rate: null,
  hiringTypes: [],
  projects: [],
};

/** What a profile needs before it's saved, and the form step that asks for it. */
export const requiredProfileFields = {
  name: 1,
  role: 1,
  location: 1,
  seniority: 1,
  workMode: 1,
  availability: 1,
  bio: 1,
  skills: 2,
} as const satisfies Partial<Record<keyof LocalProfile, number>>;

export type RequiredProfileField = keyof typeof requiredProfileFields;

/** Required fields still blank, in form order. Projects, links, rate and experience are optional. */
export function missingProfileFields(profile: LocalProfile): RequiredProfileField[] {
  return (Object.keys(requiredProfileFields) as RequiredProfileField[]).filter((field) => {
    const value = profile[field];
    return typeof value === "string" ? !value.trim() : value.length === 0;
  });
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
 * Downscales an uploaded cover to a small JPEG data URL, which the profile stores as is until
 * project covers move to file storage.
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

const projectColors = ["project-blue", "project-green", "project-violet", "project-ink"];

/**
 * Presents an account's profile as a catalog entry, identified by the account id. Answers left
 * blank stay empty (rate is NaN), so filters on them exclude it instead of guessing.
 */
export function localProfileToDeveloper(profile: LocalProfile, accountId: string): Developer {
  return {
    id: accountId,
    name: profile.name.trim(),
    role: profile.role.trim(),
    // The schema already mapped these onto catalog values.
    seniority: profile.seniority,
    location: profile.location.trim(),
    workMode: profile.workMode,
    availability: profile.availability,
    bio: profile.bio.trim(),
    skills: profile.skills,
    experience: experienceLabel(profile.experienceYears),
    // The GitHub avatar stands in for a photo; the form has no upload for one.
    image: githubAvatarUrl(profileLink(profile.github) ?? "") ?? "",
    rate: profile.rate ?? Number.NaN,
    hiringTypes: profile.hiringTypes,
    links: {
      github: profileLink(profile.github) ?? "",
      linkedin: profileLink(profile.linkedin) ?? "",
      ...(profileLink(profile.website) ? { website: profileLink(profile.website) ?? "" } : {}),
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

/** Same wording as the catalog ("5 anos"), which the interface translates. */
export function experienceLabel(years: number | null) {
  if (years === null) return "";
  return years === 1 ? "1 ano" : `${years} anos`;
}
