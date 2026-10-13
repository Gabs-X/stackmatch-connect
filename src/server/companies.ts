import { eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";
import {
  defaultCompanySettings,
  type CompanyProfile,
  type CompanySettings,
} from "@/lib/company-settings";
import type { Db } from "./db";
import type { Tx } from "./profiles";
import { companyProfiles } from "./db/schema";
import { loadTranslations } from "./translations";

export async function savedSettings(db: Db | Tx, userId: string): Promise<CompanySettings | null> {
  const [row] = await db
    .select()
    .from(companyProfiles)
    .where(eq(companyProfiles.userId, userId))
    .limit(1);
  if (!row) return null;
  const { website, location, about, contactName, contactRole, contactEmail, phone } = row;
  return { website, location, about, contactName, contactRole, contactEmail, phone };
}

/** What the company saved, or its sign-up details until it saves anything. */
export async function loadCompanySettings(db: Db | Tx, user: AuthUser): Promise<CompanySettings> {
  return (await savedSettings(db, user.id)) ?? defaultCompanySettings(user);
}

/** Expects validated settings. */
export async function saveCompanySettings(db: Db, userId: string, settings: CompanySettings) {
  const fields = { ...settings, updatedAt: new Date() };
  await db
    .insert(companyProfiles)
    .values({ userId, ...fields })
    .onConflictDoUpdate({ target: companyProfiles.userId, set: fields });
}

/** The free text of a company's details, the part that gets machine-translated. */
export const companyTexts = (settings: Pick<CompanySettings, "about" | "contactRole">) => [
  settings.about,
  settings.contactRole,
];

/**
 * What developers see about a company, besides the contact it signed with. Null while the company
 * never saved its details.
 */
export async function loadCompanyProfile(
  db: Db,
  companyId: string,
): Promise<CompanyProfile | null> {
  const settings = await savedSettings(db, companyId);
  if (!settings) return null;
  const { about, website, location, contactRole, phone } = settings;
  const translations = await loadTranslations(db, [companyId], companyTexts(settings));
  return {
    about,
    website,
    location,
    contactRole,
    phone,
    ...(Object.keys(translations).length ? { translations } : {}),
  };
}
