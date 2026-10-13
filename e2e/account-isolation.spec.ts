import type { Page } from "@playwright/test";
import { confirmEmail, expect, interceptServerFn, signInAs, test, uniqueEmail } from "./fixtures";

const card = (page: Page) => page.locator("main section article").first();
const savedBadge = (page: Page) =>
  page
    .getByRole("navigation")
    .getByRole("link", { name: /Talentos salvos/ })
    .locator(".count-badge");
const toasts = (page: Page) => page.locator("[data-sonner-toast]");

async function signOut(page: Page, name: string) {
  await page.getByRole("button", { name: `Menu da conta de ${name}` }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page.getByRole("button", { name: /^Menu da conta de/ })).toBeHidden();
}

test("changes still waiting when the account changes are never sent", async ({ page }) => {
  await signInAs(page, "company");
  await expect(card(page)).toContainText("Gabriel Botelho");
  const saves = await interceptServerFn(page, "saveTalentFn", "hold");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(card(page)).not.toContainText("Gabriel Botelho");
  const secondName = (await card(page).getByRole("heading").first().textContent()) ?? "";
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  // The first save waits on the network; the second waits for it to finish.
  await expect.poll(saves.calls).toBe(1);

  await signOut(page, "Recrutadora Teste");
  await signInAs(page, "developer");
  saves.release();
  await signOut(page, "Gabriel Botelho");
  await signInAs(page, "company");

  // The waiting save never left. (The one held on the network reached the server after the
  // sign-out; whatever the server made of it, it's the only call.)
  expect(saves.calls()).toBe(1);
  await page.goto("/saved");
  // Wait for the list itself, saved profiles or none, before checking who isn't in it.
  const main = page.getByRole("main");
  await expect(
    main.getByRole("article").or(main.getByText("Você ainda não salvou nenhum talento.")).first(),
  ).toBeVisible();
  expect(secondName).not.toBe("");
  await expect(main.getByText(secondName, { exact: true })).toBeHidden();
});

test("a change made after another tab switched accounts is refused, not saved for the new one", async ({
  page,
}) => {
  await signInAs(page, "company");
  await page.goto("/developer/marina-costa");
  // This tab doesn't hear about the switch yet: its question to the server keeps waiting.
  const whoAmI = await interceptServerFn(page, "fetchCurrentUser", "hold");

  const other = await page.context().newPage();
  const hydrated = () => other.waitForSelector("html[data-hydrated]", { state: "attached" });
  await other.goto("/");
  await hydrated();
  await signOut(other, "Recrutadora Teste");
  await other.goto("/register");
  await hydrated();
  const form = other.getByRole("main");
  await form.getByText("Quero contratar").click();
  await form.getByLabel("Nome completo").fill("Bruno Lima");
  await form.getByLabel("Empresa").fill("Acme");
  await form.getByLabel("CNPJ").fill("11222333000181");
  await form.getByLabel("E-mail").fill(uniqueEmail("bruno@acme.com"));
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
  await confirmEmail(other);

  // Still shown as the first company here, but the session is now Acme's.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(toasts(page).getByText("Não foi possível salvar a alteração.")).toBeVisible();
  await expect(toasts(page).getByText("Talento salvo")).toBeHidden();
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeVisible();

  whoAmI.release();
  await whoAmI.stop();
  await other.goto("/saved");
  await hydrated();
  await expect(other.getByText("Você ainda não salvou nenhum talento.")).toBeVisible();
});

test("a shortlist that fails to load shows an error, not an empty list", async ({ page }) => {
  const lists = await interceptServerFn(page, "fetchSavedTalents", "fail");
  await signInAs(page, "company");
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar os talentos");
  await expect(card(page)).toBeHidden();

  await page.goto("/saved");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar seus talentos salvos",
  );
  await expect(page.getByText("Você ainda não salvou nenhum talento.")).toBeHidden();

  await lists.stop();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Você ainda não salvou nenhum talento.")).toBeVisible();
  await page.goto("/discover");
  await expect(card(page)).toContainText("Gabriel Botelho");
});

test("a profile that fails to load can't be overwritten by a blank form", async ({ page }) => {
  const profile = await interceptServerFn(page, "fetchMyProfile", "fail");
  await signInAs(page, "developer");
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar seu perfil", {
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: /Concluir|Salvar/ })).toHaveCount(0);

  await profile.stop();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Gabriel Botelho" })).toBeVisible();
});

test("a visitor who saves a talent goes to the login and comes back", async ({ page }) => {
  await page.goto("/developer/marina-costa");
  await page.getByRole("link", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdeveloper%2Fmarina-costa$/);
});

test("a developer who saves a talent is told only companies can", async ({ page }) => {
  await signInAs(page, "developer");
  await page.goto("/developer/marina-costa");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(toasts(page).getByText("Somente contas de empresa salvam talentos.")).toBeVisible();
});

test("a save the server fails is undone and never reported as done", async ({ page }) => {
  await signInAs(page, "company");
  await page.goto("/developer/marina-costa");
  const saves = await interceptServerFn(page, "saveTalentFn", "fail");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(toasts(page).getByText("Não foi possível salvar a alteração.")).toBeVisible();
  await expect(toasts(page).getByText("Talento salvo")).toBeHidden();
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeVisible();
  await expect(savedBadge(page)).toBeHidden();

  // Once the server answers, the confirmation shows.
  await saves.stop();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(toasts(page).getByText("Talento salvo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvo", exact: true })).toBeVisible();
  await expect(savedBadge(page)).toHaveText("1");
});
