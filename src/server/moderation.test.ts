import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { defaultFilters } from "@/lib/filters";
import { emptyJob } from "@/lib/jobs";
import { reportsPerDay } from "@/lib/moderation";
import { createSession, userForSession } from "./auth";
import type { Db } from "./db";
import { jobs, reports, sessions } from "./db/schema";
import { applyToJob, listOpenJobsFor } from "./job-applications";
import { listJobBoard } from "./job-board";
import { createJob } from "./jobs";
import { sendMeetingRequest } from "./meetings";
import {
  dismissReport,
  fileReport,
  isSuspended,
  liftSuspension,
  listReports,
  listSuspended,
  suspendAccount,
} from "./moderation";
import { deliverEmails, notify } from "./outbox";
import { markInterestAndNotify } from "./outreach";
import { loadPublishedProfile, searchProfiles } from "./profiles";
import { saveTalent } from "./saved-talents";
import { createCompany, createDeveloper, createTestDb } from "./test-db";

let db: Db;
let acme: AuthUser;
let globex: AuthUser;
let marina: string;
let rafael: string;
let jobId: string;

const appUrl = "https://stackmatch.example";
const admin = "admin@stackmatch.example";
// Noon in Brasília on 2026-10-01; proposal times are in GMT-3.
const now = Date.parse("2026-10-01T12:00:00-03:00");

beforeEach(async () => {
  db = await createTestDb();
  acme = await createCompany(db, "bia@acme.com");
  globex = await createCompany(db, "rh@globex.com", "Globex");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
  rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
  const created = await createJob(db, acme.id, { ...emptyJob, title: "Front-end Pleno" });
  if (!("job" in created)) throw new Error("job not created");
  jobId = created.job.id;
  await db.update(jobs).set({ listed: true }).where(eq(jobs.id, jobId));
});

afterEach(() => vi.unstubAllEnvs());

const report = (targetType: "job" | "profile" | "company", targetId: string) => ({
  targetType,
  targetId,
  reason: "scam" as const,
  details: "Pediu pagamento adiantado.",
});

describe("reports", () => {
  it("records what was reported, whose it is and who reported it", async () => {
    expect(await fileReport(db, marina, report("job", jobId), now)).toEqual({ ok: true });
    expect(await fileReport(db, acme.id, report("profile", rafael), now)).toEqual({ ok: true });
    expect(await fileReport(db, marina, report("company", globex.id), now)).toEqual({ ok: true });
    const list = await listReports(db, "open");
    expect(list.map((item) => [item.targetType, item.targetLabel, item.account?.id])).toEqual(
      expect.arrayContaining([
        ["job", "Front-end Pleno", acme.id],
        ["profile", "Rafael Lima", rafael],
        ["company", "Globex", globex.id],
      ]),
    );
    expect(list.find((item) => item.targetType === "job")).toMatchObject({
      reason: "scam",
      details: "Pediu pagamento adiantado.",
      reporter: { name: "Marina Costa", email: "marina@example.com" },
      status: "open",
    });
  });

  it("refuses unknown content and one's own, and records a repeated report once", async () => {
    expect(await fileReport(db, marina, report("job", "nope"), now)).toEqual({
      error: "unknown-target",
    });
    // A developer isn't a company.
    expect(await fileReport(db, acme.id, report("company", marina), now)).toEqual({
      error: "unknown-target",
    });
    expect(await fileReport(db, acme.id, report("job", jobId), now)).toEqual({
      error: "own-content",
    });
    expect(await fileReport(db, marina, report("profile", marina), now)).toEqual({
      error: "own-content",
    });
    await fileReport(db, marina, report("job", jobId), now);
    await fileReport(db, marina, report("job", jobId), now);
    expect(await db.select().from(reports)).toHaveLength(1);
  });

  it("lets an account file a limited number a day", async () => {
    const targets = [];
    for (let index = 0; index < reportsPerDay + 1; index += 1) {
      const created = await createJob(db, globex.id, { ...emptyJob, title: `Vaga ${index}` });
      if (!("job" in created)) throw new Error("job not created");
      targets.push(created.job.id);
    }
    for (const target of targets.slice(0, reportsPerDay))
      expect(await fileReport(db, marina, report("job", target), now)).toEqual({ ok: true });
    expect(await fileReport(db, marina, report("job", targets.at(-1) ?? ""), now)).toEqual({
      error: "report-limit",
    });
    // A day later, it can report again.
    expect(
      await fileReport(db, marina, report("job", targets.at(-1) ?? ""), now + 86_400_000 + 1),
    ).toEqual({ ok: true });
  });

  it("dismisses an open report once, with who and why", async () => {
    await fileReport(db, marina, report("job", jobId), now);
    const [open] = await listReports(db, "open");
    expect(await dismissReport(db, open?.id ?? "", admin, "Vaga legítima.", now)).toBe(true);
    expect(await dismissReport(db, open?.id ?? "", admin, "De novo.", now)).toBe(false);
    expect(await listReports(db, "open")).toEqual([]);
    expect((await listReports(db, "all"))[0]).toMatchObject({
      status: "dismissed",
      reviewedBy: admin,
      reviewNote: "Vaga legítima.",
    });
  });
});

describe("suspending an account", () => {
  it("ends its sessions, refuses new ones, closes its reports and keeps the history", async () => {
    const token = await createSession(db, rafael);
    expect(await userForSession(db, token)).not.toBeNull();
    await fileReport(db, acme.id, report("profile", rafael), now);
    await fileReport(db, globex.id, report("profile", rafael), now);
    const [first] = await listReports(db, "open");
    expect(
      await suspendAccount(
        db,
        rafael,
        { reason: "Perfil falso.", admin, reportId: first?.id ?? null },
        now,
      ),
    ).toEqual({ ok: true });
    expect(await db.select().from(sessions).where(eq(sessions.userId, rafael))).toEqual([]);
    // A session that slipped through still doesn't sign it in.
    expect(await userForSession(db, await createSession(db, rafael))).toBeNull();
    expect(await listReports(db, "open")).toEqual([]);
    expect((await listReports(db, "all")).map((item) => item.status)).toEqual([
      "actioned",
      "actioned",
    ]);
    expect(await suspendAccount(db, rafael, { reason: "De novo.", admin }, now)).toEqual({
      error: "already-suspended",
    });

    expect(
      await liftSuspension(db, rafael, { reason: "Comprovou identidade.", admin }, now + 1),
    ).toBe(true);
    expect(await liftSuspension(db, rafael, { reason: "De novo.", admin }, now + 2)).toBe(false);
    expect(await isSuspended(db, rafael)).toBe(false);
    expect(await userForSession(db, await createSession(db, rafael))).not.toBeNull();
  });

  it("lists the suspended accounts with every step taken", async () => {
    await suspendAccount(db, rafael, { reason: "Spam.", admin }, now);
    await liftSuspension(db, rafael, { reason: "Engano.", admin }, now + 1000);
    await suspendAccount(db, rafael, { reason: "Spam de novo.", admin }, now + 2000);
    expect(await listSuspended(db)).toMatchObject([
      {
        id: rafael,
        accountType: "developer",
        history: [
          { action: "suspended", reason: "Spam de novo." },
          { action: "lifted", reason: "Engano." },
          { action: "suspended", reason: "Spam." },
        ],
      },
    ]);
  });

  it("refuses to suspend an admin or an unknown account", async () => {
    vi.stubEnv("ADMIN_EMAILS", "rafael@example.com");
    expect(await suspendAccount(db, rafael, { reason: "Teste.", admin }, now)).toEqual({
      error: "admin-account",
    });
    expect(await suspendAccount(db, "nope", { reason: "Teste.", admin }, now)).toEqual({
      error: "unknown-account",
    });
  });

  it("takes a developer out of Discover, saved talent, profiles and new contacts", async () => {
    await suspendAccount(db, rafael, { reason: "Perfil falso.", admin }, now);
    const search = await searchProfiles(db, {
      filters: defaultFilters,
      exclude: [],
      offset: 0,
      limit: 20,
    });
    expect(search.developers.map((developer) => developer.id)).toEqual([marina]);
    expect(search.total).toBe(1);
    expect(await loadPublishedProfile(db, rafael)).toBeNull();
    expect(await saveTalent(db, acme.id, rafael)).toBe(false);
    expect(await markInterestAndNotify(db, acme.id, rafael, appUrl, now)).toEqual({
      error: "unknown-developer",
    });
    expect(
      await sendMeetingRequest(
        db,
        acme,
        { developerId: rafael, date: "2026-10-02", time: "10:30", message: "" },
        now,
      ),
    ).toEqual({ error: "unknown-developer" });

    await liftSuspension(db, rafael, { reason: "Engano.", admin }, now);
    expect(await loadPublishedProfile(db, rafael)).not.toBeNull();
  });

  it("takes a company's jobs and page away from developers", async () => {
    await markInterestAndNotify(db, acme.id, marina, appUrl, now);
    expect(await listOpenJobsFor(db, acme.id, marina)).not.toBeNull();
    await suspendAccount(db, acme.id, { reason: "Golpe.", admin }, now);
    expect((await listJobBoard(db, marina, { sort: "recent" })).total).toBe(0);
    expect(await listOpenJobsFor(db, acme.id, marina)).toBeNull();
    expect(await applyToJob(db, marina, { jobId, message: "" }, appUrl, now)).toEqual({
      error: "unknown-job",
    });
    await liftSuspension(db, acme.id, { reason: "Resolvido.", admin }, now);
    expect((await listJobBoard(db, marina, { sort: "recent" })).total).toBe(1);
  });

  it("skips the e-mails still waiting for it", async () => {
    const queued = await notify(db, {
      userId: rafael,
      kind: "interest",
      data: { actor: "Acme", path: "/interests" },
      dedupeKey: "interest:1",
      email: { to: "rafael@example.com", subject: "s", text: "t", html: "h" },
    });
    await suspendAccount(db, rafael, { reason: "Spam.", admin }, now);
    const send = vi.fn(async () => undefined);
    expect(await deliverEmails(db, { ids: [queued ?? ""], send })).toMatchObject({ skipped: 1 });
    expect(send).not.toHaveBeenCalled();
  });
});
