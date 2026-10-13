import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { matchJob } from "@/lib/job-match";
import { emptyJob, jobBoardPageSize, type JobBoardQuery, type JobInput } from "@/lib/jobs";
import { emptyProfile } from "@/lib/local-profile";
import { createAccount } from "./auth";
import type { Db } from "./db";
import { jobs, textTranslations } from "./db/schema";
import { listJobBoard } from "./job-board";
import { createJob, setJobStatus } from "./jobs";
import { loadPublishedProfile, saveProfile } from "./profiles";
import { createCompany, createDeveloper, createTestDb } from "./test-db";
import { hashText } from "./translations";

let db: Db;
let acme: AuthUser;
let marina: string;

const appUrl = "https://stackmatch.example";

beforeEach(async () => {
  db = await createTestDb();
  acme = await createCompany(db, "bia@acme.com");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
});

/** Every page of a search, following `next`; the ids in order, and the pages. */
async function allPages(developerId: string, query: JobBoardQuery = {}) {
  const pages = [];
  let after: string | undefined;
  do {
    const page = await listJobBoard(db, developerId, { ...query, ...(after ? { after } : {}) });
    pages.push(page);
    after = page.next ?? undefined;
  } while (after && pages.length < 100);
  return { ids: pages.flatMap((page) => page.jobs.map((job) => job.id)), pages };
}

/** Many listed jobs straight in the table, past the per-company limit; some share a time. */
async function insertJobs(total: number) {
  const rows = Array.from({ length: total }, (_, index) => ({
    id: `job-${String(index).padStart(3, "0")}`,
    companyId: acme.id,
    title: `Vaga ${index}`,
    listed: true,
    // Three jobs at each moment, so ties are broken by id.
    createdAt: new Date(Date.UTC(2026, 0, 1) + Math.floor(index / 3) * 60_000),
  }));
  await db.insert(jobs).values(rows);
  return rows;
}

const newestFirst = (rows: { id: string; createdAt: Date }[]) =>
  [...rows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
    .map((row) => row.id);

describe("the job board", () => {
  it("pages through more than 200 jobs, newest first, each once, only open and listed ones", async () => {
    const listed = await insertJobs(230);
    await db.insert(jobs).values([
      { id: "closed", companyId: acme.id, title: "Fechada", listed: true, status: "closed" },
      { id: "internal", companyId: acme.id, title: "Interna", listed: false },
    ]);
    const { ids, pages } = await allPages(marina, { sort: "recent" });
    expect(pages).toHaveLength(Math.ceil(230 / jobBoardPageSize));
    expect(pages.every((page) => page.total === 230 && page.sort === "recent")).toBe(true);
    expect(ids).toEqual(newestFirst(listed));
  });

  it("neither repeats nor skips jobs when others are published or closed between pages", async () => {
    const listed = await insertJobs(60);
    const order = newestFirst(listed);
    const first = await listJobBoard(db, marina, { sort: "recent" });
    // A newer job and two closed ones, one already seen and one on a later page.
    await db.insert(jobs).values({ id: "new", companyId: acme.id, title: "Nova", listed: true });
    await db
      .update(jobs)
      .set({ status: "closed" })
      .where(eq(jobs.id, order[0] ?? ""));
    await db
      .update(jobs)
      .set({ status: "closed" })
      .where(eq(jobs.id, order[30] ?? ""));
    const { ids: rest } = await allPages(marina, {
      sort: "recent",
      ...(first.next ? { after: first.next } : {}),
    });
    const seen = [...first.jobs.map((job) => job.id), ...rest];
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(order.filter((id) => id !== order[30]));
  });

  it("orders by the same match the screen shows, ties newest first", async () => {
    await saveProfile(db, marina, {
      ...emptyProfile,
      name: "Marina Costa",
      role: "Frontend Developer",
      location: "Recife, PE",
      seniority: "Pleno",
      workMode: "Híbrido",
      availability: "Em 15 dias",
      bio: "Interfaces.",
      skills: ["React", "TypeScript", "go"],
      hiringTypes: ["PJ"],
    });
    const profile = await loadPublishedProfile(db, marina);
    if (!profile) throw new Error("no profile");
    const variants: Partial<JobInput>[] = [
      {},
      { requiredSkills: ["React"] },
      { requiredSkills: ["React", "Vue"], desiredSkills: ["Go"] },
      { requiredSkills: ["Rust"], seniority: ["Pleno"] },
      { seniority: ["Sênior"], workModes: ["Híbrido"] },
      { hiringTypes: ["CLT"], availability: ["Em 15 dias"] },
      { hiringTypes: ["PJ", "CLT"], location: "Recife, PE", workModes: ["Presencial"] },
      { location: "Olinda, PE", workModes: ["Híbrido"] },
      { location: "São Paulo, SP" },
      { location: "Recife, PE", workModes: ["Remoto"] },
      { desiredSkills: ["typescript", "Docker", "AWS"] },
      { requiredSkills: ["React"], desiredSkills: ["TypeScript"], seniority: ["Pleno"] },
    ];
    // Two companies, to stay under the per-company limit.
    const globex = await createCompany(db, "rh@globex.com", "Globex");
    const created = [];
    for (let index = 0; index < variants.length * 2; index += 1) {
      const company = index % 2 ? globex : acme;
      const result = await createJob(db, company.id, {
        ...emptyJob,
        title: `Vaga ${index}`,
        ...variants[index % variants.length],
      });
      if (!("job" in result)) throw new Error("job not created");
      created.push(result.job);
    }
    const expected = created
      .map((job, index) => ({ id: job.id, index, score: matchJob(job, profile).score ?? -1 }))
      .sort((a, b) => b.score - a.score || b.index - a.index)
      .map((job) => job.id);
    const { ids, pages } = await allPages(marina);
    expect(pages[0]?.sort).toBe("match");
    expect(ids).toEqual(expected);
  });

  it("is newest first for a developer without a published profile", async () => {
    const user = await createAccount(db, {
      accountType: "developer",
      name: "Rafael Lima",
      company: "",
      cnpj: "",
      jobTitle: "Backend Developer",
      email: "rafael@example.com",
      password: "segredo123",
      acceptTerms: true,
    });
    if (!user) throw new Error("account not created");
    const listed = await insertJobs(25);
    const { ids, pages } = await allPages(user.id, { sort: "match" });
    expect(pages[0]?.sort).toBe("recent");
    expect(ids).toEqual(newestFirst(listed));
  });

  it("finds jobs by title, translated title, company or skill, and by work model", async () => {
    const globex = await createCompany(db, "rh@globex.com", "Globex Pagamentos");
    const make = async (company: AuthUser, input: Partial<JobInput>) => {
      const result = await createJob(db, company.id, { ...emptyJob, ...input });
      if (!("job" in result)) throw new Error("job not created");
      return result.job.id;
    };
    const data = await make(acme, { title: "Engenharia de Dados", requiredSkills: ["Python"] });
    const mobile = await make(acme, { title: "Mobile Pleno", workModes: ["Presencial"] });
    const anyMode = await make(globex, { title: "Back-end", desiredSkills: ["Kotlin"] });
    await db.insert(textTranslations).values({
      ownerId: acme.id,
      hash: hashText("Engenharia de Dados"),
      language: "en",
      text: "Data Engineering",
    });
    const found = async (query: JobBoardQuery) =>
      (await listJobBoard(db, marina, { sort: "recent", ...query })).jobs.map((job) => job.id);

    expect(await found({ search: "dados" })).toEqual([data]);
    expect(await found({ search: "DATA ENGINEERING" })).toEqual([data]);
    expect(await found({ search: "pagamentos" })).toEqual([anyMode]);
    expect(await found({ search: "kotlin" })).toEqual([anyMode]);
    expect(await found({ search: "pyth" })).toEqual([data]);
    // A job open to any work model fits every choice.
    expect(await found({ modes: ["Presencial"] })).toEqual([anyMode, mobile, data]);
    expect(await found({ modes: ["Remoto"], search: "mobile" })).toEqual([]);
    expect(await found({ search: "pleno", modes: ["Presencial", "Remoto"] })).toEqual([mobile]);
  });

  it("answers a search without results with an empty last page", async () => {
    await insertJobs(5);
    for (const search of ["kotlin", "%", "_", "\\"])
      expect(await listJobBoard(db, marina, { search })).toMatchObject({
        jobs: [],
        next: null,
        total: 0,
      });
  });

  it("starts over from a malformed cursor and ignores one from another order", async () => {
    const listed = await insertJobs(25);
    const first = await listJobBoard(db, marina, { sort: "recent" });
    for (const after of ["not-a-cursor", Buffer.from("{}").toString("base64url")])
      expect((await listJobBoard(db, marina, { sort: "recent", after })).jobs).toEqual(first.jobs);
    expect(first.jobs.map((job) => job.id)).toEqual(newestFirst(listed).slice(0, 20));
  });

  it("leaves a job out once the company closes it", async () => {
    const result = await createJob(db, acme.id, { ...emptyJob, title: "Única" });
    if (!("job" in result)) throw new Error("job not created");
    expect((await listJobBoard(db, marina)).total).toBe(1);
    await setJobStatus(db, acme.id, result.job.id, "closed", appUrl);
    expect(await listJobBoard(db, marina)).toMatchObject({ jobs: [], total: 0 });
  });
});
