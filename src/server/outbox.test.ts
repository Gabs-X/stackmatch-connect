import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { emptyJob } from "@/lib/jobs";
import { notificationsPageSize } from "@/lib/notifications";
import { sendVerificationCode } from "./account-email";
import type { Db } from "./db";
import { emailOutbox, notifications } from "./db/schema";
import { outbox, type Email } from "./email";
import { applyToJob, withdrawApplication } from "./job-applications";
import { createJob, moveCandidate } from "./jobs";
import { answerMeetingRequest, rescheduleMeeting, sendMeetingRequest } from "./meetings";
import {
  deliverEmails,
  listNotifications,
  loadPreferences,
  markNotificationsRead,
  maxAttempts,
  notify,
  savePreferences,
  unreadCount,
  type NotificationInput,
} from "./outbox";
import { markInterestAndNotify } from "./outreach";
import { createCompany, createDeveloper, createTestDb } from "./test-db";

let db: Db;
let acme: AuthUser;
let marina: string;
let rafael: string;

const appUrl = "https://stackmatch.example";
// Noon in Brasília on 2026-10-01; proposal times are in GMT-3.
const now = Date.parse("2026-10-01T12:00:00-03:00");
const minute = 60_000;

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  acme = await createCompany(db, "bia@acme.com");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
  rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
});

afterEach(() => vi.unstubAllEnvs());

const email = (to = "marina@example.com"): Email => ({
  to,
  subject: "Assunto",
  text: "Texto",
  html: "<p>Texto</p>",
});

const notice = (overrides: Partial<NotificationInput> = {}): NotificationInput => ({
  userId: marina,
  kind: "interest",
  data: { actor: "Acme", path: "/interests" },
  dedupeKey: "interest:1",
  email: email(),
  ...overrides,
});

async function queued() {
  return db.select().from(emailOutbox);
}

describe("recording a notification", () => {
  it("records each event once, however many times it's notified", async () => {
    const first = await notify(db, notice());
    expect(first).not.toBeNull();
    expect(await notify(db, notice())).toBeNull();
    expect(await db.select().from(notifications)).toHaveLength(1);
    expect(await queued()).toHaveLength(1);
    // Another event, or the same key for another account, is another notification.
    await notify(db, notice({ dedupeKey: "interest:2" }));
    await notify(db, notice({ userId: rafael, email: email("rafael@example.com") }));
    expect(await db.select().from(notifications)).toHaveLength(3);
    expect(await queued()).toHaveLength(3);
  });

  it("keeps a notification without e-mail out of the queue", async () => {
    expect(await notify(db, notice({ email: null }))).toBeNull();
    expect(await db.select().from(notifications)).toHaveLength(1);
    expect(await queued()).toEqual([]);
  });

  it("saves the event and its notification together, or neither", async () => {
    await expect(
      db.transaction(async (tx) => {
        await notify(tx, notice());
        throw new Error("the change failed");
      }),
    ).rejects.toThrow("the change failed");
    expect(await db.select().from(notifications)).toEqual([]);
    expect(await queued()).toEqual([]);
  });
});

describe("delivering e-mails", () => {
  it("sends a queued e-mail once, with its id as the idempotency key", async () => {
    const id = (await notify(db, notice())) ?? "";
    const send = vi.fn(async () => undefined);
    expect(await deliverEmails(db, { ids: [id], now, send })).toEqual({
      sent: 1,
      skipped: 0,
      retrying: 0,
      failed: 0,
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ subject: "Assunto" }), {
      idempotencyKey: id,
    });
    // Sent: delivering again, by id or as a waiting one, sends nothing.
    expect(await deliverEmails(db, { ids: [id], others: 10, now, send })).toMatchObject({
      sent: 0,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect((await queued())[0]).toMatchObject({ status: "sent", attempts: 1, lockedUntil: null });
  });

  it("never sends one e-mail from two deliveries at once", async () => {
    const id = (await notify(db, notice())) ?? "";
    const send = vi.fn(async () => undefined);
    await Promise.all([
      deliverEmails(db, { ids: [id], now, send }),
      deliverEmails(db, { ids: [id], others: 5, now, send }),
      deliverEmails(db, { others: 5, now, send }),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("tries a failed e-mail again later, spaced out, then gives up", async () => {
    const id = (await notify(db, notice())) ?? "";
    const failing = vi.fn(async () => {
      throw new Error("Resend refused the e-mail (500)");
    });
    expect(await deliverEmails(db, { ids: [id], now, send: failing })).toMatchObject({
      retrying: 1,
    });
    expect((await queued())[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      lastError: "Resend refused the e-mail (500)",
      nextAttemptAt: new Date(now + minute),
    });
    // Not due yet: nothing is tried.
    await deliverEmails(db, { others: 10, now: now + 30_000, send: failing });
    expect(failing).toHaveBeenCalledTimes(1);
    // Each try waits longer: 1, 5, 30 and 120 minutes.
    let at = now;
    for (const wait of [1, 5, 30, 120]) {
      at += wait * minute;
      await deliverEmails(db, { others: 10, now: at, send: failing });
    }
    expect(failing).toHaveBeenCalledTimes(maxAttempts);
    expect((await queued())[0]).toMatchObject({ status: "failed", attempts: maxAttempts });
    await deliverEmails(db, { others: 10, now: at + 1_000 * minute, send: failing });
    expect(failing).toHaveBeenCalledTimes(maxAttempts);
  });

  it("sends a failed e-mail on the next try that works", async () => {
    const id = (await notify(db, notice())) ?? "";
    await deliverEmails(db, {
      ids: [id],
      now,
      send: async () => {
        throw new Error("offline");
      },
    });
    const send = vi.fn(async () => undefined);
    expect(await deliverEmails(db, { others: 10, now: now + minute, send })).toMatchObject({
      sent: 1,
    });
    expect((await queued())[0]).toMatchObject({ status: "sent", attempts: 2, lastError: null });
  });

  it("takes over an e-mail whose delivery never finished", async () => {
    const id = (await notify(db, notice())) ?? "";
    // A delivery held it and the server went down before it finished.
    await db
      .update(emailOutbox)
      .set({
        status: "sending",
        attempts: 1,
        nextAttemptAt: new Date(now),
        lockedUntil: new Date(now + 5 * minute),
      })
      .where(eq(emailOutbox.id, id));
    const send = vi.fn(async () => undefined);
    await deliverEmails(db, { others: 10, now: now + minute, send });
    expect(send).not.toHaveBeenCalled();
    await deliverEmails(db, { others: 10, now: now + 5 * minute, send });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("e-mail preferences", () => {
  it("skips the e-mails of a category the account turned off, and keeps the notification", async () => {
    await savePreferences(db, marina, { emailOff: ["interest"] });
    const id = (await notify(db, notice())) ?? "";
    const send = vi.fn(async () => undefined);
    expect(await deliverEmails(db, { ids: [id], now, send })).toMatchObject({ skipped: 1 });
    expect(send).not.toHaveBeenCalled();
    expect((await queued())[0]?.status).toBe("skipped");
    expect((await listNotifications(db, marina)).notifications).toHaveLength(1);
    // Other categories still go out.
    const other = await notify(db, notice({ kind: "proposal", dedupeKey: "meeting:1:proposed" }));
    await deliverEmails(db, { ids: [other ?? ""], now, send });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("follows the preference when the e-mail goes out, not when it was queued", async () => {
    const id = (await notify(db, notice())) ?? "";
    await deliverEmails(db, {
      ids: [id],
      now,
      send: async () => {
        throw new Error("offline");
      },
    });
    // Turned off before the retry: it doesn't go out.
    await savePreferences(db, marina, { emailOff: ["interest"] });
    const send = vi.fn(async () => undefined);
    await deliverEmails(db, { others: 10, now: now + minute, send });
    expect(send).not.toHaveBeenCalled();
    // Turned on again, the next ones do.
    await savePreferences(db, marina, { emailOff: [] });
    const next = await notify(db, notice({ dedupeKey: "interest:2" }));
    await deliverEmails(db, { ids: [next ?? ""], now, send });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never turns off the security e-mails", async () => {
    await savePreferences(db, marina, {
      emailOff: ["interest", "proposal", "answer", "application"],
    });
    const user = {
      ...acme,
      id: marina,
      email: "marina@example.com",
      accountType: "developer" as const,
    };
    expect(await sendVerificationCode(db, user, "pt", null, now)).toEqual({ sent: true });
    expect(outbox().at(-1)?.subject).toBe("Seu código de confirmação do StackMatch");
  });

  it("keeps the language and the e-mails turned off, each on its own", async () => {
    expect(await loadPreferences(db, marina)).toEqual({ language: "pt", emailOff: [] });
    await savePreferences(db, marina, { language: "en" });
    await savePreferences(db, marina, { emailOff: ["answer", "answer"] });
    expect(await loadPreferences(db, marina)).toEqual({ language: "en", emailOff: ["answer"] });
  });
});

describe("the notification center", () => {
  it("shows each account only its own notifications, a page at a time", async () => {
    for (let index = 0; index < notificationsPageSize + 5; index += 1)
      await db.insert(notifications).values({
        userId: marina,
        kind: "interest",
        data: { actor: `Empresa ${index}`, path: "/interests" },
        dedupeKey: `interest:${index}`,
        createdAt: new Date(now + index * minute),
      });
    await notify(db, notice({ userId: rafael, dedupeKey: "rafael", email: null }));
    const first = await listNotifications(db, marina);
    expect(first.notifications).toHaveLength(notificationsPageSize);
    expect(first.notifications[0]?.data.actor).toBe(`Empresa ${notificationsPageSize + 4}`);
    expect(first.unread).toBe(notificationsPageSize + 5);
    const second = await listNotifications(db, marina, first.next ?? undefined);
    expect(second.notifications.map((item) => item.data.actor)).toEqual(
      [4, 3, 2, 1, 0].map((index) => `Empresa ${index}`),
    );
    expect(second.next).toBeNull();
    // Another account's notification as the cursor finds nothing.
    const [theirs] = await db.select().from(notifications).where(eq(notifications.userId, rafael));
    expect((await listNotifications(db, marina, theirs?.id)).notifications).toEqual([]);
  });

  it("marks as read only the account's own notifications", async () => {
    await notify(db, notice({ email: null }));
    await notify(db, notice({ dedupeKey: "interest:2", email: null }));
    await notify(db, notice({ userId: rafael, email: null }));
    const [theirs] = await db.select().from(notifications).where(eq(notifications.userId, rafael));
    const [mine] = (await listNotifications(db, marina)).notifications;
    await markNotificationsRead(db, marina, [mine?.id ?? "", theirs?.id ?? ""], now);
    expect(await unreadCount(db, marina)).toBe(1);
    expect(await unreadCount(db, rafael)).toBe(1);
    await markNotificationsRead(db, marina, "all", now);
    expect(await unreadCount(db, marina)).toBe(0);
    expect(await unreadCount(db, rafael)).toBe(1);
    expect((await listNotifications(db, marina)).notifications[0]?.readAt).toBe(
      new Date(now).toISOString(),
    );
  });
});

describe("events that notify", () => {
  const proposal = () => ({
    developerId: marina,
    date: "2026-10-02",
    time: "10:30",
    message: "",
  });

  it("a company's interest, once while the mark lasts, in the developer's language", async () => {
    await savePreferences(db, marina, { language: "en" });
    await markInterestAndNotify(db, acme.id, marina, appUrl, now);
    await markInterestAndNotify(db, acme.id, marina, appUrl, now);
    const { notifications: list } = await listNotifications(db, marina);
    expect(list).toMatchObject([{ kind: "interest", data: { actor: "Acme", path: "/interests" } }]);
    expect(outbox().map((sent) => sent.subject)).toEqual([
      "Acme is interested in your StackMatch profile",
    ]);
  });

  it("a proposal and the answer to it, each to the side that didn't act", async () => {
    const result = await sendMeetingRequest(db, acme, proposal(), now, "pt");
    if (!("request" in result)) throw new Error("proposal not sent");
    await answerMeetingRequest(
      db,
      { side: "developer", accountId: marina },
      result.request.id,
      "accepted",
      now,
      appUrl,
    );
    // Answering again changes nothing and notifies nobody.
    await answerMeetingRequest(
      db,
      { side: "developer", accountId: marina },
      result.request.id,
      "accepted",
      now,
      appUrl,
    );
    expect((await listNotifications(db, marina)).notifications).toMatchObject([
      { kind: "proposal", data: { actor: "Acme", date: "2026-10-02", time: "10:30" } },
    ]);
    expect((await listNotifications(db, acme.id)).notifications).toMatchObject([
      { kind: "meeting_accepted", data: { actor: "Marina Costa", path: "/proposals" } },
    ]);
    expect(outbox()).toHaveLength(2);
  });

  it("each new time of a call, once", async () => {
    const result = await sendMeetingRequest(db, acme, proposal(), now, "pt");
    if (!("request" in result)) throw new Error("proposal not sent");
    for (const time of ["14:00", "17:00"])
      await rescheduleMeeting(
        db,
        { side: "developer", accountId: marina },
        result.request.id,
        { date: "2026-10-05", time, message: "" },
        now,
        appUrl,
      );
    const kinds = (await listNotifications(db, acme.id)).notifications.map((item) => [
      item.kind,
      item.data.time,
    ]);
    expect(kinds).toEqual([
      ["meeting_rescheduled", "17:00"],
      ["meeting_rescheduled", "14:00"],
    ]);
  });

  it("applying, withdrawing and the application's end", async () => {
    const created = await createJob(db, acme.id, { ...emptyJob, title: "Front-end Pleno" });
    if (!("job" in created)) throw new Error("job not created");
    await db.execute(`update jobs set listed = true where id = '${created.job.id}'`);
    await applyToJob(db, marina, { jobId: created.job.id, message: "" }, appUrl, now);
    await applyToJob(db, rafael, { jobId: created.job.id, message: "" }, appUrl, now);
    const [application] = await db.query.jobApplications.findMany({
      where: (table, { eq: equals }) => equals(table.developerId, marina),
    });
    await withdrawApplication(db, marina, application?.id ?? "", appUrl, now + minute);
    await moveCandidate(
      db,
      acme.id,
      created.job.id,
      rafael,
      "not_advanced",
      appUrl,
      now + 2 * minute,
    );
    expect(
      (await listNotifications(db, acme.id)).notifications.map((item) => [
        item.kind,
        item.data.actor,
      ]),
    ).toEqual([
      ["application_withdrawn", "Marina Costa"],
      ["application_received", "Rafael Lima"],
      ["application_received", "Marina Costa"],
    ]);
    expect((await listNotifications(db, rafael)).notifications).toMatchObject([
      {
        kind: "application_update",
        data: { update: "not_advanced", job: "Front-end Pleno", path: "/applications" },
      },
    ]);
  });
});
