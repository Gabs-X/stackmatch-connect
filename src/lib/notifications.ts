import { z } from "zod";

/**
 * What the notification center shows and which e-mails an account can turn off. Every notification
 * shows in the center; its e-mail goes out unless the account turned off its category. Codes, the
 * notice of a changed e-mail and support replies aren't notifications: they always go out.
 */

/** The e-mails an account can turn off, one switch each. */
export const emailCategories = ["interest", "proposal", "answer", "application"] as const;
export type EmailCategory = (typeof emailCategories)[number];

/** The categories each account type receives, for its settings. */
export const categoriesFor = {
  developer: ["interest", "proposal", "answer", "application"],
  company: ["proposal", "answer", "application"],
} as const satisfies Record<"developer" | "company", readonly EmailCategory[]>;

export const notificationKinds = [
  /** A company marked interest in the developer. */
  "interest",
  /** A company proposed a call. */
  "proposal",
  /** The other side moved or canceled a call. */
  "meeting_rescheduled",
  "meeting_canceled",
  /** The other side accepted or declined the time proposed. */
  "meeting_accepted",
  "meeting_declined",
  /** To the company: a developer applied or withdrew. */
  "application_received",
  "application_withdrawn",
  /** To the developer: the application ended without them, or the job closed or went away. */
  "application_update",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

export const kindCategory: Record<NotificationKind, EmailCategory> = {
  interest: "interest",
  proposal: "proposal",
  meeting_rescheduled: "proposal",
  meeting_canceled: "proposal",
  meeting_accepted: "answer",
  meeting_declined: "answer",
  application_received: "application",
  application_withdrawn: "application",
  application_update: "application",
};

export type ApplicationUpdate = "not_advanced" | "closed" | "job_closed" | "job_deleted";

/**
 * What a notification says, kept as data so the center words it in the screen's language. Names
 * and the job title are as written when it happened.
 */
export type NotificationData = {
  /** Who acted: the company's or the developer's name. */
  actor: string;
  /** The job it's about, if any. */
  job?: string;
  /** The call's time, as "2026-10-02" and "10:30". */
  date?: string;
  time?: string;
  update?: ApplicationUpdate;
  /** The page that shows it, such as "/interests". */
  path: string;
};

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  data: NotificationData;
  createdAt: string;
  readAt: string | null;
};

export const notificationsPageSize = 20;

export type NotificationsPage = {
  notifications: AppNotification[];
  next: string | null;
  unread: number;
};

export const preferencesSchema = z.object({
  language: z.enum(["pt", "en"]),
  /** The e-mails turned off. */
  emailOff: z.array(z.enum(emailCategories)).max(emailCategories.length),
});
export type Preferences = z.infer<typeof preferencesSchema>;
