import { z } from "zod";
import { isLocation } from "./cities";
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
  /** Cover made by readProjectImage, or "" for none: see isProfileImage. */
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
/**
 * A profile image: "" for none, a JPEG data URL for a new one (downscaled in the browser to about
 * 100 KB), or the URL file storage gave an image saved before. Anything else isn't one of ours.
 */
export function isProfileImage(value: string) {
  if (!value || value.startsWith("data:image/jpeg;base64,")) return true;
  if (value.startsWith("/uploads/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

const profileImage = z.string().max(1_000_000).refine(isProfileImage);

const profileSchema = z.object({
  name: text(120),
  role: text(120),
  location: text(120),
  seniority: z.string(),
  availability: z.string(),
  workMode: z.string(),
  bio: text(2000),
  /** Square photo made by readProfilePhoto, or "" to use the GitHub avatar: see isProfileImage. */
  photo: profileImage,
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
        image: profileImage,
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
    // A city chosen in the form, with its state; left blank, missingProfileFields reports it.
    location: text(120).refine((value) => !value || isLocation(value), "location"),
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
  photo: "",
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

type ImageArea = { x: number; y: number; width: number; height: number };

/**
 * Draws part of an uploaded image onto a canvas of the given size and returns it as a JPEG data
 * URL. The profile stores these as is until images move to file storage, so they stay small.
 */
function readImage(
  file: File,
  layout: (width: number, height: number) => { source: ImageArea; width: number; height: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Not an image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const { source, width, height } = layout(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      // JPEG has no transparency; paint white so transparent PNGs don't turn black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        source.x,
        source.y,
        source.width,
        source.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unreadable image"));
    };
    image.src = url;
  });
}

export const projectCoverSize = { width: 960, height: 600 };

/** A project cover: the whole image, downscaled to fit 960×600. */
export function readProjectImage(file: File) {
  return readImage(file, (width, height) => {
    const scale = Math.min(1, projectCoverSize.width / width, projectCoverSize.height / height);
    return {
      source: { x: 0, y: 0, width, height },
      width: width * scale,
      height: height * scale,
    };
  });
}

export const profilePhotoSize = 512;

/** A profile photo: the centered square of the image, downscaled to 512×512 at most. */
export function readProfilePhoto(file: File) {
  return readImage(file, (width, height) => {
    const side = Math.min(width, height);
    const size = Math.min(side, profilePhotoSize);
    return {
      source: { x: (width - side) / 2, y: (height - side) / 2, width: side, height: side },
      width: size,
      height: size,
    };
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
    // The uploaded photo, else the GitHub avatar; without either, the card shows initials.
    image: profile.photo || (githubAvatarUrl(profileLink(profile.github) ?? "") ?? ""),
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
