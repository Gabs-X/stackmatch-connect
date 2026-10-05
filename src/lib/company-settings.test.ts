import { describe, expect, it } from "vitest";
import type { AuthUser } from "./auth";
import { companySettingsSchema, defaultCompanySettings } from "./company-settings";

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
    expect(defaultCompanySettings(acme)).toEqual({
      website: "",
      location: "",
      about: "",
      contactName: "Bruno Lima",
      contactRole: "Tech Lead",
      contactEmail: "bruno@acme.com",
      phone: "",
    });
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
