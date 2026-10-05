import { z } from "zod";
import type { AuthUser } from "./auth";
import { profileLink } from "./local-profile";

/**
 * What a hiring account can edit about how it shows up to developers: the company details and the
 * person they talk to. Proposals and interest marks are signed with it, and developers reply to
 * `contactEmail`. The company name, CNPJ and login e-mail belong to the account and only show here.
 */
export const companySettingsSchema = z.object({
  website: z
    .string()
    .trim()
    .refine((value) => !value || profileLink(value) !== undefined, "url"),
  location: z.string().trim(),
  about: z.string().trim().max(600, "aboutLength"),
  contactName: z.string().trim().min(2, "name"),
  contactRole: z.string().trim(),
  // Check the format only once something was typed, so an empty field reports just "required".
  contactEmail: z.string().trim().min(1, "required").pipe(z.string().email("email")),
  phone: z
    .string()
    .trim()
    .refine((value) => !value || /^\+?[\d\s().-]{8,20}$/.test(value), "phone"),
});

export type CompanySettings = z.output<typeof companySettingsSchema>;
export type CompanySettingsInput = z.input<typeof companySettingsSchema>;

/** What a developer sees about a company that reached them, besides the contact it signed with. */
export type CompanyProfile = Pick<
  CompanySettings,
  "about" | "website" | "location" | "contactRole" | "phone"
> & {
  /** Fictional company: its website is an example address. */
  demo: boolean;
};

export const companySettingsStorageKey = "stackmatch-company-settings";

/** Until the company edits them, settings come from what it filled in at sign-up. */
export function defaultCompanySettings(user: AuthUser): CompanySettings {
  return {
    website: "",
    location: "",
    about: "",
    contactName: user.name,
    contactRole: user.jobTitle,
    contactEmail: user.email,
    phone: "",
  };
}

function readAll(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(companySettingsStorageKey) ?? "{}",
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Settings a company account saved in this browser, or null while it never saved any. */
export function readSavedCompanySettings(accountId: string): CompanySettings | null {
  const result = companySettingsSchema.safeParse(readAll()[accountId]);
  return result.success ? result.data : null;
}

/** Mock storage behind the settings API: one entry per company account, in this browser. */
export function readCompanySettings(user: AuthUser): CompanySettings {
  return readSavedCompanySettings(user.id) ?? defaultCompanySettings(user);
}

export function writeCompanySettings(accountId: string, settings: CompanySettings) {
  window.localStorage.setItem(
    companySettingsStorageKey,
    JSON.stringify({ ...readAll(), [accountId]: settings }),
  );
}
