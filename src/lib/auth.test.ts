import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatCnpj,
  isValidCnpj,
  demoPassword,
  homeFor,
  safeRedirect,
  signInSchema,
  signUpSchema,
  type SignUpInput,
} from "./auth";

const developer: SignUpInput = {
  accountType: "developer",
  name: "Ana Souza",
  company: "",
  cnpj: "",
  jobTitle: "Frontend Developer",
  email: "Ana@Example.com ",
  password: "segredo123",
  acceptTerms: true,
};

describe("signUpSchema", () => {
  const issues = (input: Partial<SignUpInput>) =>
    signUpSchema.safeParse({ ...developer, ...input }).error?.issues.map((issue) => issue.message);

  it("accepts a complete developer sign-up", () => {
    expect(signUpSchema.safeParse(developer).success).toBe(true);
  });

  it("requires a professional title for developers and a company for hiring accounts", () => {
    expect(issues({ jobTitle: " " })).toEqual(["jobTitle"]);
    expect(issues({ accountType: "company", jobTitle: "", company: "" })).toEqual([
      "company",
      "cnpj",
    ]);
    expect(
      issues({ accountType: "company", jobTitle: "", company: "Acme", cnpj: "11.222.333/0001-81" }),
    ).toBeUndefined();
    expect(issues({ accountType: "company", company: "Acme", cnpj: "11.222.333/0001-82" })).toEqual(
      ["cnpj"],
    );
  });

  it("enforces password length and a mix of letters and numbers", () => {
    expect(issues({ password: "abc12" })).toContain("passwordLength");
    expect(issues({ password: "somenteletras" })).toEqual(["passwordMix"]);
    expect(issues({ password: "12345678" })).toEqual(["passwordMix"]);
  });

  it("requires a valid e-mail and accepted terms", () => {
    expect(issues({ email: "ana@" })).toEqual(["email"]);
    expect(issues({ acceptTerms: false })).toEqual(["terms"]);
  });
});

describe("demo accounts", () => {
  it("use a password the sign-up rules would accept", () => {
    expect(signUpSchema.safeParse({ ...developer, password: demoPassword }).success).toBe(true);
  });
});

describe("signInSchema", () => {
  it("requires both fields", () => {
    const result = signInSchema.safeParse({ email: "", password: "" });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["required", "required"]);
  });
});

describe("redirects", () => {
  it("only follows same-site paths", () => {
    expect(safeRedirect("/saved", "/")).toBe("/saved");
    expect(safeRedirect("//evil.example", "/")).toBe("/");
    expect(safeRedirect("https://evil.example", "/")).toBe("/");
    expect(safeRedirect(undefined, "/discover")).toBe("/discover");
  });

  it("sends each account type to its own starting page", () => {
    const base = { id: "1", name: "A", email: "a@a.com", company: "", cnpj: "", jobTitle: "" };
    expect(homeFor({ ...base, accountType: "developer" })).toBe("/create-profile");
    expect(homeFor({ ...base, accountType: "company" })).toBe("/discover");
  });
});

describe("CNPJ", () => {
  it("accepts numbers with valid check digits, formatted or not", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("rejects wrong check digits, wrong lengths and repeated digits", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });

  it("formats as the digits are typed", () => {
    expect(formatCnpj("11222")).toBe("11.222");
    expect(formatCnpj("112223330001")).toBe("11.222.333/0001");
    expect(formatCnpj("11a222333000181999")).toBe("11.222.333/0001-81");
  });
});

describe("with VITE_DEMO_ACCOUNTS=false", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("removes the test accounts", async () => {
    vi.stubEnv("VITE_DEMO_ACCOUNTS", "false");
    vi.resetModules();
    const auth = await import("./auth");
    expect(auth.demoAccounts).toEqual([]);
  });
});
