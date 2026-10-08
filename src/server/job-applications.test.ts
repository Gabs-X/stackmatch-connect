import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { emptyJob, type JobInput } from "@/lib/jobs";
import type { Db } from "./db";
import { outbox } from "./email";
import { applyToJob, listOpenJobsFor } from "./job-applications";
import { advanceCandidate, createJob, listCandidates, listJobs, setJobStatus } from "./jobs";
import { markInterest } from "./interests";
import { createCompany, createDeveloper, createTestDb } from "./test-db";

let db: Db;
let acme: AuthUser;
let marina: string;

const frontend: JobInput = {
  ...emptyJob,
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
    await setJobStatus(db, acme.id, closed.id, "closed");
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

  it("refuses closed jobs", async () => {
    const job = await newJob();
    await markInterest(db, acme.id, marina);
    await setJobStatus(db, acme.id, job.id, "closed");
    expect(await applyToJob(db, marina, { jobId: job.id, message: "" }, appUrl)).toEqual({
      error: "unknown-job",
    });
  });
});
