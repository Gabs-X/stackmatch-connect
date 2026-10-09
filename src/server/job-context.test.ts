import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { defaultCompanySettings } from "@/lib/company-settings";
import { emptyJob, type JobInput } from "@/lib/jobs";
import { interestedCompanies } from "@/lib/profile-interests";
import { saveCompanySettings } from "./companies";
import type { Db } from "./db";
import { textTranslations } from "./db/schema";
import { outbox } from "./email";
import { listInterestsFor } from "./interests";
import {
  companyAccountTexts,
  createJob,
  listCandidates,
  translateCompanyTexts,
  updateJob,
} from "./jobs";
import { answerMeetingRequest, listReceivedBy, sendMeetingRequest } from "./meetings";
import { jobEmailDetails } from "./notifications";
import { markInterestAndNotify } from "./outreach";
import { createCompany, createDeveloper, createTestDb } from "./test-db";
import { loadTranslations, type Translator } from "./translations";

let db: Db;
let acme: AuthUser;
let marina: string;

const now = Date.parse("2026-10-01T12:00:00-03:00");
const appUrl = "https://stackmatch.example";

const backend: JobInput = {
  ...emptyJob,
  title: "Backend Pleno",
  description: "API de pagamentos em Node.js.",
  requiredSkills: ["Node.js"],
  desiredSkills: ["PostgreSQL"],
  seniority: ["Pleno"],
  workModes: ["Híbrido"],
  hiringTypes: ["PJ"],
  location: "São Paulo, SP",
  compensationMin: 9000,
  compensationMax: 9000,
};

/** English gets "EN: " in front; Portuguese stays. */
const fakeTranslate: Translator = async (texts) =>
  texts.map((text) => ({ pt: text, en: `EN: ${text}` }));

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  acme = await createCompany(db, "bia@acme.com");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
});

async function newJob(input = backend) {
  const result = await createJob(db, acme.id, input);
  if (!("job" in result)) throw new Error("job not created");
  return result.job;
}

describe("jobEmailDetails", () => {
  it("lists the job's main points in the e-mail's language", () => {
    expect(jobEmailDetails(backend, "pt")).toEqual({
      title: "Vaga: Backend Pleno",
      rows: [
        ["Senioridade", "Pleno"],
        ["Modelo de trabalho", "Híbrido · São Paulo, SP"],
        ["Tipo de contrato", "PJ"],
        ["Disponibilidade", "Qualquer"],
        // Intl puts a non-breaking space after the currency sign.
        ["Remuneração", "R$ 9.000 por mês"],
        ["Skills obrigatórias", "Node.js"],
        ["Skills desejáveis", "PostgreSQL"],
        ["Descrição", "API de pagamentos em Node.js."],
      ],
    });
    const english = jobEmailDetails(backend, "en", {
      "Backend Pleno": { pt: "Backend Pleno", en: "Mid-level Backend" },
    });
    expect(english.title).toBe("Job: Mid-level Backend");
    expect(english.rows).toContainEqual(["Seniority", "Mid-level"]);
    expect(english.rows).toContainEqual(["Pay", "R$9,000 per month"]);
  });

  it("quotes only the start of a long description", () => {
    const rows = jobEmailDetails({ ...backend, description: "a".repeat(1000) }, "pt").rows;
    expect(rows.at(-1)?.[1]).toBe(`${"a".repeat(400)}…`);
  });
});

describe("reaching a developer from a job", () => {
  it("tells them about the job with the interest e-mail, and keeps it with the mark", async () => {
    const job = await newJob();
    expect(await markInterestAndNotify(db, acme.id, marina, "pt", appUrl, now, job.id)).toEqual({
      ok: true,
    });
    expect(outbox().at(-1)?.text).toContain("Vaga: Backend Pleno");
    expect((await listCandidates(db, acme.id, job.id))?.[0]?.stage).toBe("interest");

    // The developer sees the job as it was when marked, even after it changes.
    await updateJob(db, acme.id, job.id, { ...backend, title: "Backend Sênior" });
    const [interest] = await listInterestsFor(db, marina);
    expect(interest?.job?.title).toBe("Backend Pleno");
  });

  it("points an earlier mark to the job, without e-mailing again", async () => {
    await markInterestAndNotify(db, acme.id, marina, "pt", appUrl, now);
    const sent = outbox().length;
    const job = await newJob();
    await markInterestAndNotify(db, acme.id, marina, "pt", appUrl, now, job.id);
    expect(outbox()).toHaveLength(sent);
    expect((await listInterestsFor(db, marina))[0]?.job?.title).toBe("Backend Pleno");
    expect((await listCandidates(db, acme.id, job.id))?.[0]?.stage).toBe("interest");
  });

  it("ignores a job of another company", async () => {
    const globex = await createCompany(db, "caio@globex.com", "Globex");
    const result = await createJob(db, globex.id, backend);
    if (!("job" in result)) throw new Error("job not created");
    await markInterestAndNotify(db, acme.id, marina, "pt", appUrl, now, result.job.id);
    expect(outbox().at(-1)?.text).not.toContain("Vaga:");
    expect((await listInterestsFor(db, marina))[0]?.job).toBeUndefined();
  });

  it("sends the job with the proposal, and the developer sees it", async () => {
    const job = await newJob();
    const result = await sendMeetingRequest(
      db,
      acme,
      { developerId: marina, date: "2026-10-02", time: "10:30", message: "Oi", jobId: job.id },
      now,
    );
    expect("request" in result && result.request.job?.title).toBe("Backend Pleno");
    const email = outbox().at(-1);
    expect(email?.text).toContain("Vaga: Backend Pleno");
    expect(email?.html).toContain("Skills obrigatórias");
    const [received] = await listReceivedBy(db, marina);
    expect(received?.job?.requiredSkills).toEqual(["Node.js"]);
    const [company] = interestedCompanies(marina, [], received ? [received] : []);
    expect(company?.job?.snapshot.title).toBe("Backend Pleno");
  });
});

describe("company translations", () => {
  it("cover the details, the jobs and the jobs sent, so saving one keeps the others", async () => {
    const job = await newJob();
    await sendMeetingRequest(
      db,
      acme,
      { developerId: marina, date: "2026-10-02", time: "10:30", message: "", jobId: job.id },
      now,
    );
    await updateJob(db, acme.id, job.id, { ...backend, title: "Backend Sênior" });
    const settings = defaultCompanySettings(acme);
    await saveCompanySettings(db, acme.id, { ...settings, about: "Fintech." });
    expect(await companyAccountTexts(db, acme.id)).toEqual(
      expect.arrayContaining(["Fintech.", "Backend Sênior", "Backend Pleno"]),
    );

    await translateCompanyTexts(db, acme.id, undefined, { translator: fakeTranslate });
    // Saving the company details again doesn't drop the jobs' translations.
    await translateCompanyTexts(
      db,
      acme.id,
      { about: "Fintech de pagamentos.", contactRole: "" },
      {
        translator: fakeTranslate,
      },
    );
    const kept = await loadTranslations(db, [acme.id], ["Backend Sênior", "Backend Pleno"]);
    expect(Object.keys(kept)).toEqual(expect.arrayContaining(["Backend Sênior", "Backend Pleno"]));
    expect(await db.select().from(textTranslations)).not.toHaveLength(0);
  });
});

describe("answering a proposal", () => {
  async function propose(jobId?: string) {
    const result = await sendMeetingRequest(
      db,
      acme,
      {
        developerId: marina,
        date: "2026-10-02",
        time: "10:30",
        message: "",
        ...(jobId ? { jobId } : {}),
      },
      now,
      "en",
    );
    if (!("request" in result)) throw new Error("proposal not sent");
    return result.request;
  }

  it("accepting tells the company, in the proposal's language, and schedules the call in the job", async () => {
    const job = await newJob();
    const request = await propose(job.id);
    expect(request.status).toBe("pending");
    const result = await answerMeetingRequest(
      db,
      { side: "developer", accountId: marina },
      request.id,
      "accepted",
      now,
    );
    expect("request" in result && result.request.status).toBe("accepted");
    const email = outbox().at(-1);
    expect(email?.to).toBe(request.email);
    expect(email?.replyTo).toBe("marina@example.com");
    expect(email?.subject).toBe("Marina Costa accepted the call on StackMatch");
    expect(email?.text).toContain("The proposal was about the job Backend Pleno.");
    expect(email?.attachments?.[0]).toMatchObject({
      filename: "conversa-stackmatch.ics",
      contentType: "text/calendar; method=PUBLISH",
    });
    expect(email?.attachments?.[0]?.content).toContain(
      "SUMMARY:Call with Marina Costa (StackMatch)",
    );
    expect(email?.attachments?.[0]?.content).toContain(
      "Contact: Marina Costa <marina@example.com>",
    );
    expect((await listCandidates(db, acme.id, job.id))?.[0]?.stage).toBe("meeting");
  });

  it("declining keeps the developer at contacted", async () => {
    const job = await newJob();
    const request = await propose(job.id);
    await answerMeetingRequest(
      db,
      { side: "developer", accountId: marina },
      request.id,
      "declined",
      now,
    );
    expect(outbox().at(-1)?.subject).toBe("Marina Costa declined the proposed time");
    expect(outbox().at(-1)?.attachments).toBeUndefined();
    expect((await listCandidates(db, acme.id, job.id))?.[0]?.stage).toBe("contacted");
    expect((await listReceivedBy(db, marina))[0]?.status).toBe("declined");
  });

  it("is answered once, and only by the developer it went to", async () => {
    const request = await propose();
    const rafael = await createDeveloper(db, "rafael@example.com", "Rafael Lima");
    expect(
      await answerMeetingRequest(
        db,
        { side: "developer", accountId: rafael },
        request.id,
        "accepted",
        now,
      ),
    ).toEqual({
      error: "unknown-meeting",
    });
    await answerMeetingRequest(
      db,
      { side: "developer", accountId: marina },
      request.id,
      "declined",
      now,
    );
    expect(
      await answerMeetingRequest(
        db,
        { side: "developer", accountId: marina },
        request.id,
        "accepted",
        now,
      ),
    ).toEqual({
      error: "already-answered",
    });
  });
  it("can't be answered once the proposed time comes", async () => {
    const request = await propose();
    const start = Date.parse("2026-10-02T10:30:00-03:00");
    const sent = outbox().length;
    expect(
      await answerMeetingRequest(
        db,
        { side: "developer", accountId: marina },
        request.id,
        "accepted",
        start,
      ),
    ).toEqual({
      error: "expired",
    });
    expect(outbox()).toHaveLength(sent);
    expect((await listReceivedBy(db, marina))[0]?.status).toBe("pending");
    // A minute earlier it still could.
    expect(
      await answerMeetingRequest(
        db,
        { side: "developer", accountId: marina },
        request.id,
        "accepted",
        start - 60_000,
      ),
    ).toHaveProperty("request.status", "accepted");
  });
});
