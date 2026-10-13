import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { emptyJob, type JobInput } from "@/lib/jobs";
import type { Db } from "./db";
import { outbox } from "./email";
import { applyToJob, listOpenJobsFor } from "./job-applications";
import { listJobBoard } from "./job-board";
import {
  advanceCandidate,
  createJob,
  deleteJob,
  listCandidates,
  listJobs,
  setJobStatus,
} from "./jobs";
import { markInterest } from "./interests";
import { createCompany, createDeveloper, createTestDb } from "./test-db";

let db: Db;
let acme: AuthUser;
let marina: string;

const frontend: JobInput = {
  ...emptyJob,
  listed: false,
  title: "Front-end Pleno",
  description: "App de pagamentos.",
  requiredSkills: ["React"],
};

const appUrl = "https://stackmatch.example";

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  acme = await createCompany(db, "bia@acme.com");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
});

async function newJob(input = frontend) {
  const result = await createJob(db, acme.id, input);
  if (!("job" in result)) throw new Error("job not created");
  return result.job;
}

describe("job applications", () => {
  it("shows the open jobs only to developers the company reached", async () => {
    const open = await newJob();
    const closed = await newJob({ ...frontend, title: "Back-end" });
    await setJobStatus(db, acme.id, closed.id, "closed", appUrl);
    expect(await listOpenJobsFor(db, acme.id, marina)).toBeNull();

    await markInterest(db, acme.id, marina);
    const listed = await listOpenJobsFor(db, acme.id, marina);
    expect(listed?.jobs.map((job) => [job.id, job.title, job.appliedAt])).toEqual([
      [open.id, "Front-end Pleno", null],
    ]);
  });

  it("puts the developer in the job once, with the message, and tells the company", async () => {
    const job = await newJob();
    expect(await applyToJob(db, marina, { jobId: job.id, message: "Oi!" }, appUrl)).toEqual({
      error: "unknown-job",
    });

    await markInterest(db, acme.id, marina);
    const result = await applyToJob(db, marina, { jobId: job.id, message: "Oi!" }, appUrl, 1000);
    expect(result).toEqual({ appliedAt: new Date(1000).toISOString() });
    expect(await listCandidates(db, acme.id, job.id)).toEqual([
      expect.objectContaining({
        developerId: marina,
        stage: "saved",
        appliedAt: new Date(1000).toISOString(),
        applicationMessage: "Oi!",
      }),
    ]);
    const email = outbox().at(-1);
    expect(email).toMatchObject({
      to: "bia@acme.com",
      subject: "Marina Costa se ofereceu para a vaga Front-end Pleno",
      replyTo: "marina@example.com",
    });
    expect(email?.text).toContain("> Oi!");
    expect(email?.text).toContain(`${appUrl}/jobs/${job.id}`);
    expect((await listOpenJobsFor(db, acme.id, marina))?.jobs[0]?.appliedAt).toBe(
      new Date(1000).toISOString(),
    );
    expect((await listJobs(db, acme.id))[0]?.applied).toBe(1);

    const sent = outbox().length;
    expect(await applyToJob(db, marina, { jobId: job.id, message: "" }, appUrl)).toEqual({
      error: "already-applied",
    });
    expect(outbox()).toHaveLength(sent);
  });

  it("keeps the stage the company already gave the developer", async () => {
    const job = await newJob();
    await markInterest(db, acme.id, marina);
    await advanceCandidate(db, acme.id, job.id, marina, "contacted");
    await applyToJob(db, marina, { jobId: job.id, message: "" }, appUrl);
    expect((await listCandidates(db, acme.id, job.id))?.[0]).toMatchObject({
      stage: "contacted",
      applicationMessage: "",
    });
  });

  it("records one of two offers sent at once, keeps its message and tells the company once", async () => {
    await markInterest(db, acme.id, marina);
    // Without the developer in the job yet, and with them already in it at "contacted".
    for (const alreadyIn of [false, true]) {
      const job = await newJob({ ...frontend, title: alreadyIn ? "Já na vaga" : "Nova" });
      if (alreadyIn) await advanceCandidate(db, acme.id, job.id, marina, "contacted");
      const sent = outbox().length;
      const messages = ["Primeira", "Segunda"];
      const results = await Promise.all(
        messages.map((message) => applyToJob(db, marina, { jobId: job.id, message }, appUrl)),
      );
      const winner = results.findIndex((result) => "appliedAt" in result);
      expect(winner).not.toBe(-1);
      expect(results.filter((result) => "error" in result)).toEqual([{ error: "already-applied" }]);
      expect(await listCandidates(db, acme.id, job.id)).toEqual([
        expect.objectContaining({
          stage: alreadyIn ? "contacted" : "saved",
          applicationMessage: messages[winner],
        }),
      ]);
      expect(outbox()).toHaveLength(sent + 1);
    }
  });

  it("records an offer made while the job closes, or finds it closed, never half of it", async () => {
    await markInterest(db, acme.id, marina);
    const job = await newJob();
    const [result] = await Promise.all([
      applyToJob(db, marina, { jobId: job.id, message: "Oi!" }, appUrl),
      setJobStatus(db, acme.id, job.id, "closed", appUrl),
    ]);
    const candidates = await listCandidates(db, acme.id, job.id);
    if ("appliedAt" in result) expect(candidates).toHaveLength(1);
    else {
      expect(result).toEqual({ error: "unknown-job" });
      expect(candidates).toEqual([]);
    }
    // Closed from then on.
    expect(await applyToJob(db, marina, { jobId: job.id, message: "" }, appUrl)).toEqual({
      error: "unknown-job",
    });
  });

  it("doesn't fail when the job is deleted during the offer", async () => {
    await markInterest(db, acme.id, marina);
    const job = await newJob();
    const [result] = await Promise.all([
      applyToJob(db, marina, { jobId: job.id, message: "Oi!" }, appUrl),
      deleteJob(db, acme.id, job.id, appUrl),
    ]);
    // Recorded before the deletion (and then deleted with the job), or refused after it.
    if (!("appliedAt" in result)) expect(result).toEqual({ error: "unknown-job" });
    expect(await listCandidates(db, acme.id, job.id)).toBeNull();
  });

  it("refuses closed jobs", async () => {
    const job = await newJob();
    await markInterest(db, acme.id, marina);
    await setJobStatus(db, acme.id, job.id, "closed", appUrl);
    expect(await applyToJob(db, marina, { jobId: job.id, message: "" }, appUrl)).toEqual({
      error: "unknown-job",
    });
  });

  it("lists the open jobs companies published, newest first, to any developer", async () => {
    const globex = await createCompany(db, "rh@globex.com", "Globex");
    const hidden = await newJob();
    const listed = await newJob({ ...frontend, title: "Mobile", listed: true });
    const closed = await newJob({ ...frontend, title: "Antiga", listed: true });
    await setJobStatus(db, acme.id, closed.id, "closed", appUrl);
    const other = await createJob(db, globex.id, { ...frontend, title: "Dados", listed: true });
    if (!("job" in other)) throw new Error("job not created");

    const board = await listJobBoard(db, marina);
    expect(board.jobs.map((job) => [job.title, job.company])).toEqual([
      ["Dados", "Globex"],
      ["Mobile", "Acme"],
    ]);
    expect(board.jobs[0]).not.toHaveProperty("listed");
    expect(hidden.listed).toBe(false);

    // Listed jobs take offers without the company reaching the developer first.
    expect(await applyToJob(db, marina, { jobId: listed.id, message: "" }, appUrl)).toHaveProperty(
      "appliedAt",
    );
    expect(await applyToJob(db, marina, { jobId: hidden.id, message: "" }, appUrl)).toEqual({
      error: "unknown-job",
    });
    expect((await listJobBoard(db, marina)).jobs[1]?.appliedAt).not.toBeNull();
  });
});
