import { and, asc, count, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Lang } from "@/lib/i18n";
import {
  kindCategory,
  notificationsPageSize,
  type AppNotification,
  type NotificationData,
  type NotificationKind,
  type NotificationsPage,
  type Preferences,
} from "@/lib/notifications";
import type { Db } from "./db";
import { emailOutbox, notifications, users } from "./db/schema";
import { sendEmail, type Email } from "./email";
import type { Tx } from "./profiles";
import { log } from "./log";

/**
 * Notifications and their e-mails. An event records its notification and queues its e-mail in the
 * same transaction, once per dedupe key, so retrying the request or running it twice adds nothing.
 * The e-mail goes out right after the request saves the event; when that fails, the next requests
 * and the cron (/api/cron/notifications) try again, a few times, spaced out. The queue is a table,
 * so nothing waits in a server's memory.
 */

/** A database or an open transaction. */
export type Conn = Db | Tx;

/** Tries per e-mail before giving up on it. */
export const maxAttempts = 5;
/** Minutes to wait after each failed try. */
const retryMinutes = [1, 5, 30, 120];
/** How long a delivery holds an e-mail: past it, another may take it over (the first crashed). */
const sendingHoldMs = 5 * 60_000;
/** Other waiting e-mails each request delivers along with its own. */
const extraPerRequest = 3;

export type NotificationInput = {
  /** The account it's for. */
  userId: string;
  kind: NotificationKind;
  data: NotificationData;
  /** The event, so it notifies once, such as "meeting:<id>:proposed". */
  dedupeKey: string;
  /** Its e-mail, worded in the account's language; null when it sends none. */
  email: Email | null;
};

/** Who an account is, for the e-mails it gets: its sign-in address, name and language. */
export async function recipient(db: Conn, userId: string) {
  const [row] = await db
    .select({ email: users.email, name: users.name, language: users.language })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new Error(`No account ${userId}`);
  return row;
}

/**
 * Records the notification and queues its e-mail, unless the event already notified. Returns the
 * queued e-mail, for deliverEmails, or null.
 */
export async function notify(db: Conn, input: NotificationInput): Promise<string | null> {
  const [created] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      kind: input.kind,
      data: input.data,
      dedupeKey: input.dedupeKey,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (!created || !input.email) return null;
  const [queued] = await db
    .insert(emailOutbox)
    .values({
      userId: input.userId,
      notificationId: created.id,
      category: kindCategory[input.kind],
      email: input.email,
      dedupeKey: `${input.userId}:${input.dedupeKey}`,
    })
    .onConflictDoNothing()
    .returning({ id: emailOutbox.id });
  return queued?.id ?? null;
}

export type Delivery = { sent: number; skipped: number; retrying: number; failed: number };

/**
 * Sends the queued e-mails that are due: `ids` first, then up to `others` more, oldest first. Each
 * is held while it's sent, so two deliveries never send the same one; Resend also gets its id as
 * the idempotency key. An e-mail whose category the account turned off since is skipped. A failed
 * one waits longer each time, then is given up after maxAttempts.
 */
export async function deliverEmails(
  db: Db,
  {
    ids = [],
    others = 0,
    now = Date.now(),
    send = sendEmail,
  }: {
    ids?: string[];
    others?: number;
    now?: number;
    send?: typeof sendEmail;
  } = {},
): Promise<Delivery> {
  const at = new Date(now);
  // A first try is always due: the queue's clock (the database's) may run ahead of this one.
  const due = and(
    or(eq(emailOutbox.attempts, 0), lte(emailOutbox.nextAttemptAt, at)),
    or(
      eq(emailOutbox.status, "pending"),
      and(eq(emailOutbox.status, "sending"), lte(emailOutbox.lockedUntil, at)),
    ),
  );
  const hold = (where: ReturnType<typeof and>) =>
    db
      .update(emailOutbox)
      .set({
        status: "sending",
        lockedUntil: new Date(now + sendingHoldMs),
        attempts: sql`${emailOutbox.attempts} + 1`,
      })
      .where(and(due, where))
      .returning();
  const held = [
    ...(ids.length ? await hold(inArray(emailOutbox.id, ids)) : []),
    ...(others > 0
      ? await hold(
          inArray(
            emailOutbox.id,
            db
              .select({ id: emailOutbox.id })
              .from(emailOutbox)
              .where(due)
              .orderBy(asc(emailOutbox.nextAttemptAt))
              .limit(others)
              .for("update", { skipLocked: true }),
          ),
        )
      : []),
  ];
  const delivery: Delivery = { sent: 0, skipped: 0, retrying: 0, failed: 0 };
  for (const row of held) {
    const finish = (fields: Partial<typeof emailOutbox.$inferInsert>) =>
      db
        .update(emailOutbox)
        .set({ lockedUntil: null, ...fields })
        .where(and(eq(emailOutbox.id, row.id), eq(emailOutbox.status, "sending")));
    const [account] = await db
      .select({ emailOff: users.emailOff, suspendedAt: users.suspendedAt })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);
    if (!account || account.suspendedAt || account.emailOff.includes(row.category)) {
      await finish({ status: "skipped" });
      delivery.skipped += 1;
      continue;
    }
    try {
      await send(row.email as Email, { idempotencyKey: row.id });
      await finish({ status: "sent", sentAt: new Date(), lastError: null });
      delivery.sent += 1;
    } catch (error) {
      const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      const giveUp = row.attempts >= maxAttempts;
      log(giveUp ? "error" : "warn", "email.send_failed", {
        emailId: row.id,
        category: row.category,
        attempt: row.attempts,
        maxAttempts,
        givingUp: giveUp,
        error: lastError,
      });
      await finish(
        giveUp
          ? { status: "failed", lastError }
          : {
              status: "pending",
              lastError,
              nextAttemptAt: new Date(
                now + (retryMinutes[row.attempts - 1] ?? retryMinutes.at(-1) ?? 1) * 60_000,
              ),
            },
      );
      delivery[giveUp ? "failed" : "retrying"] += 1;
    }
  }
  return delivery;
}

/**
 * Delivers the e-mails a request just queued, and a few others waiting, once its change is saved.
 * Never fails the request: what doesn't go out now stays queued.
 */
export async function deliverQueued(db: Db, ids: (string | null)[]) {
  try {
    await deliverEmails(db, {
      ids: ids.filter((id): id is string => id !== null),
      others: extraPerRequest,
    });
  } catch (error) {
    log("error", "email.delivery_failed", { error });
  }
}

/** The account's notifications, newest first, a page at a time after the notification `after`. */
export async function listNotifications(
  db: Db,
  userId: string,
  after?: string,
): Promise<NotificationsPage> {
  const mine = eq(notifications.userId, userId);
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        mine,
        after
          ? sql`(${notifications.createdAt}, ${notifications.id}) < (select n.created_at, n.id from ${notifications} n where n.id = ${after} and n.user_id = ${userId})`
          : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(notificationsPageSize + 1);
  const page = rows.slice(0, notificationsPageSize);
  return {
    notifications: page.map((row): AppNotification => ({
      id: row.id,
      kind: row.kind,
      data: row.data,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    })),
    next: rows.length > notificationsPageSize ? (page.at(-1)?.id ?? null) : null,
    unread: await unreadCount(db, userId),
  };
}

export async function unreadCount(db: Db, userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.total ?? 0;
}

/** Marks the account's notifications as read: these ones, or all of them. */
export async function markNotificationsRead(
  db: Db,
  userId: string,
  ids: string[] | "all",
  now = Date.now(),
) {
  if (Array.isArray(ids) && !ids.length) return;
  await db
    .update(notifications)
    .set({ readAt: new Date(now) })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        ids === "all" ? undefined : inArray(notifications.id, ids),
      ),
    );
}

export async function loadPreferences(db: Db, userId: string): Promise<Preferences> {
  const [row] = await db
    .select({ language: users.language, emailOff: users.emailOff })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? { language: "pt", emailOff: [] };
}

/** Expects validated preferences. */
export async function savePreferences(
  db: Db,
  userId: string,
  preferences: { [Key in keyof Preferences]?: Preferences[Key] | undefined },
) {
  const fields = {
    ...(preferences.language ? { language: preferences.language } : {}),
    ...(preferences.emailOff ? { emailOff: [...new Set(preferences.emailOff)] } : {}),
  };
  if (Object.keys(fields).length) await db.update(users).set(fields).where(eq(users.id, userId));
  return loadPreferences(db, userId);
}

/** Only the language, as the header's picker changes it. */
export const saveLanguage = (db: Db, userId: string, language: Lang) =>
  savePreferences(db, userId, { language });
