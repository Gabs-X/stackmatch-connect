import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
