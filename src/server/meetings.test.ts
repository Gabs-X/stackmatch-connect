import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { defaultCompanySettings } from "@/lib/company-settings";
import { outreachLimits } from "@/lib/outreach";
import { createAccount } from "./auth";
import { saveCompanySettings } from "./companies";
import type { Db } from "./db";
import { markInterest } from "./interests";
import {
  companyReachedDeveloper,
  listReceivedBy,
  listSentBy,
  sendMeetingRequest,
} from "./meetings";
import { createDeveloper, createTestDb } from "./test-db";

let db: Db;
let rafael: string;
let marina: string;
let proposal: { developerId: string; date: string; time: string; message: string };
let diego: string;

beforeEach(async () => {
  db = await createTestDb();
  // Companies only reach developers with a published profile.
  rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
  proposal = { developerId: marina, date: "2026-10-02", time: "10:30", message: "Oi" };
  diego = await createDeveloper(db, "diego@example.com", "Diego Santos");
});

// Noon in Brasília on 2026-10-01; proposal times are in GMT-3.
const now = Date.parse("2026-10-01T12:00:00-03:00");

async function company(email: string): Promise<AuthUser> {
  const user = await createAccount(db, {
    accountType: "company",
    name: "Bia Santos",
    company: "Acme",
    cnpj: "11222333000181",
    jobTitle: "Tech Recruiter",
    email,
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  return user;
}

describe("sendMeetingRequest", () => {
  it("records the proposal signed with the company's current contact", async () => {
    const acme = await company("bia@acme.com");
    await saveCompanySettings(db, acme.id, {
      ...defaultCompanySettings(acme),
      contactName: "Carla Dias",
      contactEmail: "carla@acme.com",
    });

    const result = await sendMeetingRequest(db, acme, proposal, now);
    expect(result).toMatchObject({
      request: {
        developerId: marina,
        developerName: "Marina Costa",
        companyId: acme.id,
        company: "Acme",
        contactName: "Carla Dias",
        email: "carla@acme.com",
        date: "2026-10-02",
        time: "10:30",
        message: "Oi",
        sentAt: new Date(now).toISOString(),
      },
    });
  });

  it("refuses times that passed or aren't offered, and unknown profiles", async () => {
    const acme = await company("bia@acme.com");
    expect(await sendMeetingRequest(db, acme, { ...proposal, date: "2026-10-01" }, now)).toEqual({
      error: "time-passed",
    });
    expect(await sendMeetingRequest(db, acme, { ...proposal, time: "08:00" }, now)).toEqual({
      error: "time-passed",
    });
    expect(
      await sendMeetingRequest(db, acme, { ...proposal, developerId: "ninguem" }, now),
    ).toEqual({ error: "unknown-developer" });
    expect(await listSentBy(db, acme.id)).toEqual([]);
  });

  it("lets only one of the proposals racing for the last one allowed through", async () => {
    const acme = await company("bia@acme.com");
    for (let sent = 1; sent < outreachLimits.meetingsPerDeveloper; sent++)
      expect(await sendMeetingRequest(db, acme, proposal, now)).toHaveProperty("request");
    const results = await Promise.all([
      sendMeetingRequest(db, acme, proposal, now),
      sendMeetingRequest(db, acme, proposal, now),
      sendMeetingRequest(db, acme, proposal, now),
    ]);
    expect(results.filter((result) => "request" in result)).toHaveLength(1);
    expect(results.filter((result) => "error" in result)).toEqual([
      { error: "developer-meeting-limit", retryInSeconds: expect.any(Number) },
      { error: "developer-meeting-limit", retryInSeconds: expect.any(Number) },
    ]);
    expect(await listSentBy(db, acme.id)).toHaveLength(outreachLimits.meetingsPerDeveloper);
  });
});

describe("listing proposals", () => {
  it("shows each company what it sent and each developer what they received", async () => {
    const acme = await company("bia@acme.com");
    const other = await company("ana@other.com");
    await sendMeetingRequest(db, acme, proposal, now);
    await sendMeetingRequest(db, acme, { ...proposal, time: "14:00" }, now + 1000);
    await sendMeetingRequest(db, other, { ...proposal, developerId: rafael }, now);

    expect((await listSentBy(db, acme.id)).map((request) => request.time)).toEqual([
      "10:30",
      "14:00",
    ]);
    expect(await listSentBy(db, other.id)).toHaveLength(1);
    expect((await listReceivedBy(db, marina)).map((item) => item.companyId)).toEqual([
      acme.id,
      acme.id,
    ]);
  });
});

describe("companyReachedDeveloper", () => {
  it("is true after an interest mark or a proposal, and only for that developer", async () => {
    const acme = await company("bia@acme.com");
    expect(await companyReachedDeveloper(db, acme.id, marina)).toBe(false);

    await markInterest(db, acme.id, rafael);
    await sendMeetingRequest(db, acme, proposal, now);
    expect(await companyReachedDeveloper(db, acme.id, rafael)).toBe(true);
    expect(await companyReachedDeveloper(db, acme.id, marina)).toBe(true);
    expect(await companyReachedDeveloper(db, acme.id, diego)).toBe(false);
  });
});
