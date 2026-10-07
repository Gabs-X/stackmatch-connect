import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
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
  /** When the account confirmed its e-mail with a code; null until then, and it can't act. */
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** E-mails with a code sent per client IP, for the limit in src/server/email-throttle.ts. */
export const emailSends = pgTable(
  "email_sends",
  {
    id: serial("id").primaryKey(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_sends_ip_created_at_idx").on(table.ip, table.createdAt)],
);

/** Assistant questions per client IP, for the limit in src/server/assistant-throttle.ts. */
export const assistantRequests = pgTable(
  "assistant_requests",
  {
    id: serial("id").primaryKey(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assistant_requests_ip_created_at_idx").on(table.ip, table.createdAt)],
);

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

/**
 * Failed sign-ins, one row each, keyed by "email:<address>" and "ip:<address>" (see
 * src/server/login-throttle.ts). Rows older than the throttle window are deleted as new ones come.
 */
export const loginFailures = pgTable(
  "login_failures",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_failures_key_created_at_idx").on(table.key, table.createdAt)],
);

export const emailCodePurpose = pgEnum("email_code_purpose", [
  "VERIFY_EMAIL",
  "RESET_PASSWORD",
  "CHANGE_EMAIL",
]);

/** The code e-mailed to an account, one per purpose; a new one replaces the previous. */
export const emailCodes = pgTable(
  "email_codes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: emailCodePurpose("purpose").notNull(),
    /** SHA-256 of the code, never the code itself. */
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** For CHANGE_EMAIL: the new address, which the code was sent to. */
    targetEmail: text("target_email"),
    /** Wrong guesses so far; the code stops working after a few. */
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.purpose] })],
);

/**
 * How a hiring account shows up to developers: the company details and the person they talk to.
 * Until it's saved, the sign-up details stand in (see defaultCompanySettings).
 */
export const companyProfiles = pgTable("company_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  website: text("website").notNull().default(""),
  location: text("location").notNull().default(""),
  about: text("about").notNull().default(""),
  contactName: text("contact_name").notNull(),
  contactRole: text("contact_role").notNull().default(""),
  /** Where developers' replies go. */
  contactEmail: text("contact_email").notNull(),
  phone: text("phone").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A company's shortlist. */
export const savedTalents = pgTable(
  "saved_talents",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.companyId, table.developerId] })],
);

/** A company marked a developer as interesting in Discover; the developer sees who it was. */
export const interests = pgTable(
  "interests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("interests_company_developer_idx").on(table.companyId, table.developerId),
    index("interests_developer_id_idx").on(table.developerId),
  ],
);

/**
 * A company proposed one time for a call. The developer gets it by e-mail and replies straight to
 * the company, so names and the reply address are kept as they were sent.
 */
export const meetingRequests = pgTable(
  "meeting_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    developerName: text("developer_name").notNull(),
    /** Brasília time (GMT-3), as offered in the dialog. */
    date: date("date", { mode: "string" }).notNull(),
    time: text("time").notNull(),
    message: text("message").notNull().default(""),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    /** Reply-To of the e-mail the developer receives. */
    replyToEmail: text("reply_to_email").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("meeting_requests_company_id_idx").on(table.companyId),
    index("meeting_requests_developer_id_idx").on(table.developerId),
  ],
);

/**
 * Every interest mark a company made, kept when it's undone: the daily limit counts marks, and the
 * developer is e-mailed about a company at most once in a while (see src/lib/outreach.ts).
 */
export const interestEvents = pgTable(
  "interest_events",
  {
    id: serial("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Whether this mark e-mailed the developer. */
    notified: boolean("notified").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("interest_events_company_created_at_idx").on(table.companyId, table.createdAt)],
);

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
  /** Square JPEG data URL from the form, or "" to fall back to the GitHub avatar. */
  photo: text("photo").notNull().default(""),
  githubUrl: text("github_url").notNull().default(""),
  linkedinUrl: text("linkedin_url").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skills = pgTable(
  "skills",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    /** In the reference catalog (drizzle/0010_skill_catalog.sql): suggested before anyone uses it. */
    curated: boolean("curated").notNull().default(false),
  },
  // One spelling per skill: "React" and "react" are the same.
  (table) => [uniqueIndex("skills_name_lower_idx").on(sql`lower(${table.name})`)],
);

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
