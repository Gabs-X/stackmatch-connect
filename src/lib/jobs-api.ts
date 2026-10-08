import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createJob,
  deleteJob,
  listCandidates,
  listJobs,
  loadJob,
  moveCandidate,
  removeCandidate,
  setJobStatus,
  updateJob,
} from "@/server/jobs";
import { database, requireAccount } from "@/server/session";
import { jobInputSchema, jobStages } from "./jobs";

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
  .handler(async ({ data }) =>
    createJob(await database(), (await requireAccount("company")).id, data),
  );

/** Stands for `PUT /jobs/:id`; null when the company has no such job. */
export const updateJobFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: jobId, job: jobInputSchema }))
  .handler(async ({ data }) =>
    updateJob(await database(), (await requireAccount("company")).id, data.id, data.job),
  );

/** Stands for `POST /jobs/:id/close` and `/reopen`. */
export const setJobStatusFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: jobId, status: z.enum(["open", "closed"]) }))
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    if (!(await setJobStatus(await database(), company.id, data.id, data.status)))
      throw new Error("Unknown job.");
  });

/** Stands for `DELETE /jobs/:id`. */
export const deleteJobFn = createServerFn({ method: "POST" })
  .validator(jobId)
  .handler(async ({ data }) =>
    deleteJob(await database(), (await requireAccount("company")).id, data),
  );

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
      !(await moveCandidate(await database(), company.id, data.jobId, data.developerId, data.stage))
    )
      throw new Error("Unknown candidate.");
  });

/** Stands for `DELETE /jobs/:id/candidates/:developerId`. */
export const removeCandidateFn = createServerFn({ method: "POST" })
  .validator(z.object({ jobId, developerId }))
  .handler(async ({ data }) =>
    removeCandidate(
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
