import { useQuery } from "@tanstack/react-query";
import { companySettingsKey, fetchCompanySettings } from "./api";
import { useAuth } from "./auth-context";
import {
  defaultCompanySettings,
  readCompanySettings,
  type CompanySettings,
} from "./company-settings";

/**
 * Settings of the signed-in company account (null for anyone else): the company and contact that
 * sign proposals and interest marks.
 */
export function useCompanySettings(): CompanySettings | null {
  const { user } = useAuth();
  const company = user?.accountType === "company" ? user : null;
  const { data } = useQuery({
    queryKey: companySettingsKey(company?.id ?? ""),
    queryFn: () => (company ? fetchCompanySettings(company) : Promise.resolve(null)),
    enabled: company !== null,
    staleTime: Infinity,
    // Mock only: the settings are already in this browser, so show them without a loading state.
    // Remove once they come from the API.
    ...(company ? { initialData: () => readCompanySettings(company) } : {}),
  });
  return company ? (data ?? defaultCompanySettings(company)) : null;
}
