import { z } from "zod";

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
