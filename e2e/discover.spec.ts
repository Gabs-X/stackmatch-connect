import type { Page } from "@playwright/test";
import { expect, signInAs, test } from "./fixtures";

const card = (page: Page) => page.locator("main section article").first();
const counter = (page: Page) => page.getByText(/^\d+ de \d+ perf(il|is)$/);
const savedBadge = (page: Page) =>
  page
    .getByRole("navigation")
    .getByRole("link", { name: /Talentos salvos/ })
    .locator(".count-badge");
const filterChip = (page: Page, label: string) =>
  page.locator("aside").first().getByRole("button", { name: label, exact: true });

test.beforeEach(async ({ page }) => {
  await signInAs(page, "company");
  await expect(card(page)).toContainText("Gabriel Botelho");
});

test("checks the account before showing any profile, then the first one", async ({
  page,
  request,
}) => {
  // The session lives in the browser, so the server-rendered page only shows the access check.
  const html = await (await request.get("/discover")).text();
  expect(html).toContain("Verificando seu acesso...");
  expect(html).not.toContain("Gabriel Botelho");

  await page.goto("/discover");
  await expect(counter(page)).toHaveText("1 de 8 perfis");
  await expect(card(page)).toContainText("Full Stack Developer");
});

test("marking interest saves the profile and moves to the next one", async ({ page }) => {
  await page.getByRole("button", { name: "Interessado" }).click();

  await expect(page.getByText("Interesse registrado", { exact: true })).toBeVisible();
  await expect(counter(page)).toHaveText("2 de 8 perfis");
  await expect(card(page)).toContainText("Marina Costa");
  await expect(savedBadge(page)).toHaveText("1");
});

test("undo brings the card back and removes the save it created", async ({ page }) => {
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(savedBadge(page)).toHaveText("1");

  await page.getByRole("button", { name: "Desfazer" }).first().click();

  await expect(page.getByText("Ação desfeita")).toBeVisible();
  await expect(card(page)).toContainText("Gabriel Botelho");
  await expect(savedBadge(page)).toBeHidden();
});

test("profiles already saved stay out of Discover", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem("stackmatch-saved", JSON.stringify(["demo-developer"])),
  );
  await page.reload();

  await expect(counter(page)).toHaveText("1 de 7 perfis");
  await expect(card(page)).not.toContainText("Gabriel Botelho");
  await expect(page.getByRole("link", { name: "· 1 já salvo fora da lista" })).toBeVisible();

  // Saving during the round keeps the card in the list, so undo still brings it back.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(counter(page)).toHaveText("2 de 7 perfis");
  await page.getByRole("main").getByRole("button", { name: "Desfazer" }).click();
  await expect(counter(page)).toHaveText("1 de 7 perfis");
  await expect(savedBadge(page)).toHaveText("1");
});

test("a search whose talents are all saved points to the shortlist", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "stackmatch-saved",
      JSON.stringify(["marina-costa", "rafael-lima", "amanda-rocha"]),
    ),
  );
  await page.reload();
  await filterChip(page, "Sênior").click();

  await expect(
    page.getByRole("heading", { name: "Você já salvou todos estes talentos" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ver talentos salvos" }).click();
  await expect(page).toHaveURL(/\/saved$/);
});

test("filters narrow the list and active chips can be removed", async ({ page }) => {
  await filterChip(page, "Sênior").click();

  await expect(counter(page)).toHaveText("1 de 3 perfis");
  await expect(card(page)).toContainText("Sênior");

  await page.getByRole("button", { name: "Remover filtro: Sênior" }).click();
  await expect(counter(page)).toHaveText("1 de 8 perfis");
});

test("a search without results offers to clear the filters", async ({ page }) => {
  await filterChip(page, "Angular").click();

  await expect(page.getByRole("heading", { name: "Nenhum talento encontrado" })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(counter(page)).toHaveText("1 de 8 perfis");
});

test("reaching the end of the list offers to review again", async ({ page }) => {
  await filterChip(page, "Presencial").click();
  await expect(counter(page)).toHaveText("1 de 1 perfil");

  await page.getByRole("button", { name: "Passar" }).click();
  await expect(page.getByRole("heading", { name: "Você chegou ao fim da lista" })).toBeVisible();

  await page.getByRole("button", { name: "Rever perfis" }).click();
  await expect(card(page)).toContainText("Diego Santos");
});

test("the saved counter matches the list, even with ids left by older versions", async ({
  page,
}) => {
  // A profile that no longer exists, and Gabriel under the id he had in the old catalog.
  await page.evaluate(() =>
    localStorage.setItem(
      "stackmatch-saved",
      JSON.stringify(["perfil-removido", "gabriel-botelho"]),
    ),
  );
  await page.reload();
  await expect(savedBadge(page)).toHaveText("1");

  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Talentos salvos/ })
    .click();
  await expect(page.getByRole("main").getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("main")).toContainText("Gabriel Botelho");
});
