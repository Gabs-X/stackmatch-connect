import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfile } from "@/lib/local-profile";
import { loadCompanyProfile, saveCompanySettings } from "./companies";
import type { Db } from "./db";
import { textTranslations, users } from "./db/schema";
import { loadPublishedProfile, profileTexts, saveProfile } from "./profiles";
import { createAccount } from "./auth";
import { createDeveloper, createTestDb } from "./test-db";
import {
  loadTranslations,
  requestTranslations,
  updateTranslations,
  type Translate,
} from "./translations";

let db: Db;
let ana: string;
const client = {} as Anthropic;

/** A stand-in for the model: English gets a "(pt)" marker in Portuguese, and the reverse. */
const fakeTranslate = vi.fn<Translate>(async (_client, texts) =>
  texts.map((text) =>
    /[ãçéêíõ]|Desenvolvo/.test(text)
      ? { pt: text, en: `EN: ${text}` }
      : { pt: `PT: ${text}`, en: text },
  ),
);

beforeEach(async () => {
  db = await createTestDb();
  ana = await createDeveloper(db, "ana@example.com");
  fakeTranslate.mockClear();
});

describe("updateTranslations", () => {
  it("stores both languages and translates only what's missing", async () => {
    await updateTranslations(db, ana, ["Desenvolvo interfaces.", "Frontend Developer", ""], {
      client,
      translate: fakeTranslate,
    });
    expect(fakeTranslate).toHaveBeenCalledWith(
      client,
      ["Desenvolvo interfaces.", "Frontend Developer"],
      expect.anything(),
    );
    expect(
      await loadTranslations(db, [ana], ["Desenvolvo interfaces.", "Frontend Developer"]),
    ).toEqual({
      "Desenvolvo interfaces.": { pt: "Desenvolvo interfaces.", en: "EN: Desenvolvo interfaces." },
      "Frontend Developer": { pt: "PT: Frontend Developer", en: "Frontend Developer" },
    });

    // Saving again with one new text only translates that one.
    await updateTranslations(db, ana, ["Desenvolvo interfaces.", "Novo cargo em ação"], {
      client,
      translate: fakeTranslate,
    });
    expect(fakeTranslate).toHaveBeenLastCalledWith(
      client,
      ["Novo cargo em ação"],
      expect.anything(),
    );
  });

  it("drops translations of texts the account no longer has", async () => {
    await updateTranslations(db, ana, ["Texto antigo em ação", "Texto mantido em ação"], {
      client,
      translate: fakeTranslate,
    });
    await updateTranslations(db, ana, ["Texto mantido em ação"], {
      client,
      translate: fakeTranslate,
    });
    const rows = await db.select().from(textTranslations);
    expect(rows).toHaveLength(2);
    expect(await loadTranslations(db, [ana], ["Texto antigo em ação"])).toEqual({});
  });

  it("only prunes without a client, and never throws", async () => {
    await updateTranslations(db, ana, ["Texto em ação"], { client, translate: fakeTranslate });
    await updateTranslations(db, ana, ["Texto em ação"], {
      client: null,
      translate: fakeTranslate,
    });
    expect(fakeTranslate).toHaveBeenCalledTimes(1);
    expect(await db.select().from(textTranslations)).toHaveLength(2);

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      updateTranslations(db, ana, ["Outro texto em ação"], {
        client,
        translate: async () => {
          throw new Error("API down");
        },
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("skips texts the model left out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await updateTranslations(db, ana, ["Um em ação", "Dois em ação"], {
      client,
      translate: async () => [
        { pt: "Um em ação", en: "One" },
        { pt: "", en: "" },
      ],
    });
    expect(Object.keys(await loadTranslations(db, [ana], ["Um em ação", "Dois em ação"]))).toEqual([
      "Um em ação",
    ]);
    await updateTranslations(db, ana, ["Três em ação"], { client, translate: async () => null });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("goes away with the account", async () => {
    await updateTranslations(db, ana, ["Texto em ação"], { client, translate: fakeTranslate });
    await db.delete(users).where(eq(users.id, ana));
    expect(await db.select().from(textTranslations)).toHaveLength(0);
  });
});

describe("profiles with translations", () => {
  it("come with the translations of their role, bio and projects", async () => {
    const profile = {
      ...emptyProfile,
      name: "Ana Souza",
      role: "Frontend Developer",
      location: "Recife, PE",
      seniority: "Pleno",
      workMode: "Remoto",
      availability: "Disponível agora",
      bio: "Desenvolvo interfaces acessíveis.",
      skills: ["React"],
      projects: [
        {
          id: "p1",
          name: "Atlas",
          description: "Painel de vendas com automações.",
          tech: ["React"],
          image: "",
          github: "",
          demo: "",
        },
      ],
    };
    await saveProfile(db, ana, profile);
    await updateTranslations(db, ana, profileTexts(profile), { client, translate: fakeTranslate });

    const developer = await loadPublishedProfile(db, ana);
    expect(developer?.translations).toEqual({
      "Frontend Developer": { pt: "PT: Frontend Developer", en: "Frontend Developer" },
      "Desenvolvo interfaces acessíveis.": {
        pt: "Desenvolvo interfaces acessíveis.",
        en: "EN: Desenvolvo interfaces acessíveis.",
      },
      "Painel de vendas com automações.": {
        pt: "Painel de vendas com automações.",
        en: "EN: Painel de vendas com automações.",
      },
    });
  });

  it("leave out the field when nothing was translated", async () => {
    expect((await loadPublishedProfile(db, ana))?.translations).toBeUndefined();
  });

  it("include a company's description and contact role", async () => {
    const company = await createAccount(db, {
      accountType: "company",
      name: "Bia",
      company: "Acme",
      cnpj: "11222333000181",
      jobTitle: "",
      email: "bia@acme.com",
      password: "segredo123",
      acceptTerms: true,
    });
    if (!company) throw new Error("account not created");
    const settings = {
      website: "",
      location: "",
      about: "Fazemos software de logística.",
      contactName: "Bia",
      contactRole: "Tech Recruiter",
      contactEmail: "bia@acme.com",
      phone: "",
    };
    await saveCompanySettings(db, company.id, settings);
    await updateTranslations(db, company.id, [settings.about, settings.contactRole], {
      client,
      translate: fakeTranslate,
    });
    expect((await loadCompanyProfile(db, company.id))?.translations).toEqual({
      "Fazemos software de logística.": {
        pt: "Fazemos software de logística.",
        en: "EN: Fazemos software de logística.",
      },
      "Tech Recruiter": { pt: "PT: Tech Recruiter", en: "Tech Recruiter" },
    });
  });
});

describe("requestTranslations", () => {
  const parse = vi.fn();
  const fakeClient = { beta: { messages: { parse } } } as unknown as Anthropic;

  it("sends the texts as data and keeps the entries that fit", async () => {
    parse.mockResolvedValueOnce({
      stop_reason: "end_turn",
      parsed_output: {
        translations: [
          { index: 1, pt: " Olá ", en: "Hello" },
          { index: 0, pt: "Bio", en: "x".repeat(500) },
        ],
      },
    });
    const result = await requestTranslations(fakeClient, ["Bio", "Hello"]);
    expect(result).toEqual([
      { pt: "", en: "" },
      { pt: "Olá", en: "Hello" },
    ]);
    const [params] = parse.mock.calls[0] as [{ messages: { content: string }[] }];
    expect(params.messages[0]?.content).toBe(
      '<text index="0">\nBio\n</text>\n<text index="1">\nHello\n</text>',
    );
  });

  it("gives nothing when the model refuses or runs out of room", async () => {
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null });
    expect(await requestTranslations(fakeClient, ["Bio"])).toBeNull();
    parse.mockResolvedValueOnce({ stop_reason: "max_tokens", parsed_output: null });
    expect(await requestTranslations(fakeClient, ["Bio"])).toBeNull();
  });
});
