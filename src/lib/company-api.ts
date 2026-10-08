import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadCompanyProfile, loadCompanySettings, saveCompanySettings } from "@/server/companies";
import { translateCompanyTexts } from "@/server/jobs";
import { companyReachedDeveloper } from "@/server/meetings";
import { database, requireAccount } from "@/server/session";
import { companySettingsSchema, type CompanySettingsInput } from "./company-settings";

/** Stands for `GET /company/settings`: what the signed-in company shows developers. */
export const fetchMyCompanySettings = createServerFn({ method: "GET" }).handler(async () =>
  loadCompanySettings(await database(), await requireAccount("company")),
);

/** Stands for `PUT /company/settings`. */
export const saveMyCompanySettings = createServerFn({ method: "POST" })
  .validator((input: CompanySettingsInput) => companySettingsSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireAccount("company");
    const db = await database();
    await saveCompanySettings(db, user.id, data);
    await translateCompanyTexts(db, user.id, data);
    return data;
  });

/**
 * Stands for `GET /companies/:id`. Developers only see companies that reached them, by an interest
 * mark or a proposal.
 */
export const fetchCompanyProfile = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data }) => {
    const developer = await requireAccount("developer");
    const db = await database();
    if (!(await companyReachedDeveloper(db, data, developer.id))) return null;
    return loadCompanyProfile(db, data);
  });

export const companySettingsKey = (accountId: string) => ["company-settings", accountId] as const;

export const companySettingsQuery = (accountId: string) =>
  queryOptions({
    queryKey: companySettingsKey(accountId),
    queryFn: () => fetchMyCompanySettings(),
    // Only this account edits them, and saving updates the cache.
    staleTime: Infinity,
  });

export const companyProfileQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["company-profile", companyId],
    queryFn: () => fetchCompanyProfile({ data: companyId }),
  });
