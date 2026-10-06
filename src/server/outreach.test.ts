import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { outreachLimits } from "@/lib/outreach";
import { createAccount } from "./auth";
import type { Db } from "./db";
import { interestEvents, meetingRequests } from "./db/schema";
import { outbox } from "./email";
import { removeInterest } from "./interests";
import { sendMeetingRequest } from "./meetings";
import { markInterestAndNotify } from "./outreach";
import { createDeveloper, createTestDb } from "./test-db";

let db: Db;
let marina: string;
let acme: AuthUser;

// Noon in Brasília on 2026-10-01; proposal times are in GMT-3.
const now = Date.parse("2026-10-01T12:00:00-03:00");
const hours = (count: number) => count * 60 * 60_000;
const appUrl = "https://stackmatch.example";

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
  const user = await createAccount(db, {
    accountType: "company",
    name: "Bia Santos",
    company: "Acme",
    cnpj: "11222333000181",
    jobTitle: "Tech Recruiter",
    email: "bia@acme.com",
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  acme = user;
});

const mark = (developerId: string, at = now) =>
  markInterestAndNotify(db, acme.id, developerId, "pt", appUrl, at);

const interestEmails = () => outbox().filter((email) => email.subject.includes("interesse"));

describe("interest marks", () => {
  it("e-mail the developer once, even when marked, undone and marked again", async () => {
    expect(await mark(marina)).toEqual({ ok: true });
    // Marking a profile already marked changes nothing.
    expect(await mark(marina, now + 1000)).toEqual({ ok: true });
    await removeInterest(db, acme.id, marina);
    expect(await mark(marina, now + 2000)).toEqual({ ok: true });
    expect(interestEmails()).toHaveLength(1);
    expect(await db.select().from(interestEvents)).toHaveLength(2);
  });

  it("e-mail again after a long while", async () => {
    await mark(marina);
    await removeInterest(db, acme.id, marina);
    await mark(marina, now + (outreachLimits.interestEmailEveryDays + 1) * hours(24));
    expect(interestEmails()).toHaveLength(2);
  });

  it("stop at the daily limit, counting undone marks too", async () => {
    // Earlier marks today, spread over the last hours.
    const max = outreachLimits.interestsPerDay;
    await db.insert(interestEvents).values(
      Array.from({ length: max }, (_, index) => ({
        companyId: acme.id,
        developerId: marina,
        notified: false,
        createdAt: new Date(now - hours(20) + index * 60_000),
      })),
    );
    const other = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
    const refused = await mark(other);
    // The oldest of them leaves the 24 hours in 4 hours.
    expect(refused).toEqual({ error: "interest-limit", retryInSeconds: 4 * 60 * 60 });
    expect(interestEmails()).toHaveLength(0);

    expect(await mark(other, now + hours(4))).toEqual({ ok: true });
  });

  it("refuse unknown profiles", async () => {
    expect(await mark("perfil-inexistente")).toEqual({ error: "unknown-developer" });
  });
});

describe("meeting proposals", () => {
  const proposal = (developerId: string) => ({
    developerId,
    date: "2026-10-02",
    time: "10:30",
    message: "",
  });

  it("stop at a few to the same developer in a week", async () => {
    for (let index = 0; index < outreachLimits.meetingsPerDeveloper; index++)
      expect(
        await sendMeetingRequest(db, acme, proposal(marina), now + index * 1000),
      ).toHaveProperty("request");
    const refused = await sendMeetingRequest(db, acme, proposal(marina), now + 10_000);
    expect(refused).toMatchObject({ error: "developer-meeting-limit" });
    // Another developer can still get one.
    const rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
    expect(await sendMeetingRequest(db, acme, proposal(rafael), now + 11_000)).toHaveProperty(
      "request",
    );
  });

  it("stop at the daily limit for the company", async () => {
    await db.insert(meetingRequests).values(
      Array.from({ length: outreachLimits.meetingsPerDay }, (_, index) => ({
        companyId: acme.id,
        developerId: marina,
        developerName: "Marina Costa",
        date: "2026-10-02",
        time: "09:00",
        companyName: "Acme",
        contactName: "Bia Santos",
        replyToEmail: "bia@acme.com",
        sentAt: new Date(now - hours(23) + index * 60_000),
      })),
    );
    const rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
    const refused = await sendMeetingRequest(db, acme, proposal(rafael), now);
    expect(refused).toEqual({ error: "meeting-limit", retryInSeconds: 60 * 60 });
    expect(outbox()).toHaveLength(0);
  });
});
