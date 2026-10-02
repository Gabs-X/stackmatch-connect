import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "./auth";
import {
  companySettingsSchema,
  companySettingsStorageKey,
  defaultCompanySettings,
  readCompanySettings,
  writeCompanySettings,
} from "./company-settings";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const acme: AuthUser = {
  id: "acme-account",
  name: "Bruno Lima",
  email: "bruno@acme.com",
  accountType: "company",
  company: "Acme",
  cnpj: "11222333000181",
  jobTitle: "Tech Lead",
};

describe("company settings", () => {
  it("start from the sign-up details", () => {
    expect(readCompanySettings(acme)).toEqual({
      website: "",
      location: "",
      about: "",
      contactName: "Bruno Lima",
      contactRole: "Tech Lead",
      contactEmail: "bruno@acme.com",
      phone: "",
    });
  });

  it("keep each account's saved settings apart and ignore broken entries", () => {
    const settings = { ...defaultCompanySettings(acme), contactName: "Carla Dias" };
    writeCompanySettings(acme.id, settings);
    expect(readCompanySettings(acme)).toEqual(settings);
    expect(readCompanySettings({ ...acme, id: "other" }).contactName).toBe("Bruno Lima");

    storage.set(companySettingsStorageKey, JSON.stringify({ [acme.id]: { contactName: 1 } }));
    expect(readCompanySettings(acme)).toEqual(defaultCompanySettings(acme));
  });

  it("validate the contact and the optional fields only when filled in", () => {
    const issues = (input: object) =>
      companySettingsSchema
        .safeParse({ ...defaultCompanySettings(acme), ...input })
        .error?.issues.map((issue) => issue.message);

    expect(issues({})).toBeUndefined();
    expect(issues({ contactName: " ", contactEmail: "" })).toEqual(["name", "required"]);
    expect(issues({ contactEmail: "bruno@" })).toEqual(["email"]);
    expect(issues({ website: "not a site ::", phone: "12" })).toEqual(["url", "phone"]);
    expect(issues({ website: "acme.com", phone: "(11) 99999-9999" })).toBeUndefined();
    expect(issues({ about: "x".repeat(601) })).toEqual(["aboutLength"]);
  });
});
