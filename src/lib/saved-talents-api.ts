import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { advanceCandidate } from "@/server/jobs";
import { listSavedTalents, removeSavedTalent, saveTalent } from "@/server/saved-talents";
import { database, requireAccount } from "@/server/session";

const developerId = z.string().min(1).max(200);

/** Stands for `GET /me/saved`: the signed-in company's shortlist. */
export const fetchSavedTalents = createServerFn({ method: "GET" }).handler(async () =>
  listSavedTalents(await database(), (await requireAccount("company")).id),
);

/** Stands for `POST /me/saved`. From inside a job, also adds the developer to it as saved. */
export const saveTalentFn = createServerFn({ method: "POST" })
  .validator(z.object({ developerId, jobId: z.string().min(1).max(200).optional() }))
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    const db = await database();
    if (!(await saveTalent(db, company.id, data.developerId)))
      throw new Error("Unknown developer profile.");
    if (data.jobId) await advanceCandidate(db, company.id, data.jobId, data.developerId, "saved");
  });

/** Stands for `DELETE /me/saved/:id`. */
export const removeSavedTalentFn = createServerFn({ method: "POST" })
  .validator(developerId)
  .handler(async ({ data }) => {
    const company = await requireAccount("company");
    await removeSavedTalent(await database(), company.id, data);
  });
