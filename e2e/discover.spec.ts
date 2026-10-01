import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

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
  await page.goto("/discover");
  await expect(card(page)).toContainText("Gabriel Botelho");
});

test("shows a loading skeleton, then the first profile", async ({ page, request }) => {
  // The skeleton lasts ~450 ms in the browser, too short to catch reliably; the server-rendered
  // HTML always carries the loading state, so assert it there.
  const html = await (await request.get("/discover")).text();
  expect(html).toContain('aria-busy="true"');

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

test("undo keeps a profile that was saved before the action", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem("stackmatch-saved", JSON.stringify(["gabriel-botelho"])),
  );
  await page.reload();
  await expect(savedBadge(page)).toHaveText("1");

  await page.getByRole("button", { name: "Interessado" }).click();
  await page.getByRole("main").getByRole("button", { name: "Desfazer" }).click();

  await expect(card(page)).toContainText("Gabriel Botelho");
  await expect(savedBadge(page)).toHaveText("1");
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
