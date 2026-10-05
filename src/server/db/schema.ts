import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const accountType = pgEnum("account_type", ["DEVELOPER", "COMPANY"]);

export const users = pgTable("users", {
  // Text instead of uuid: the demo accounts keep the ids the front already uses ("demo-developer").
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** Always stored trimmed and lowercased. */
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  accountType: accountType("account_type").notNull(),
  name: text("name").notNull(),
  /** Professional title for developers (required) or the recruiter's role (optional). */
  jobTitle: text("job_title").notNull().default(""),
  /** Hiring accounts only. */
  companyName: text("company_name"),
  /** Hiring accounts only: 14 digits, no punctuation. */
  cnpj: text("cnpj"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token, so a leaked table can't be used to sign in. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export type UserRow = typeof users.$inferSelect;

/** A developer account's public profile; companies find it in Discover once it exists. */
export const developerProfiles = pgTable("developer_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  location: text("location").notNull(),
  // Text, not enums: the values are the catalog options the filters use ("Pleno", "Remoto").
  seniority: text("seniority").notNull(),
  workMode: text("work_mode").notNull(),
  availability: text("availability").notNull(),
  hiringTypes: text("hiring_types").array().notNull().default([]),
  experienceYears: integer("experience_years"),
  /** BRL per hour. */
  hourlyRate: doublePrecision("hourly_rate"),
  bio: text("bio").notNull(),
  githubUrl: text("github_url").notNull().default(""),
  linkedinUrl: text("linkedin_url").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const developerSkills = pgTable(
  "developer_skills",
  {
    developerId: text("developer_id")
      .notNull()
      .references(() => developerProfiles.userId, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id),
    /** The order the developer listed them in. */
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.developerId, table.skillId] })],
);

export const projects = pgTable(
  "projects",
  {
    // Generated on every save: ids from the form (and the demo profile) aren't unique across accounts.
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    developerId: text("developer_id")
      .notNull()
      .references(() => developerProfiles.userId, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Downscaled JPEG data URL from the form, or "". Moves to file storage later. */
    coverImage: text("cover_image").notNull().default(""),
    githubUrl: text("github_url").notNull().default(""),
    demoUrl: text("demo_url").notNull().default(""),
    position: integer("position").notNull(),
  },
  (table) => [index("projects_developer_id_idx").on(table.developerId)],
);

/** The project's stack ("tech" in the front). */
export const projectSkills = pgTable(
  "project_skills",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.skillId] })],
);
