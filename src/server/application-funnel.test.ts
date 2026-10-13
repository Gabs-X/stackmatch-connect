import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { emptyJob, type JobInput } from "@/lib/jobs";
import type { Db } from "./db";
import { jobApplications, jobCandidates } from "./db/schema";
import { outbox } from "./email";
import {
  applyToJob,
  listJobBoard,
  listMyApplications,
  listOpenJobsFor,
  withdrawApplication,
} from "./job-applications";
import {
  advanceCandidate,
  createJob,
  deleteJob,
  listCandidateHistory,
  listCandidates,
  listJobs,
  moveCandidate,
  removeCandidate,
  setCandidateNote,
  setJobStatus,
} from "./jobs";
import { markInterest } from "./interests";
import { createCompany, createDeveloper, createTestDb } from "./test-db";

let db: Db;
let acme: AuthUser;
let globex: AuthUser;
let marina: string;
let rafael: string;

const appUrl = "https://stackmatch.example";

const frontend: JobInput = {
  ...emptyJob,
  title: "Front-end Pleno",
  description: "App de pagamentos.",
  requiredSkills: ["React"],
};

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  acme = await createCompany(db, "bia@acme.com");
  globex = await createCompany(db, "rh@globex.com", "Globex");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
  rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
});

async function newJob(input = frontend, company = acme) {
  const result = await createJob(db, company.id, input);
  if (!("job" in result)) throw new Error("job not created");
  return result.job;
}

/** Marina applies for a new job of Acme's; the job and her application. */
async function applied(message = "Oi!") {
  const job = await newJob();
  const result = await applyToJob(db, marina, { jobId: job.id, message }, appUrl);
  if (!("appliedAt" in result)) throw new Error("not applied");
  const application = (await listMyApplications(db, marina)).applications[0];
  if (!application) throw new Error("no application");
  return { job, application };
}

const mine = async (developerId = marina) =>
  (await listMyApplications(db, developerId)).applications;
const emailsTo = (to: string) => outbox().filter((email) => email.to === to);

describe("my applications", () => {
  it("list the job as applied, the company, the date, the message and the status", async () => {
    const { job, application } = await applied("Tenho 4 anos de React.");
    expect(application).toMatchObject({
      job: { title: "Front-end Pleno", requiredSkills: ["React"] },
      companyId: acme.id,
      company: "Acme",
      message: "Tenho 4 anos de React.",
      status: "submitted",
      withdrawnAt: null,
      history: [{ kind: "applied" }],
    });
    // Contacted from the job: the developer sees it moving, not the stage.
    await advanceCandidate(db, acme.id, job.id, marina, "contacted");
    expect((await mine())[0]?.status).toBe("in_progress");
  });

  it("are only the developer's own", async () => {
    await applied();
    expect(await mine(rafael)).toEqual([]);
  });

  it("come a page at a time, newest first, without repeats, also with the same date", async () => {
    // 25 jobs applied for in the same millisecond.
    for (let index = 0; index < 25; index += 1) {
      const job = await newJob({ ...frontend, title: `Vaga ${index}` });
      await applyToJob(db, marina, { jobId: job.id, message: "" }, appUrl, 1000);
    }
    const first = await listMyApplications(db, marina);
    expect(first.applications).toHaveLength(20);
    expect(first.next).not.toBeNull();
    const second = await listMyApplications(db, marina, first.next ?? "");
    expect(second.applications).toHaveLength(5);
    expect(second.next).toBeNull();
    const ids = [...first.applications, ...second.applications].map((item) => item.id);
    expect(new Set(ids).size).toBe(25);
    // A cursor from another developer's list brings nothing of theirs.
    expect((await listMyApplications(db, rafael, first.next ?? "")).applications).toEqual([]);
  });
});

describe("withdrawing an application", () => {
  it("is final, tells the company and keeps the developer in the job, marked", async () => {
    const { job, application } = await applied();
    outbox().length = 0;
    expect(await withdrawApplication(db, marina, application.id, appUrl)).toEqual({ ok: true });

    expect((await mine())[0]).toMatchObject({
      status: "withdrawn",
      history: [{ kind: "withdrawn" }, { kind: "applied" }],
    });
    expect(await listCandidates(db, acme.id, job.id)).toEqual([
      expect.objectContaining({ developerId: marina, withdrawnAt: expect.any(String) }),
    ]);
    expect(outbox()).toEqual([
      expect.objectContaining({
        to: "bia@acme.com",
        subject: "Marina Costa retirou a candidatura para a vaga Front-end Pleno",
        replyTo: "marina@example.com",
      }),
    ]);
    // Neither again nor a new application.
    expect(await withdrawApplication(db, marina, application.id, appUrl)).toEqual({
      error: "not-active",
    });
    expect(await applyToJob(db, marina, { jobId: job.id, message: "" }, appUrl)).toEqual({
      error: "already-applied",
    });
    // Withdrawn ones don't count as offers.
    expect((await listJobs(db, acme.id))[0]?.applied).toBe(0);
  });

  it("is only for the developer who applied", async () => {
    const { application } = await applied();
    expect(await withdrawApplication(db, rafael, application.id, appUrl)).toEqual({
      error: "unknown-application",
    });
    expect((await mine())[0]?.status).toBe("submitted");
  });

  it("is refused once the company decided, or the job closed", async () => {
    const { job, application } = await applied();
    await setJobStatus(db, acme.id, job.id, "closed", appUrl);
    expect(await withdrawApplication(db, marina, application.id, appUrl)).toEqual({
      error: "not-active",
    });
    await setJobStatus(db, acme.id, job.id, "open", appUrl);
    await moveCandidate(db, acme.id, job.id, marina, "hired", appUrl);
    expect(await withdrawApplication(db, marina, application.id, appUrl)).toEqual({
      error: "not-active",
    });
  });

  it("and the company's decision made at once end one way, each telling only its side", async () => {
    for (const order of [0, 1]) {
      db = await createTestDb();
      outbox().length = 0;
      acme = await createCompany(db, "bia@acme.com");
      marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
      const { job, application } = await applied();
      outbox().length = 0;
      const withdraw = () => withdrawApplication(db, marina, application.id, appUrl);
      const decide = () => moveCandidate(db, acme.id, job.id, marina, "not_advanced", appUrl);
      // Each one started first in turn.
      const withdrawal = order
        ? (await Promise.all([withdraw(), decide()]))[0]
        : (await Promise.all([decide(), withdraw()]))[1];
      const status = (await mine())[0]?.status;
      if (status === "withdrawn") {
        expect(withdrawal).toEqual({ ok: true });
        expect(emailsTo("marina@example.com")).toEqual([]);
        expect(emailsTo("bia@acme.com")).toHaveLength(1);
      } else {
        expect(status).toBe("not_advanced");
        expect(withdrawal).toEqual({ error: "not-active" });
        expect(emailsTo("marina@example.com")).toHaveLength(1);
        expect(emailsTo("bia@acme.com")).toEqual([]);
      }
      // The company's stage is its own either way.
      expect((await listCandidates(db, acme.id, job.id))?.[0]?.stage).toBe("not_advanced");
    }
  });
});

describe("the company's final stages", () => {
  it("tell the developer the outcome, by e-mail when it ends without them", async () => {
    const { job } = await applied();
    outbox().length = 0;
    await moveCandidate(db, acme.id, job.id, marina, "not_advanced", appUrl);
    expect((await mine())[0]).toMatchObject({
      status: "not_advanced",
      history: [{ kind: "outcome", outcome: "not_advanced" }, { kind: "applied" }],
    });
    expect(emailsTo("marina@example.com")).toEqual([
      expect.objectContaining({ subject: "Atualização da sua candidatura: Front-end Pleno" }),
    ]);
    expect(emailsTo("marina@example.com")[0]?.text).toContain(
      "Acme decidiu não seguir com a sua candidatura",
    );

    // Being hired is agreed directly: shown, not e-mailed.
    outbox().length = 0;
    await moveCandidate(db, acme.id, job.id, marina, "hired", appUrl);
    expect((await mine())[0]?.status).toBe("hired");
    expect(outbox()).toEqual([]);
  });

  it("aren't left by what the company does later in the job", async () => {
    const { job } = await applied();
    await moveCandidate(db, acme.id, job.id, marina, "closed", appUrl);
    await advanceCandidate(db, acme.id, job.id, marina, "meeting");
    expect((await listCandidates(db, acme.id, job.id))?.[0]?.stage).toBe("closed");
    expect((await mine())[0]?.status).toBe("closed");
  });

  it("only change the developer's view of a candidate who applied", async () => {
    const job = await newJob();
    await advanceCandidate(db, acme.id, job.id, rafael, "saved");
    outbox().length = 0;
    await moveCandidate(db, acme.id, job.id, rafael, "not_advanced", appUrl);
    expect(await mine(rafael)).toEqual([]);
    expect(outbox()).toEqual([]);
  });
});

describe("history", () => {
  it("keeps the application when the company takes the developer out of the job", async () => {
    const { job } = await applied();
    outbox().length = 0;
    await removeCandidate(db, acme.id, job.id, marina, appUrl);

    expect(await listCandidates(db, acme.id, job.id)).toEqual([]);
    expect((await mine())[0]).toMatchObject({
      status: "not_advanced",
      message: "Oi!",
      history: [{ kind: "outcome", outcome: "not_advanced" }, { kind: "applied" }],
    });
    expect(emailsTo("marina@example.com")).toHaveLength(1);
    // The company still has what happened.
    expect((await listCandidateHistory(db, acme.id, job.id, marina))?.map((e) => e.kind)).toEqual([
      "removed",
      "applied",
    ]);

    // Put back in the job, the outcome stays.
    await advanceCandidate(db, acme.id, job.id, marina, "interest");
    expect((await mine())[0]?.status).toBe("not_advanced");
  });

  it("records each stage change with who made it", async () => {
    const job = await newJob();
    await advanceCandidate(db, acme.id, job.id, marina, "saved", 1000);
    await advanceCandidate(db, acme.id, job.id, marina, "contacted", 2000);
    await moveCandidate(db, acme.id, job.id, marina, "hired", appUrl, 3000);
    expect(await listCandidateHistory(db, acme.id, job.id, marina)).toEqual([
      expect.objectContaining({
        kind: "stage_changed",
        fromStage: "contacted",
        toStage: "hired",
        actor: "company",
      }),
      expect.objectContaining({
        kind: "stage_changed",
        fromStage: "saved",
        toStage: "contacted",
        actor: "system",
      }),
      expect.objectContaining({
        kind: "added",
        fromStage: null,
        toStage: "saved",
        actor: "system",
      }),
    ]);
  });
});

describe("closing or deleting the job", () => {
  it("shows waiting applications as closed, tells their developers, and reopening undoes it", async () => {
    const { job } = await applied();
    const other = await newJob({ ...frontend, title: "Back-end" });
    await applyToJob(db, rafael, { jobId: job.id, message: "" }, appUrl);
    await applyToJob(db, rafael, { jobId: other.id, message: "" }, appUrl);
    await moveCandidate(db, acme.id, job.id, rafael, "hired", appUrl);
    outbox().length = 0;

    await setJobStatus(db, acme.id, job.id, "closed", appUrl);
    expect((await mine())[0]).toMatchObject({
      status: "job_closed",
      history: [{ kind: "job_closed" }, { kind: "applied" }],
    });
    // Only the one still waiting hears it; Rafael was hired.
    expect(outbox().map((email) => email.to)).toEqual(["marina@example.com"]);
    expect(outbox()[0]?.text).toContain("Acme encerrou a vaga Front-end Pleno");
    expect((await mine(rafael)).map((item) => item.status).sort()).toEqual(["hired", "submitted"]);

    await setJobStatus(db, acme.id, job.id, "open", appUrl);
    expect((await mine())[0]?.status).toBe("submitted");
  });

  it("keeps the applications, with the job as applied, after deleting it", async () => {
    const { job } = await applied();
    await setCandidateNote(db, acme.id, job.id, marina, "Gostei.");
    outbox().length = 0;
    await deleteJob(db, acme.id, job.id, appUrl);

    expect((await mine())[0]).toMatchObject({
      job: { title: "Front-end Pleno" },
      message: "Oi!",
      status: "job_closed",
      history: [{ kind: "job_deleted" }, { kind: "applied" }],
    });
    expect(emailsTo("marina@example.com")[0]?.text).toContain(
      "Acme removeu a vaga Front-end Pleno",
    );
    // The company's own records of the job go with it.
    expect(await listCandidateHistory(db, acme.id, job.id, marina)).toBeNull();
    expect(
      await db.select().from(jobCandidates).where(eq(jobCandidates.developerId, marina)),
    ).toEqual([]);
  });

  it("doesn't e-mail again for a job already closed when it's deleted", async () => {
    const { job } = await applied();
    await setJobStatus(db, acme.id, job.id, "closed", appUrl);
    outbox().length = 0;
    await deleteJob(db, acme.id, job.id, appUrl);
    expect(outbox()).toEqual([]);
    expect((await mine())[0]?.status).toBe("job_closed");
  });
});

describe("another company", () => {
  it("can't change, note, read the history of or remove someone in a job not its own", async () => {
    const { job } = await applied();
    outbox().length = 0;
    expect(await moveCandidate(db, globex.id, job.id, marina, "not_advanced", appUrl)).toBe(false);
    expect(await setCandidateNote(db, globex.id, job.id, marina, "x")).toBe(false);
    expect(await listCandidateHistory(db, globex.id, job.id, marina)).toBeNull();
    expect(await setJobStatus(db, globex.id, job.id, "closed", appUrl)).toBe(false);
    await removeCandidate(db, globex.id, job.id, marina, appUrl);
    await deleteJob(db, globex.id, job.id, appUrl);

    expect((await mine())[0]?.status).toBe("submitted");
    expect((await listCandidates(db, acme.id, job.id))?.[0]).toMatchObject({
      stage: "saved",
      note: "",
    });
    expect(outbox()).toEqual([]);
  });
});

describe("private notes", () => {
  it("never reach the developer", async () => {
    const secret = "Nota interna: salário acima do teto";
    const job = await newJob();
    await markInterest(db, acme.id, marina);
    await applyToJob(db, marina, { jobId: job.id, message: "" }, appUrl);
    expect(await setCandidateNote(db, acme.id, job.id, marina, secret)).toBe(true);
    expect((await listCandidates(db, acme.id, job.id))?.[0]?.note).toBe(secret);

    // Through every outcome that writes to the developer.
    await moveCandidate(db, acme.id, job.id, marina, "not_advanced", appUrl);
    await removeCandidate(db, acme.id, job.id, marina, appUrl);
    const seen = JSON.stringify([
      await listMyApplications(db, marina),
      await listOpenJobsFor(db, acme.id, marina),
      await listJobBoard(db, marina),
      outbox(),
    ]);
    expect(seen).not.toContain("salário acima do teto");
    // Nor the company's stage names.
    expect(JSON.stringify(await listMyApplications(db, marina))).not.toContain('"stage');
  });
});

describe("migration 0032", () => {
  it("turns the offers stored in job_candidates into applications, keeping them all", async () => {
    const job = await newJob();
    await advanceCandidate(db, acme.id, job.id, marina, "contacted");
    // Offers as earlier versions stored them.
    await db
      .update(jobCandidates)
      .set({ appliedAt: new Date(5000), applicationMessage: "Antiga." })
      .where(eq(jobCandidates.developerId, marina));
    await db.insert(jobCandidates).values({
      jobId: job.id,
      developerId: rafael,
      stage: "saved",
      appliedAt: new Date(6000),
    });
    const copy = readFileSync("drizzle/0032_job_applications.sql", "utf8")
      .split("--> statement-breakpoint")
      .filter((statement) => /^\s*(--.*\n)*\s*INSERT INTO/.test(statement));
    expect(copy).toHaveLength(2);
    for (const statement of copy) await db.execute(sql.raw(statement));

    expect((await mine())[0]).toMatchObject({
      job: { title: "Front-end Pleno", requiredSkills: ["React"], compensationPeriod: "month" },
      message: "Antiga.",
      appliedAt: new Date(5000).toISOString(),
      status: "in_progress",
      history: [{ kind: "applied", at: new Date(5000).toISOString() }],
    });
    expect((await mine(rafael))[0]?.status).toBe("submitted");
    expect(await db.select().from(jobApplications)).toHaveLength(2);
    // The company's stages are untouched.
    expect((await listCandidates(db, acme.id, job.id))?.map((c) => c.stage)).toEqual([
      "contacted",
      "saved",
    ]);
  });
});
