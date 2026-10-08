import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/local-profile";
import { recordAssistantRequest } from "./assistant-throttle";
import { createAccount, createSession, sessionDurationMs } from "./auth";
import { cleanup } from "./cleanup";
import type { Db } from "./db";
import { emailCodes, interestEvents, loginFailures, sessions, skills } from "./db/schema";
import { issueCode } from "./email-codes";
import { recordEmailSend } from "./email-throttle";
import { recordLoginFailure } from "./login-throttle";
import { saveProfile } from "./profiles";
import { createDeveloper, createTestDb } from "./test-db";
import { recordTranslationRequest } from "./translation-throttle";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

const day = 86_400_000;

describe("cleanup", () => {
  it("deletes only what expired or nobody uses", async () => {
    const now = Date.now();
    const ana = await createAccount(db, {
      accountType: "company",
      name: "Ana",
      company: "Acme",
      cnpj: "11222333000181",
      jobTitle: "",
      email: "ana@acme.com",
      password: "segredo123",
      acceptTerms: true,
    });
    if (!ana) throw new Error("account not created");
    const marina = await createDeveloper(db, "marina@example.com", "Marina Costa");

    // A session that expired and one still valid.
    await createSession(db, ana.id, now - sessionDurationMs - day);
    await createSession(db, ana.id, now);
    // An expired code and a fresh one.
    await issueCode(db, ana.id, "VERIFY_EMAIL", now - day);
    await issueCode(db, ana.id, "RESET_PASSWORD", now);
    // A sign-in failure long gone and a recent one.
    await recordLoginFailure(db, "ana@acme.com", null, now - day);
    await recordLoginFailure(db, "bia@acme.com", null, now);
    // An e-mail send from two hours ago and one from now.
    await recordEmailSend(db, "203.0.113.7", now - 2 * 3_600_000);
    await recordEmailSend(db, "198.51.100.1", now);
    // An assistant question from two hours ago and one from now.
    await recordAssistantRequest(db, "203.0.113.7", now - 2 * 3_600_000);
    await recordAssistantRequest(db, "198.51.100.1", now);
    // A translation from two days ago and one from now.
    await recordTranslationRequest(db, marina, now - 2 * day);
    await recordTranslationRequest(db, ana.id, now);
    // An interest mark older than the 30-day limits and a recent one.
    await db.insert(interestEvents).values([
      {
        companyId: ana.id,
        developerId: marina,
        notified: true,
        createdAt: new Date(now - 40 * day),
      },
      { companyId: ana.id, developerId: marina, notified: true, createdAt: new Date(now - day) },
    ]);
    // A typed skill that a profile dropped; another still in use; catalog skills stay.
    const profile = {
      ...emptyProfile,
      name: "Marina Costa",
      role: "Dev",
      location: "Recife, PE",
      seniority: "Pleno",
      workMode: "Remoto",
      availability: "Disponível agora",
      bio: "Bio.",
    };
    await saveProfile(db, marina, { ...profile, skills: ["Zig", "Typo"] });
    await saveProfile(db, marina, { ...profile, skills: ["Zig"] });
    const catalogSize = (await db.select().from(skills)).length - 2;

    expect(await cleanup(db, now)).toEqual({
      sessions: 1,
      emailCodes: 1,
      loginFailures: 1,
      emailSends: 1,
      assistantRequests: 1,
      translationRequests: 1,
      interestEvents: 1,
      unusedSkills: 1,
    });
    expect(await db.select().from(sessions)).toHaveLength(1);
    expect((await db.select().from(emailCodes)).map((code) => code.purpose)).toEqual([
      "RESET_PASSWORD",
    ]);
    expect((await db.select().from(loginFailures)).map((row) => row.key)).toEqual([
      "email:bia@acme.com",
    ]);
    expect(await db.select().from(interestEvents)).toHaveLength(1);
    const names = (await db.select().from(skills)).map((skill) => skill.name);
    expect(names).toContain("Zig");
    expect(names).not.toContain("Typo");
    expect(names).toHaveLength(catalogSize + 1);

    // Nothing left to delete.
    expect(Object.values(await cleanup(db, now)).every((count) => count === 0)).toBe(true);
  });
});
