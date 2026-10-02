import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthError,
  formatCnpj,
  isValidCnpj,
  demoAccounts,
  demoPassword,
  hashPassword,
  homeFor,
  loadSession,
  safeRedirect,
  saveSession,
  signIn,
  signInSchema,
  signUp,
  signUpSchema,
  type SignUpInput,
} from "./auth";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Runs a mock API call to completion, skipping its simulated latency. */
const settle = async <T>(promise: Promise<T>) => {
  // Mark a rejection as handled now; the caller still receives it from the returned promise.
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  return promise;
};

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

describe("signInSchema", () => {
  it("requires both fields", () => {
    const result = signInSchema.safeParse({ email: "", password: "" });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(["required", "required"]);
  });
});

describe("signUp and signIn", () => {
  it("creates the account, normalizing the e-mail, and never stores the password", async () => {
    const session = await settle(signUp(developer));
    expect(session.user).toMatchObject({
      name: "Ana Souza",
      email: "ana@example.com",
      accountType: "developer",
      company: "",
      jobTitle: "Frontend Developer",
    });
    expect(session.token).toBeTruthy();
    expect(storage.get("stackmatch-users")).not.toContain("segredo123");
  });

  it("rejects a second account with the same e-mail in any case", async () => {
    await settle(signUp(developer));
    await expect(settle(signUp({ ...developer, email: "ANA@example.com" }))).rejects.toEqual(
      new AuthError("email-taken"),
    );
  });

  it("signs in with the right password and rejects wrong passwords and unknown e-mails alike", async () => {
    await settle(signUp(developer));
    const session = await settle(signIn({ email: " ana@EXAMPLE.com", password: "segredo123" }));
    expect(session.user.email).toBe("ana@example.com");

    await expect(
      settle(signIn({ email: "ana@example.com", password: "errada123" })),
    ).rejects.toEqual(new AuthError("invalid-credentials"));
    await expect(
      settle(signIn({ email: "outra@example.com", password: "segredo123" })),
    ).rejects.toEqual(new AuthError("invalid-credentials"));
  });

  it("keeps a company account's company name", async () => {
    const session = await settle(
      signUp({
        ...developer,
        accountType: "company",
        company: " Acme ",
        cnpj: "11.222.333/0001-81",
        jobTitle: "",
      }),
    );
    expect(session.user).toMatchObject({ company: "Acme", cnpj: "11222333000181" });
  });
});

describe("demo accounts", () => {
  it("sign in by username or e-mail with the shared password", async () => {
    const dev = await settle(signIn({ email: "teste.dev", password: demoPassword }));
    expect(dev.user).toMatchObject({ id: "demo-developer", accountType: "developer" });
    expect(dev.user).not.toHaveProperty("username");

    const company = await settle(
      signIn({ email: " TESTE.EMP@stackmatch.app", password: demoPassword }),
    );
    expect(company.user).toMatchObject({ accountType: "company", company: "Empresa Teste" });

    await expect(settle(signIn({ email: "teste.dev", password: "1234" }))).rejects.toEqual(
      new AuthError("invalid-credentials"),
    );
  });

  it("use a password the sign-up rules would accept, and their e-mails can't be taken", async () => {
    expect(signUpSchema.safeParse({ ...developer, password: demoPassword }).success).toBe(true);
    await expect(
      settle(signUp({ ...developer, email: demoAccounts[0]?.email ?? "" })),
    ).rejects.toEqual(new AuthError("email-taken"));
  });
});

describe("hashPassword", () => {
  it("is stable for the same e-mail and differs between e-mails", async () => {
    expect(await hashPassword("ana@example.com", "x")).toBe(
      await hashPassword(" ANA@example.com", "x"),
    );
    expect(await hashPassword("ana@example.com", "x")).not.toBe(
      await hashPassword("bia@example.com", "x"),
    );
  });
});

describe("session storage", () => {
  it("reads back a saved session and clears it on sign-out", async () => {
    const session = await settle(signUp(developer));
    saveSession(session);
    expect(loadSession()).toEqual(session);
    saveSession(null);
    expect(loadSession()).toBeNull();
  });

  it("ignores malformed sessions", () => {
    storage.set("stackmatch-session", JSON.stringify({ token: "x" }));
    expect(loadSession()).toBeNull();
    storage.set("stackmatch-session", "{not json");
    expect(loadSession()).toBeNull();
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
