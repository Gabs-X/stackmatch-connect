import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { adminEmails, isAdmin } from "./admin";

const user = (email: string, emailVerified = true): AuthUser => ({
  id: "u1",
  name: "Equipe",
  email,
  accountType: "company",
  company: "StackMatch",
  cnpj: "",
  jobTitle: "",
  emailVerified,
});

afterEach(() => vi.unstubAllEnvs());

describe("isAdmin", () => {
  it("accepts only confirmed accounts listed in ADMIN_EMAILS, ignoring case and spaces", () => {
    vi.stubEnv("ADMIN_EMAILS", " Equipe@StackMatch.dev , outra@stackmatch.dev,");
    expect(adminEmails()).toEqual(["equipe@stackmatch.dev", "outra@stackmatch.dev"]);
    expect(isAdmin(user("equipe@stackmatch.dev"))).toBe(true);
    expect(isAdmin(user("EQUIPE@stackmatch.dev"))).toBe(true);
    expect(isAdmin(user("equipe@stackmatch.dev", false))).toBe(false);
    expect(isAdmin(user("intrusa@stackmatch.dev"))).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("has no admins without the variable", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(isAdmin(user("equipe@stackmatch.dev"))).toBe(false);
  });
});
