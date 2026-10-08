import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { emptyJob, jobFilters, maxJobsPerCompany, type JobInput } from "@/lib/jobs";
import { cleanup } from "./cleanup";
import type { Db } from "./db";
import { savedTalents, skills } from "./db/schema";
import {
  advanceCandidate,
  createJob,
  deleteJob,
  listCandidates,
  listJobs,
  loadJob,
  moveCandidate,
  removeCandidate,
  setJobStatus,
  updateJob,
} from "./jobs";
import { sendMeetingRequest } from "./meetings";
import { saveTalent } from "./saved-talents";
import { createCompany, createDeveloper, createTestDb } from "./test-db";

let db: Db;
let acme: AuthUser;
let marina: string;

const frontend: JobInput = {
  ...emptyJob,
  title: "Front-end Pleno",
  description: "App de pagamentos.",
  requiredSkills: ["React", "TypeScript"],
  desiredSkills: ["GraphQL", "react"],
  seniority: ["Pleno", "Sênior"],
  workModes: ["Remoto"],
  hiringTypes: ["PJ"],
  availability: [],
  compensationMin: 8000,
  compensationMax: 12000,
};

beforeEach(async () => {
  db = await createTestDb();
  acme = await createCompany(db, "bia@acme.com");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
});

async function newJob(input = frontend, company = acme.id) {
  const result = await createJob(db, company, input);
  if (!("job" in result)) throw new Error("job not created");
  return result.job;
}

describe("jobs", () => {
  it("keeps the stack in order, a skill once, must-haves first", async () => {
    const job = await newJob();
    expect(job).toMatchObject({
      title: "Front-end Pleno",
      requiredSkills: ["React", "TypeScript"],
      // "react" is the same skill as the must-have React.
      desiredSkills: ["GraphQL"],
      seniority: ["Pleno", "Sênior"],
      compensationMin: 8000,
      compensationPeriod: "month",
      status: "open",
    });
    expect(jobFilters(job).skills).toEqual(["React", "TypeScript", "GraphQL"]);
  });

  it("only shows, changes or deletes a job to the company that owns it", async () => {
    const job = await newJob();
    const other = await createCompany(db, "caio@globex.com", "Globex");
    expect(await loadJob(db, other.id, job.id)).toBeNull();
    expect(await updateJob(db, other.id, job.id, { ...frontend, title: "Outra" })).toBeNull();
    expect(await setJobStatus(db, other.id, job.id, "closed")).toBe(false);
    expect(await listCandidates(db, other.id, job.id)).toBeNull();
    expect(await advanceCandidate(db, other.id, job.id, marina, "saved")).toBe(false);
    await deleteJob(db, other.id, job.id);
    expect(await loadJob(db, acme.id, job.id)).not.toBeNull();
    expect(await listJobs(db, other.id)).toEqual([]);
  });

  it("updates the details and the stack, and closes and reopens", async () => {
    const job = await newJob();
    const updated = await updateJob(db, acme.id, job.id, {
      ...frontend,
      title: "Front-end Sênior",
      requiredSkills: ["Vue"],
      desiredSkills: [],
    });
    expect(updated).toMatchObject({ title: "Front-end Sênior", requiredSkills: ["Vue"] });
    expect(await setJobStatus(db, acme.id, job.id, "closed")).toBe(true);
    expect((await loadJob(db, acme.id, job.id))?.status).toBe("closed");
  });

  it("lists open jobs first, with how many developers are at each stage", async () => {
    const closed = await newJob({ ...frontend, title: "Antiga" });
    await setJobStatus(db, acme.id, closed.id, "closed");
    const open = await newJob({ ...frontend, title: "Nova" });
    const rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
    await advanceCandidate(db, acme.id, open.id, marina, "interest");
    await advanceCandidate(db, acme.id, open.id, rafael, "saved");
    const jobs = await listJobs(db, acme.id);
    expect(jobs.map((job) => job.title)).toEqual(["Nova", "Antiga"]);
    expect(jobs[0]?.counts).toEqual({ saved: 1, interest: 1, contacted: 0, meeting: 0 });
  });

  it("refuses a new job past the limit", async () => {
    for (let i = 0; i < maxJobsPerCompany; i++) await newJob({ ...emptyJob, title: `Vaga ${i}` });
    expect(await createJob(db, acme.id, frontend)).toEqual({ error: "job-limit" });
  });

  it("keeps the saves when the job is deleted", async () => {
    const job = await newJob();
    await saveTalent(db, acme.id, marina);
    await advanceCandidate(db, acme.id, job.id, marina, "saved");
    await deleteJob(db, acme.id, job.id);
    expect(await listJobs(db, acme.id)).toEqual([]);
    expect(await db.select().from(savedTalents)).toHaveLength(1);
  });
});

describe("candidates", () => {
  it("only move forward on their own, and to any stage by hand", async () => {
    const job = await newJob();
    const stage = async () => (await listCandidates(db, acme.id, job.id))?.[0]?.stage;
    await advanceCandidate(db, acme.id, job.id, marina, "interest");
    expect(await stage()).toBe("interest");
    await advanceCandidate(db, acme.id, job.id, marina, "saved");
    expect(await stage()).toBe("interest");
    await advanceCandidate(db, acme.id, job.id, marina, "contacted");
    expect(await stage()).toBe("contacted");
    expect(await moveCandidate(db, acme.id, job.id, marina, "saved")).toBe(true);
    expect(await stage()).toBe("saved");
    await removeCandidate(db, acme.id, job.id, marina);
    expect(await listCandidates(db, acme.id, job.id)).toEqual([]);
    expect(await moveCandidate(db, acme.id, job.id, marina, "meeting")).toBe(false);
  });

  it("are only profiles that exist", async () => {
    const job = await newJob();
    expect(await advanceCandidate(db, acme.id, job.id, "nobody", "saved")).toBe(false);
  });

  it("move to contacted when a proposal goes out from the job", async () => {
    const job = await newJob();
    const now = Date.parse("2026-10-01T12:00:00-03:00");
    const result = await sendMeetingRequest(
      db,
      acme,
      { developerId: marina, date: "2026-10-02", time: "10:30", message: "", jobId: job.id },
      now,
    );
    expect("request" in result).toBe(true);
    expect((await listCandidates(db, acme.id, job.id))?.[0]?.stage).toBe("contacted");
  });
});

it("the daily cleanup keeps skills only a job uses", async () => {
  await newJob({ ...frontend, requiredSkills: ["Elm"], desiredSkills: [] });
  await cleanup(db);
  expect((await db.select().from(skills)).map((skill) => skill.name)).toContain("Elm");
});
