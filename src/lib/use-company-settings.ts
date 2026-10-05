import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import { companySettingsQuery } from "./company-api";
import { defaultCompanySettings, type CompanySettings } from "./company-settings";

/** The signed-in company account's settings query; disabled for anyone else. */
export function useCompanySettingsQuery() {
  const { user } = useAuth();
  const company = user?.accountType === "company" ? user : null;
  return {
    company,
    ...useQuery({ ...companySettingsQuery(company?.id ?? ""), enabled: !!company }),
  };
}

/**
 * Settings of the signed-in company account (null for anyone else): the company and contact that
 * sign proposals and interest marks. Until the server answers, the sign-up details stand in.
 */
export function useCompanySettings(): CompanySettings | null {
  const { company, data } = useCompanySettingsQuery();
  return company ? (data ?? defaultCompanySettings(company)) : null;
}
