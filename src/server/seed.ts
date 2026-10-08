import type { LocalProfile } from "@/lib/local-profile";
import { hashPassword } from "./auth";
import type { Db } from "./db";
import { users } from "./db/schema";
import { loadProfile, saveProfile } from "./profiles";

/**
 * Starting data for a new database: the two test accounts and the developer's profile. Applied by
 * `npm run db:seed` (scripts/seed.ts) and before each end-to-end test; never by the app itself.
 */
export const seedPassword = "teste1234";
export const seedDeveloperId = "demo-developer";
export const seedCompanyId = "demo-company";

const seedAccounts = [
  {
    id: seedDeveloperId,
    email: "teste.dev@example.com",
    accountType: "DEVELOPER" as const,
    name: "Gabriel Botelho",
    jobTitle: "Full Stack Developer",
    companyName: null,
    cnpj: null,
  },
  {
    id: seedCompanyId,
    email: "teste.emp@example.com",
    accountType: "COMPANY" as const,
    name: "Recrutadora Teste",
    jobTitle: "Tech Recruiter",
    companyName: "Empresa Teste",
    // A valid example number, not a real company.
    cnpj: "11222333000181",
  },
];

/** Gabriel Botelho, with his real links; the photo comes from his GitHub avatar. */
export const seedDeveloperProfile: LocalProfile = {
  name: "Gabriel Botelho",
  role: "Full Stack Developer",
  location: "Uberaba, MG",
  seniority: "Pleno",
  availability: "Disponível agora",
  workMode: "Remoto",
  bio: "Desenvolvo aplicações full stack com React e Node.js, integrando interfaces, APIs e bancos relacionais.",
  // No upload: the photo comes from the GitHub avatar.
  photo: "",
  github: "https://github.com/Gabs-X",
  linkedin: "https://www.linkedin.com/in/gabriel-anthony-7688bb224/",
  website: "https://gabrielanthony.vercel.app",
  skills: ["React", "Next.js", "Node.js", "NestJS", "C#", "PostgreSQL"],
  experienceYears: 5,
  hiringTypes: ["Freelancer", "PJ"],
  projects: [
    {
      id: "pulse-commerce",
      name: "Pulse Commerce",
      description: "Checkout modular que reduziu o abandono em 24%.",
      tech: ["Next.js", "Node.js"],
      image: "",
      github: "",
      demo: "",
    },
    {
      id: "atlas-crm",
      name: "Atlas CRM",
      description: "Plataforma comercial com automações e analytics.",
      tech: ["React", "NestJS"],
      image: "",
      github: "",
      demo: "",
    },
    {
      id: "core-banking",
      name: "Core Banking",
      description: "APIs resilientes para operações financeiras.",
      tech: ["C#", "PostgreSQL"],
      image: "",
      github: "",
      demo: "",
    },
  ],
};

/** Adds whatever of the starting data is missing; accounts and profiles already there stay. */
export async function seedDatabase(db: Db) {
  const passwordHash = await hashPassword(seedPassword);
  await db
    .insert(users)
    // Confirmed from the start: nobody receives e-mails at these addresses.
    .values(
      seedAccounts.map((account) => ({ ...account, passwordHash, emailVerifiedAt: new Date() })),
    )
    .onConflictDoNothing();
  if (!(await loadProfile(db, seedDeveloperId)))
    await saveProfile(db, seedDeveloperId, seedDeveloperProfile);
}
