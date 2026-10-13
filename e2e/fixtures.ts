import { test as base, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { testCompanies, testDevelopers } from "./test-data";

// Stand-in for GitHub avatars so tests never depend on the network.
const avatar = readFileSync(new URL("./github-avatar.jpg", import.meta.url));

/**
 * Pages are server-rendered, so buttons exist before React attaches their handlers; a click in
 * that window does nothing. Wait for the root's data-hydrated flag after every navigation.
 */
function waitForHydrationOnNavigation(page: Page) {
  const ready = () => page.waitForSelector("html[data-hydrated]", { state: "attached" });
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  page.goto = async (...args) => {
    const response = await goto(...args);
    await ready();
    return response;
  };
  page.reload = async (...args) => {
    const response = await reload(...args);
    await ready();
    return response;
  };
}

export const test = base.extend<{ githubAvatars: "serve" | "fail" }>({
  githubAvatars: ["serve", { option: true }],
  // Named `provide` instead of Playwright's usual `use` so the React hooks lint rule ignores it.
  page: async ({ page, githubAvatars }, provide) => {
    const cityLists: Record<string, string[]> = {
      SP: ["Campinas", "São Paulo"],
      MG: ["Belo Horizonte", "Uberaba"],
      PR: ["Curitiba"],
      PE: ["Recife"],
      SC: ["Florianópolis"],
      CE: ["Fortaleza"],
      RN: ["Natal"],
    };
    await page.route(
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados/*/municipios*",
      (route) => {
        const uf = new URL(route.request().url()).pathname.split("/")[5] ?? "";
        return route.fulfill({ json: (cityLists[uf] ?? []).map((nome, id) => ({ id, nome })) });
      },
    );
    await page.route("https://github.com/**", (route) =>
      githubAvatars === "serve"
        ? route.fulfill({ status: 200, contentType: "image/jpeg", body: avatar })
        : route.fulfill({ status: 404, body: "" }),
    );
    waitForHydrationOnNavigation(page);
    // Every test starts from the seed plus the test data, whatever the previous one saved.
    const reset = await page.request.post("/api/test-reset");
    if (!reset.ok()) throw new Error(`Database reset failed: ${reset.status()}`);
    await seed(page, { developers: testDevelopers, companies: testCompanies });
    await provide(page);
  },
});

export { expect } from "@playwright/test";

export async function chooseLocation(page: Page, city: string, uf: string) {
  await page.getByLabel("Estado", { exact: true }).selectOption(uf);
  await page.getByLabel("Cidade", { exact: true }).selectOption(city);
}

/**
 * A fresh address for each sign-up, so tests never depend on which accounts already exist:
 * "ana@example.com" -> "ana+1a2b3c4d@example.com".
 */
export const uniqueEmail = (address: string) =>
  address.replace("@", `+${crypto.randomUUID().slice(0, 8)}@`);

async function seed(page: Page, data: object) {
  const response = await page.request.post("/api/test-seed", { data });
  if (!response.ok()) throw new Error(`Seeding failed: ${response.status()}`);
}

/** Publishes more developer profiles (made with developer() from test-data.ts). */
export const seedDevelopers = (page: Page, developers: object[]) => seed(page, { developers });

/** Uses up the code e-mails this machine's IP address may cause (see src/server/email-throttle.ts). */
export const seedEmailLimitReached = (page: Page) => seed(page, { emailLimitReached: true });

/** Publishes `count` jobs of the test company in the job board (see /api/test-seed). */
export const seedBoardJobs = (page: Page, count: number) => seed(page, { boardJobs: count });

/** Puts profiles in the shortlist of the test company (teste.emp), straight in the database. */
export const seedSavedTalents = (page: Page, developerIds: string[]) =>
  seed(page, { savedTalents: { companyId: "demo-company", developerIds } });

/**
 * Takes over the page's calls to one server function, by its export name in src/lib (such as
 * "saveTalentFn"): `fail` answers them with a server error, `hold` keeps them waiting until
 * release(). Relies on the dev server the e2e runs on, whose function ids are the base64url of a
 * JSON naming the export. `calls()` counts the calls the page made.
 */
export async function interceptServerFn(page: Page, name: string, mode: "fail" | "hold") {
  let calls = 0;
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  const exportName = (url: string) => {
    try {
      const id = new URL(url).pathname.split("/").pop() ?? "";
      return String(
        (JSON.parse(Buffer.from(id, "base64url").toString("utf8")) as { export?: unknown }).export,
      );
    } catch {
      return "";
    }
  };
  const handler = async (route: Route) => {
    // The export is named after the function, with a suffix such as "_createServerFn_handler".
    const called = exportName(route.request().url());
    if (called !== name && !called.startsWith(`${name}_`)) return route.fallback();
    calls += 1;
    if (mode === "fail") return route.fulfill({ status: 500, body: "Simulated failure" });
    await released;
    return route.continue();
  };
  await page.route("**/_serverFn/**", handler);
  // stop() lets later calls through again.
  return { calls: () => calls, release, stop: () => page.unroute("**/_serverFn/**", handler) };
}

/** Signs in with a seed account through the login form and waits for its home page. */
export async function signInAs(page: Page, type: "developer" | "company") {
  await page.goto("/login");
  const form = page.getByRole("main");
  await form
    .getByLabel("E-mail")
    .fill(type === "developer" ? "teste.dev@example.com" : "teste.emp@example.com");
  await form.getByLabel("Senha", { exact: true }).fill("teste1234");
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(type === "developer" ? /\/create-profile$/ : /\/discover$/);
}

/** The code in the last e-mail the server "sent" to the address (see /api/test-emails). */
export async function emailCode(page: Page, to: string) {
  let code: string | null = null;
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/test-emails?to=${encodeURIComponent(to)}`);
      code = ((await response.json()) as { code: string | null }).code;
      return code;
    })
    .toMatch(/^\d{6}$/);
  return code ?? "";
}

/** On the confirmation screen after signing up: enters the e-mailed code. */
export async function confirmEmail(page: Page) {
  await page.waitForURL(/\/verify-email/);
  const sentTo = await page.getByText(/Enviamos um código de 6 dígitos para /).textContent();
  const email = sentTo?.match(/para (\S+@\S+?)\. /)?.[1] ?? "";
  await page.getByLabel("Código").fill(await emailCode(page, email));
  await page.getByRole("button", { name: "Confirmar e-mail" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/verify-email"));
}

/** The last e-mail the server "sent" to the address, waiting for it to arrive. */
export async function lastEmail(page: Page, to: string) {
  type Sent = {
    subject: string | null;
    text: string | null;
    replyTo: string | null;
    attachments: string[];
  };
  let email: Sent = { subject: null, text: null, replyTo: null, attachments: [] };
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/test-emails?to=${encodeURIComponent(to)}`);
      email = (await response.json()) as Sent;
      return email.subject;
    })
    .not.toBeNull();
  return email;
}
