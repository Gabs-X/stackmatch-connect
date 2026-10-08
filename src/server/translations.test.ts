import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfile } from "@/lib/local-profile";
import { loadCompanyProfile, saveCompanySettings } from "./companies";
import type { Db } from "./db";
import { textTranslations, users } from "./db/schema";
import { loadPublishedProfile, profileTexts, saveProfile } from "./profiles";
import { createAccount } from "./auth";
import { createDeveloper, createTestDb } from "./test-db";
import {
  canTranslate,
  maxTranslationsPerAccount,
  recordTranslationRequest,
  translationWindowHours,
} from "./translation-throttle";
import {
  DeepLError,
  deeplTranslator,
  defaultTranslator,
  loadTranslations,
  requestTranslations,
  updateTranslations,
  withBackup,
  type Translator,
} from "./translations";

let db: Db;
let ana: string;

/** A stand-in for the model: English gets a "(pt)" marker in Portuguese, and the reverse. */
const fakeTranslate = vi.fn<Translator>(async (texts) =>
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
      translator: fakeTranslate,
    });
    expect(fakeTranslate).toHaveBeenCalledWith(
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
      translator: fakeTranslate,
    });
    expect(fakeTranslate).toHaveBeenLastCalledWith(["Novo cargo em ação"], expect.anything());
  });

  it("drops translations of texts the account no longer has", async () => {
    await updateTranslations(db, ana, ["Texto antigo em ação", "Texto mantido em ação"], {
      translator: fakeTranslate,
    });
    await updateTranslations(db, ana, ["Texto mantido em ação"], { translator: fakeTranslate });
    const rows = await db.select().from(textTranslations);
    expect(rows).toHaveLength(2);
    expect(await loadTranslations(db, [ana], ["Texto antigo em ação"])).toEqual({});
  });

  it("only prunes without a translator, and never throws", async () => {
    await updateTranslations(db, ana, ["Texto em ação"], { translator: fakeTranslate });
    await updateTranslations(db, ana, ["Texto em ação"], { translator: null });
    expect(fakeTranslate).toHaveBeenCalledTimes(1);
    expect(await db.select().from(textTranslations)).toHaveLength(2);

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      updateTranslations(db, ana, ["Outro texto em ação"], {
        translator: async () => {
          throw new Error("API down");
        },
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("stops translating an account at its limit, but not without the limit", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < maxTranslationsPerAccount; i++)
      await updateTranslations(db, ana, [`Bio número ${i} em ação`], { translator: fakeTranslate });
    expect(fakeTranslate).toHaveBeenCalledTimes(maxTranslationsPerAccount);

    // Past the limit the text stays as written, and saving what's translated costs nothing.
    await updateTranslations(db, ana, ["Bio nova demais em ação"], { translator: fakeTranslate });
    expect(fakeTranslate).toHaveBeenCalledTimes(maxTranslationsPerAccount);
    expect(await loadTranslations(db, [ana], ["Bio nova demais em ação"])).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("translation limit"));

    // Another account has its own limit, and the backfill script skips it.
    const bia = await createDeveloper(db, "bia@example.com");
    await updateTranslations(db, bia, ["Bio da Bia em ação"], { translator: fakeTranslate });
    await updateTranslations(db, ana, ["Bio nova demais em ação"], {
      translator: fakeTranslate,
      limited: false,
    });
    expect(fakeTranslate).toHaveBeenCalledTimes(maxTranslationsPerAccount + 2);
    warn.mockRestore();
  });

  it("frees the limit as requests leave the window", async () => {
    const now = Date.now();
    for (let i = 0; i < maxTranslationsPerAccount; i++)
      await recordTranslationRequest(db, ana, now - translationWindowHours * 3_600_000 + 60_000);
    expect(await canTranslate(db, ana, now)).toBe(false);
    expect(await canTranslate(db, ana, now + 120_000)).toBe(true);
  });

  it("skips texts the model left out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await updateTranslations(db, ana, ["Um em ação", "Dois em ação"], {
      translator: async () => [
        { pt: "Um em ação", en: "One" },
        { pt: "", en: "" },
      ],
    });
    expect(Object.keys(await loadTranslations(db, [ana], ["Um em ação", "Dois em ação"]))).toEqual([
      "Um em ação",
    ]);
    await updateTranslations(db, ana, ["Três em ação"], {
      translator: async () => null,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("goes away with the account", async () => {
    await updateTranslations(db, ana, ["Texto em ação"], { translator: fakeTranslate });
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
    await updateTranslations(db, ana, profileTexts(profile), { translator: fakeTranslate });

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
      translator: fakeTranslate,
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

describe("deeplTranslator", () => {
  const signal = new AbortController().signal;
  /** Answers like DeepL: Portuguese texts come back as English and the reverse. */
  const deepl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { text: string[]; target_lang: string };
    return Response.json({
      translations: body.text.map((text) => {
        const portuguese = /[ãçéêíõ]/.test(text);
        return {
          detected_source_language: portuguese ? "PT" : "EN",
          text: body.target_lang === "EN-US" ? `EN: ${text}` : `PT: ${text}`,
        };
      }),
    });
  });

  beforeEach(() => {
    deepl.mockClear();
  });

  it("keeps each text as written in its own language and translates it into the other", async () => {
    const translate = deeplTranslator("free-key:fx", deepl as unknown as typeof fetch);
    expect(
      await translate(["Desenvolvo interfaces acessíveis.", "Frontend Developer"], signal),
    ).toEqual([
      { pt: "Desenvolvo interfaces acessíveis.", en: "EN: Desenvolvo interfaces acessíveis." },
      { pt: "PT: Frontend Developer", en: "Frontend Developer" },
    ]);

    expect(deepl).toHaveBeenCalledTimes(2);
    const [url, init] = deepl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api-free.deepl.com/v2/translate");
    expect(init.headers).toMatchObject({ Authorization: "DeepL-Auth-Key free-key:fx" });
    expect(
      deepl.mock.calls.map(([, call]) => JSON.parse(String(call?.body)).target_lang).sort(),
    ).toEqual(["EN-US", "PT-BR"]);
  });

  it("uses the Pro API for Pro keys", async () => {
    await deeplTranslator("pro-key", deepl as unknown as typeof fetch)(["Oi, ação"], signal);
    expect(deepl.mock.calls[0]?.[0]).toBe("https://api.deepl.com/v2/translate");
  });

  it("fails with DeepL's status, such as 456 when the quota ran out", async () => {
    const quota = vi.fn(async () => new Response("Quota exceeded", { status: 456 }));
    const failure = deeplTranslator("key:fx", quota as unknown as typeof fetch)(["Oi"], signal);
    await expect(failure).rejects.toBeInstanceOf(DeepLError);
    await expect(failure).rejects.toMatchObject({ status: 456 });
  });
});

describe("withBackup", () => {
  const signal = new AbortController().signal;
  const backup = vi.fn<Translator>(async (texts) => texts.map((text) => ({ pt: text, en: text })));

  beforeEach(() => {
    backup.mockClear();
  });

  it("uses the backup only when the primary fails or gives nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = vi.fn<Translator>(async () => [{ pt: "um", en: "one" }]);
    expect(await withBackup(primary, backup)(["um"], signal)).toEqual([{ pt: "um", en: "one" }]);
    expect(backup).not.toHaveBeenCalled();

    primary.mockRejectedValueOnce(new DeepLError(456));
    expect(await withBackup(primary, backup)(["um"], signal)).toEqual([{ pt: "um", en: "um" }]);
    primary.mockResolvedValueOnce(null);
    await withBackup(primary, backup)(["um"], signal);
    expect(backup).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("doesn't fall back once the time is up", async () => {
    const controller = new AbortController();
    controller.abort();
    const primary = vi.fn<Translator>(async () => {
      throw new Error("aborted");
    });
    await expect(withBackup(primary, backup)(["um"], controller.signal)).rejects.toThrow("aborted");
    expect(backup).not.toHaveBeenCalled();
  });
});

describe("defaultTranslator", () => {
  afterEach(() => vi.unstubAllEnvs());

  const stubFetch = (calls: string[]) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        calls.push(String(url));
        return String(url).includes("deepl")
          ? new Response("Quota exceeded", { status: 456 })
          : Response.json({ error: { type: "authentication_error" } }, { status: 401 });
      }),
    );

  it("uses only DeepL by default, even with the assistant's Claude key", async () => {
    vi.stubEnv("TRANSLATION_BACKUP", "");
    vi.stubEnv("DEEPL_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(defaultTranslator()).toBeNull();

    vi.stubEnv("DEEPL_API_KEY", "key:fx");
    const calls: string[] = [];
    stubFetch(calls);
    await expect(defaultTranslator()?.(["Oi"], new AbortController().signal)).rejects.toMatchObject(
      { status: 456 },
    );
    expect(calls.every((url) => url.includes("api-free.deepl.com"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("falls back to Claude only with TRANSLATION_BACKUP=claude", async () => {
    vi.stubEnv("TRANSLATION_BACKUP", "claude");
    vi.stubEnv("DEEPL_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(defaultTranslator()).toBeTypeOf("function");

    vi.stubEnv("DEEPL_API_KEY", "key:fx");
    const calls: string[] = [];
    stubFetch(calls);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const translate = defaultTranslator();
    await expect(translate?.(["Oi"], new AbortController().signal)).rejects.toBeDefined();
    expect(calls.some((url) => url.includes("api-free.deepl.com"))).toBe(true);
    expect(calls.some((url) => url.includes("api.anthropic.com"))).toBe(true);
    warn.mockRestore();
    vi.unstubAllGlobals();
  });
});
