import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { emptyProfile } from "@/lib/local-profile";
import {
  changePassword,
  confirmEmailChange,
  deleteAccount,
  requestEmailChange,
} from "./account-settings";
import { authenticate, createAccount, createSession, userForSession } from "./auth";
import type { Db } from "./db";
import { users } from "./db/schema";
import { outbox } from "./email";
import { loginLockedFor } from "./login-throttle";
import { loadProfile, saveProfile } from "./profiles";
import { localImagePath, readLocalImage } from "./storage";
import { createTestDb } from "./test-db";

let db: Db;
let ana: AuthUser;

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  const user = await createAccount(db, {
    accountType: "developer",
    name: "Ana Souza",
    company: "",
    cnpj: "",
    jobTitle: "Frontend Developer",
    email: "ana@example.com",
    password: "segredo123",
    acceptTerms: true,
  });
  if (!user) throw new Error("account not created");
  ana = user;
});

/** The code in the last e-mail sent to the address. */
const lastCode = (to: string) =>
  outbox()
    .filter((email) => email.to === to)
    .at(-1)
    ?.text.match(/\b\d{6}\b/)?.[0] ?? "";

describe("changePassword", () => {
  it("needs the current password, and wrong ones count against the sign-in limit", async () => {
    for (let attempt = 0; attempt < 5; attempt++)
      expect(
        await changePassword(db, ana, { currentPassword: "errada1", password: "novasenha1" }, ""),
      ).toEqual({ error: "wrong-password" });
    expect(await loginLockedFor(db, "ana@example.com", null)).toBeGreaterThan(0);
    expect(
      await changePassword(db, ana, { currentPassword: "segredo123", password: "novasenha1" }, ""),
    ).toMatchObject({ error: "login-locked" });
  });

  it("sets the new password and signs out every other session", async () => {
    const current = await createSession(db, ana.id);
    const other = await createSession(db, ana.id);
    expect(
      await changePassword(
        db,
        ana,
        { currentPassword: "segredo123", password: "novasenha1" },
        current,
      ),
    ).toEqual({ ok: true });
    expect(await authenticate(db, "ana@example.com", "novasenha1")).not.toBeNull();
    expect(await userForSession(db, current)).not.toBeNull();
    expect(await userForSession(db, other)).toBeNull();
  });
});

describe("changing the e-mail", () => {
  it("sends a code to the new address, then switches to it and tells the old one", async () => {
    expect(
      await requestEmailChange(
        db,
        ana,
        { email: " Ana.Nova@Example.com ", password: "segredo123" },
        "pt",
      ),
    ).toEqual({ sent: true });
    const code = lastCode("ana.nova@example.com");
    expect(code).toMatch(/^\d{6}$/);

    const result = await confirmEmailChange(db, ana, code, "pt");
    expect(result).toMatchObject({ user: { email: "ana.nova@example.com", emailVerified: true } });
    expect(await authenticate(db, "ana.nova@example.com", "segredo123")).not.toBeNull();
    expect(await authenticate(db, "ana@example.com", "segredo123")).toBeNull();
    expect(outbox().at(-1)).toMatchObject({
      to: "ana@example.com",
      subject: "O e-mail da sua conta no StackMatch foi alterado",
    });
  });

  it("refuses the same address, a taken one and a wrong password", async () => {
    await createAccount(db, {
      accountType: "developer",
      name: "Bia",
      company: "",
      cnpj: "",
      jobTitle: "Dev",
      email: "bia@example.com",
      password: "segredo123",
      acceptTerms: true,
    });
    const ask = (email: string, password = "segredo123") =>
      requestEmailChange(db, ana, { email, password }, "pt");
    expect(await ask("ANA@example.com")).toEqual({ error: "same-email" });
    expect(await ask("bia@example.com")).toEqual({ error: "email-taken" });
    expect(await ask("nova@example.com", "errada1")).toEqual({ error: "wrong-password" });
    expect(outbox()).toHaveLength(0);
  });

  it("fails when the address was taken after the code was sent, or the code is wrong", async () => {
    await requestEmailChange(db, ana, { email: "nova@example.com", password: "segredo123" }, "pt");
    const code = lastCode("nova@example.com");
    expect(
      await confirmEmailChange(db, ana, code === "000000" ? "111111" : "000000", "pt"),
    ).toEqual({
      error: "invalid-code",
    });
    await createAccount(db, {
      accountType: "developer",
      name: "Nova",
      company: "",
      cnpj: "",
      jobTitle: "Dev",
      email: "nova@example.com",
      password: "segredo123",
      acceptTerms: true,
    });
    expect(await confirmEmailChange(db, ana, code, "pt")).toEqual({ error: "email-taken" });
  });
});

describe("deleteAccount", () => {
  it("needs the password", async () => {
    expect(await deleteAccount(db, ana, "errada1")).toEqual({ error: "wrong-password" });
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("deletes the account, its profile and its images", async () => {
    await saveProfile(db, ana.id, {
      ...emptyProfile,
      name: "Ana Souza",
      role: "Dev",
      location: "Recife, PE",
      seniority: "Pleno",
      workMode: "Remoto",
      availability: "Disponível agora",
      bio: "Bio.",
      photo: `data:image/jpeg;base64,${Buffer.from("foto").toString("base64")}`,
    });
    const photo = (await loadProfile(db, ana.id))?.photo ?? "";
    const token = await createSession(db, ana.id);

    expect(await deleteAccount(db, ana, "segredo123")).toEqual({ ok: true });
    expect(await db.select().from(users)).toHaveLength(0);
    expect(await loadProfile(db, ana.id)).toBeNull();
    expect(await userForSession(db, token)).toBeNull();
    expect(await readLocalImage(photo.slice(localImagePath.length))).toBeNull();
  });
});
