import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  ApplicationStatus,
  CandidateEvent,
  CandidateEventKind,
  CompensationPeriod,
  JobSnapshot,
  JobStage,
  JobStatus,
} from "@/lib/jobs";
import type { Lang } from "@/lib/i18n";
import type { MeetingSide, MeetingStatus } from "@/lib/meeting-requests";
import type { EmailCategory, NotificationData, NotificationKind } from "@/lib/notifications";
import type { ReportReason, ReportStatus, ReportTarget } from "@/lib/moderation";
import type { TicketCategory, TicketStatus } from "@/lib/support";

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
  /** The account's language: its notifications' e-mails go out in it. */
  language: text("language").$type<Lang>().notNull().default("pt"),
  /** The e-mail categories the account turned off (see src/lib/notifications.ts). */
  emailOff: text("email_off")
    .array()
    .$type<EmailCategory[]>()
    .notNull()
    .default(sql`'{}'`),
  /** Set while the team has the account suspended (see src/lib/moderation.ts). */
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
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

/** What the assistant's replies cost each month, for the cap in src/server/assistant-budget.ts. */
export const assistantSpend = pgTable("assistant_spend", {
  /** Brasília time, as "2026-10". */
  month: text("month").primaryKey(),
  /** Millionths of a US dollar. */
  costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
});

/** The assistant chat of each account, so it follows the account and leaves with it on sign-out. */
export const assistantConversations = pgTable("assistant_conversations", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  messages: jsonb("messages").$type<{ role: "user" | "assistant"; content: string }[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
    /** The job the latest mark came from, if any, and what it said then. */
    jobId: text("job_id").references((): AnyPgColumn => jobs.id, { onDelete: "set null" }),
    job: jsonb("job").$type<JobSnapshot>(),
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
    /** The job the proposal is about, if any, and what it said when sent. */
    jobId: text("job_id").references((): AnyPgColumn => jobs.id, { onDelete: "set null" }),
    job: jsonb("job").$type<JobSnapshot>(),
    /**
     * Pending until the side that didn't propose the current time accepts or declines it; either
     * side can cancel it (see src/server/meetings.ts).
     */
    status: text("status").$type<MeetingStatus>().notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    /** Who proposed the current time: the company, or either side after a reschedule. */
    proposedBy: text("proposed_by").$type<MeetingSide>().notNull().default("company"),
    /** How many times the call was moved to another time. */
    reschedules: integer("reschedules").notNull().default(0),
    canceledBy: text("canceled_by").$type<MeetingSide>(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    /** What the side that rescheduled or canceled wrote, if anything; the latest one. */
    updateMessage: text("update_message").notNull().default(""),
    /**
     * The company's screen language when it proposed. Unused since e-mails go out in each
     * recipient's account language (users.language).
     */
    language: text("language").$type<Lang>().notNull().default("pt"),
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
  bio: text("bio").notNull(),
  /** Square JPEG data URL from the form, or "" to fall back to the GitHub avatar. */
  photo: text("photo").notNull().default(""),
  githubUrl: text("github_url").notNull().default(""),
  linkedinUrl: text("linkedin_url").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  /**
   * Goes up by one with every save. A save names the version it started from and is refused when
   * the profile changed since, so an edit made elsewhere is never overwritten unseen.
   */
  version: integer("version").notNull().default(1),
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

/**
 * A request for help from a person, sent from the Support page. The team answers by e-mail and
 * closes it here; tickets outlive the account that opened them, without the link to it.
 */
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    category: text("category").$type<TicketCategory>().notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    /** The chat with Ada when the author chose to attach it. */
    conversation: jsonb("conversation").$type<{ role: "user" | "assistant"; content: string }[]>(),
    /** The screen's language when the ticket was opened, for the e-mails about it. */
    language: text("language").$type<"pt" | "en">().notNull().default("pt"),
    status: text("status").$type<TicketStatus>().notNull().default("open"),
    /** When and by which admin (e-mail) the ticket was resolved; null while open. */
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("support_tickets_user_id_idx").on(table.userId),
    index("support_tickets_ip_created_at_idx").on(table.ip, table.createdAt),
    index("support_tickets_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

/**
 * Machine translations of the free text an account wrote (bio, role, project descriptions, the
 * company's description), keyed by a hash of the original, one row per language. Tied to the
 * account, so they go away with it, and pruned when the text they translate is gone.
 */
export const textTranslations = pgTable(
  "text_translations",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the original text. */
    hash: text("hash").notNull(),
    language: text("language").$type<"pt" | "en">().notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.hash, table.language] })],
);

/** Each translation an account caused, for the per-account limit (see translation-throttle.ts). */
export const translationRequests = pgTable(
  "translation_requests",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("translation_requests_owner_id_created_at_idx").on(table.ownerId, table.createdAt),
  ],
);

/**
 * A company's job opening or project scope. Options are catalog values, like the profiles', so
 * they turn straight into Discover filters (see src/lib/jobs.ts).
 */
export const jobs = pgTable(
  "jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    seniority: text("seniority").array().notNull().default([]),
    workModes: text("work_modes").array().notNull().default([]),
    hiringTypes: text("hiring_types").array().notNull().default([]),
    availability: text("availability").array().notNull().default([]),
    location: text("location").notNull().default(""),
    /** BRL, per compensationPeriod. */
    compensationMin: integer("compensation_min"),
    compensationMax: integer("compensation_max"),
    compensationPeriod: text("compensation_period")
      .$type<CompensationPeriod>()
      .notNull()
      .default("month"),
    status: text("status").$type<JobStatus>().notNull().default("open"),
    /** In the job board, where any developer can see it while it's open and offer themselves. */
    listed: boolean("listed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("jobs_company_id_idx").on(table.companyId),
    index("jobs_listed_idx").on(table.listed, table.status, table.createdAt),
  ],
);

/** A job's stack, from the shared skill catalog: must-haves and nice-to-haves. */
export const jobSkills = pgTable(
  "job_skills",
  {
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id),
    required: boolean("required").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.jobId, table.skillId] })],
);

/**
 * The developers a company reached for a job, or who offered themselves for it, and how far each
 * got. Saving, marking interest or proposing a call inside the job adds the developer or moves them
 * forward; the company can also move them by hand.
 */
export const jobCandidates = pgTable(
  "job_candidates",
  {
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stage: text("stage").$type<JobStage>().notNull(),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * No longer used: applications live in job_applications since migration 0032, which copied
     * these. Kept for code still running during that deploy; to drop in a later migration.
     */
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    applicationMessage: text("application_message").notNull().default(""),
    /** The company's private note on the developer, for this job; never shown to the developer. */
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.jobId, table.developerId] }),
    index("job_candidates_developer_id_idx").on(table.developerId),
  ],
);

/**
 * Developers' applications for jobs: the developer's own record, kept with a copy of the job as it
 * was, so it stays when the company takes them out of the job or deletes it. One per job and
 * developer; withdrawing is final.
 */
export const jobApplications = pgTable(
  "job_applications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Null once the job is deleted. */
    jobId: text("job_id").references((): AnyPgColumn => jobs.id, { onDelete: "set null" }),
    companyId: text("company_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    job: jsonb("job").$type<JobSnapshot>().notNull(),
    message: text("message").notNull().default(""),
    status: text("status").$type<ApplicationStatus>().notNull().default("submitted"),
    /**
     * The developer's screen language when applying. Unused since e-mails go out in each
     * recipient's account language (users.language).
     */
    language: text("language").$type<Lang>().notNull().default("pt"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("job_applications_job_developer_idx").on(table.jobId, table.developerId),
    index("job_applications_developer_applied_idx").on(
      table.developerId,
      table.appliedAt,
      table.id,
    ),
    index("job_applications_company_id_idx").on(table.companyId),
  ],
);

/**
 * What happened to each developer in a company's jobs. The company sees a job's events; the
 * developer only the ones marked visible, through their application.
 */
export const jobCandidateEvents = pgTable(
  "job_candidate_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Null once the job is deleted; only events the developer sees are kept then. */
    jobId: text("job_id").references((): AnyPgColumn => jobs.id, { onDelete: "set null" }),
    companyId: text("company_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    developerId: text("developer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The application it concerns, if the developer applied. */
    applicationId: text("application_id").references((): AnyPgColumn => jobApplications.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").$type<CandidateEventKind>().notNull(),
    fromStage: text("from_stage").$type<JobStage>(),
    toStage: text("to_stage").$type<JobStage>(),
    actor: text("actor").$type<CandidateEvent["actor"]>().notNull(),
    visibleToDeveloper: boolean("visible_to_developer").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("job_candidate_events_job_developer_idx").on(
      table.jobId,
      table.developerId,
      table.createdAt,
    ),
    index("job_candidate_events_application_idx").on(table.applicationId),
  ],
);

/**
 * The notification center: what happened to an account, once per event (the dedupe key). The data
 * is worded on the screen, in its language.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<NotificationKind>().notNull(),
    data: jsonb("data").$type<NotificationData>().notNull(),
    /** One notification per event, such as "meeting:<id>:proposed". */
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("notifications_user_dedupe_idx").on(table.userId, table.dedupeKey),
    index("notifications_user_created_idx").on(table.userId, table.createdAt, table.id),
  ],
);

/**
 * E-mails of notifications waiting to go out, and how it went: written with the event, sent right
 * after it and, when that fails, again by the next requests and the cron (src/server/outbox.ts).
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** The account it's for: its preferences decide whether it goes out. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationId: text("notification_id").references(() => notifications.id, {
      onDelete: "cascade",
    }),
    category: text("category").$type<EmailCategory>().notNull(),
    /** The e-mail, ready to send (see Email in src/server/email.ts). */
    email: jsonb("email").$type<Record<string, unknown>>().notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    status: text("status")
      .$type<"pending" | "sending" | "sent" | "skipped" | "failed">()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    /** While "sending": when another delivery may take it over, if this one never finished. */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [index("email_outbox_status_next_idx").on(table.status, table.nextAttemptAt)],
);

/** What accounts reported about a job, a profile or a company, and how the team reviewed it. */
export const reports = pgTable(
  "reports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Null once the reporter's account is deleted; the report stays for the history. */
    reporterId: text("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type").$type<ReportTarget>().notNull(),
    /** The job's id, or the account's for a profile or a company. */
    targetId: text("target_id").notNull(),
    /** The account the content belongs to; null once it's deleted. */
    targetAccountId: text("target_account_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** The job's title or the name, as it was reported. */
    targetLabel: text("target_label").notNull(),
    reason: text("reason").$type<ReportReason>().notNull(),
    details: text("details").notNull().default(""),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** The admin's e-mail. */
    reviewedBy: text("reviewed_by"),
    reviewNote: text("review_note").notNull().default(""),
  },
  (table) => [
    index("reports_status_created_idx").on(table.status, table.createdAt),
    index("reports_reporter_created_idx").on(table.reporterId, table.createdAt),
    index("reports_target_account_idx").on(table.targetAccountId),
    // One open report per reporter and target: reporting again changes nothing.
    uniqueIndex("reports_open_reporter_target_idx")
      .on(table.reporterId, table.targetType, table.targetId)
      .where(sql`${table.status} = 'open'`),
  ],
);

/** Every suspension and lifting of an account, with who did it and why. */
export const accountSuspensions = pgTable(
  "account_suspensions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").$type<"suspended" | "lifted">().notNull(),
    reason: text("reason").notNull(),
    /** The report that led to it, if any. */
    reportId: text("report_id").references(() => reports.id, { onDelete: "set null" }),
    /** The admin's e-mail. */
    by: text("by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("account_suspensions_user_idx").on(table.userId, table.createdAt)],
);
