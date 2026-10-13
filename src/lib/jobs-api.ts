import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createJob,
  deleteJob,
  listCandidateHistory,
  listCandidates,
  listJobs,
  loadJob,
  moveCandidate,
  removeCandidate,
  setCandidateNote,
  setJobStatus,
  translateCompanyTexts,
  updateJob,
} from "@/server/jobs";
import { getRequestUrl } from "@tanstack/react-start/server";
import {
  applyToJob,
  listMyApplications,
  listOpenJobsFor,
  withdrawApplication,
} from "@/server/job-applications";
import { listJobBoard } from "@/server/job-board";
import { database, requireAccount } from "@/server/session";
import {
  applicationInputSchema,
  jobBoardQuerySchema,
  jobInputSchema,
  jobStages,
  maxCandidateNote,
  type JobBoardQuery,
} from "./jobs";

export const jobId = z.string().min(1).max(200);
const developerId = z.string().min(1).max(200);

/** Stands for `GET /me/jobs`: the signed-in company's jobs, with their stage counts. */
export const fetchMyJobs = createServerFn({ method: "GET" }).handler(async () =>
  listJobs(await database(), (await requireAccount("company")).id),
);

/** Stands for `GET /jobs/:id`; null when the company has no such job. */
export const fetchJob = createServerFn({ method: "GET" })
  .validator(jobId)
  .handler(async ({ data }) =>
    loadJob(await database(), (await requireAccount("company")).id, data),
  );

/** Stands for `POST /jobs`; refused once the company has as many as it may. */
export const createJobFn = createServerFn({ method: "POST" })
  .validator(jobInputSchema)
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    const db = await database();
    const result = await createJob(db, company.id, data);
    if ("job" in result) await translateCompanyTexts(db, company.id);
    return result;
  });

/** Stands for `PUT /jobs/:id`; null when the company has no such job. */
export const updateJobFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: jobId, job: jobInputSchema }))
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    const db = await database();
    const job = await updateJob(db, company.id, data.id, data.job);
    if (job) await translateCompanyTexts(db, company.id);
    return job;
  });

/** Stands for `POST /jobs/:id/close` and `/reopen`. */
export const setJobStatusFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: jobId, status: z.enum(["open", "closed"]) }))
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    const appUrl = getRequestUrl().origin;
    if (!(await setJobStatus(await database(), company.id, data.id, data.status, appUrl)))
      throw new Error("Unknown job.");
  });

/** Stands for `DELETE /jobs/:id`. */
export const deleteJobFn = createServerFn({ method: "POST" })
  .validator(jobId)
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    const db = await database();
    await deleteJob(db, company.id, data, getRequestUrl().origin);
    // Drops the translations of texts only the job had.
    await translateCompanyTexts(db, company.id);
  });

/** Stands for `GET /jobs/:id/candidates`; null when the company has no such job. */
export const fetchJobCandidates = createServerFn({ method: "GET" })
  .validator(jobId)
  .handler(async ({ data }) =>
    listCandidates(await database(), (await requireAccount("company")).id, data),
  );

/** Stands for `PATCH /jobs/:id/candidates/:developerId`: moves a developer to a stage by hand. */
export const moveCandidateFn = createServerFn({ method: "POST" })
  .validator(z.object({ jobId, developerId, stage: z.enum(jobStages) }))
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    if (
      !(await moveCandidate(
        await database(),
        company.id,
        data.jobId,
        data.developerId,
        data.stage,
        getRequestUrl().origin,
      ))
    )
      throw new Error("Unknown candidate.");
  });

/** Stands for `DELETE /jobs/:id/candidates/:developerId`. */
export const removeCandidateFn = createServerFn({ method: "POST" })
  // accountId: see requireAccount; sent by queued changes that may outlive the session.
  .validator(z.object({ jobId, developerId, accountId: z.string().min(1).max(200).optional() }))
  .handler(async ({ data }) =>
    removeCandidate(
      await database(),
      (await requireAccount("company", data.accountId)).id,
      data.jobId,
      data.developerId,
      getRequestUrl().origin,
    ),
  );

/** Stands for `PUT /jobs/:id/candidates/:developerId/note`: the company's private note on them. */
export const setCandidateNoteFn = createServerFn({ method: "POST" })
  .validator(z.object({ jobId, developerId, note: z.string().trim().max(maxCandidateNote) }))
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    if (
      !(await setCandidateNote(
        await database(),
        company.id,
        data.jobId,
        data.developerId,
        data.note,
      ))
    )
      throw new Error("Unknown candidate.");
  });

/**
 * Stands for `GET /jobs/:id/candidates/:developerId/history`; null when the company has no such
 * job.
 */
export const fetchCandidateHistory = createServerFn({ method: "GET" })
  .validator(z.object({ jobId, developerId }))
  .handler(async ({ data }) =>
    listCandidateHistory(
      await database(),
      (await requireAccount("company")).id,
      data.jobId,
      data.developerId,
    ),
  );

/** Every query on jobs starts with this key, to refresh them all after a change. */
export const jobsQueryKey = ["jobs"];

export const myJobsQuery = (accountId: string) =>
  queryOptions({ queryKey: [...jobsQueryKey, accountId], queryFn: () => fetchMyJobs() });

export const jobQuery = (accountId: string, id: string) =>
  queryOptions({
    queryKey: [...jobsQueryKey, accountId, id],
    queryFn: () => fetchJob({ data: id }),
  });

export const jobCandidatesQuery = (accountId: string, id: string) =>
  queryOptions({
    queryKey: [...jobsQueryKey, accountId, id, "candidates"],
    queryFn: () => fetchJobCandidates({ data: id }),
  });

/**
 * Stands for `GET /companies/:id/jobs` for developers: the open jobs of a company that reached
 * them; null if it never did.
 */
export const fetchOpenJobs = createServerFn({ method: "GET" })
  .validator(z.string().min(1).max(200))
  .handler(async ({ data }) =>
    listOpenJobsFor(await database(), data, (await requireAccount("developer")).id),
  );

/**
 * Stands for `POST /jobs/:id/applications`: the developer offers themselves for the job and the
 * company hears by e-mail. Expected refusals come back as a code (see applyToJob).
 */
export const applyToJobFn = createServerFn({ method: "POST" })
  .validator(applicationInputSchema)
  .handler(async ({ data }) =>
    applyToJob(
      await database(),
      (await requireAccount("developer")).id,
      data,
      getRequestUrl().origin,
    ),
  );

/** Stands for `GET /job-board`: the open jobs companies listed, for developers. */
export const fetchJobBoard = createServerFn({ method: "GET" })
  .validator(jobBoardQuerySchema)
  .handler(async ({ data }) =>
    listJobBoard(await database(), (await requireAccount("developer")).id, data),
  );

const applicationId = z.string().min(1).max(200);

/** Stands for `GET /me/applications`: a page of the developer's applications, after `after`. */
export const fetchMyApplications = createServerFn({ method: "GET" })
  .validator(z.object({ after: applicationId.optional() }))
  .handler(async ({ data }) =>
    listMyApplications(await database(), (await requireAccount("developer")).id, data.after),
  );

/**
 * Stands for `POST /me/applications/:id/withdraw`. Expected refusals come back as a code (see
 * withdrawApplication).
 */
export const withdrawApplicationFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: applicationId }))
  .handler(async ({ data }) =>
    withdrawApplication(
      await database(),
      (await requireAccount("developer")).id,
      data.id,
      getRequestUrl().origin,
    ),
  );

export const myApplicationsQueryKey = ["my-applications"];

/** Every query on the job board starts with this key, to refresh them all after a change. */
export const jobBoardQueryKey = ["job-board"];

/** The job board's pages for one search, loaded one after the other. */
export const jobBoardQuery = (
  accountId: string,
  search: Required<Pick<JobBoardQuery, "search" | "modes" | "sort">>,
) =>
  infiniteQueryOptions({
    queryKey: [...jobBoardQueryKey, accountId, search],
    queryFn: ({ pageParam }) =>
      fetchJobBoard({ data: { ...search, ...(pageParam ? { after: pageParam } : {}) } }),
    initialPageParam: "",
    getNextPageParam: (page) => page.next ?? undefined,
  });

export const openJobsQuery = (accountId: string, companyId: string) =>
  queryOptions({
    queryKey: ["open-jobs", accountId, companyId],
    queryFn: () => fetchOpenJobs({ data: companyId }),
  });
