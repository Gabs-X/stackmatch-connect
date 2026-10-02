import type { Page } from "@playwright/test";
import { expect, signInAs, test } from "./fixtures";

test("the Discover action bar stays usable above the assistant button", async ({ page }) => {
  await signInAs(page, "company");
  await expect(page.locator("main section article").first()).toContainText("Gabriel Botelho");

  const interested = page.getByRole("button", { name: "Interessado" });
  const assistant = page.getByRole("button", { name: "Abrir assistente" });
  const bar = await interested.boundingBox();
  const fab = await assistant.boundingBox();
  expect(bar && fab).toBeTruthy();
  // The floating button sits entirely above the action buttons.
  expect(fab!.y + fab!.height).toBeLessThanOrEqual(bar!.y);

  await interested.click();
  await expect(page.getByText(/^2 de 8 perfis$/)).toBeVisible();
});

test("filters open in a drawer on small screens", async ({ page }) => {
  await signInAs(page, "company");
  await page.getByRole("button", { name: "Filtros" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Sênior", exact: true }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByText(/^1 de 3 perfis$/)).toBeVisible();
});

test("the assistant opens full screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  const chat = page.getByRole("dialog", { name: "Assistente StackMatch" });
  const viewport = page.viewportSize();
  // Measure after the opening animation, which scales the panel up from 98%.
  await expect(async () => {
    expect((await chat.boundingBox())?.width).toBe(viewport?.width);
  }).toPass();
});

test("the mobile menu offers sign-in and sign-up when logged out", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("banner").getByRole("link", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Criar sua conta" })).toBeVisible();
});

test.describe("on a narrow phone", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  const fitsWidth = async (page: Page, path: string) => {
    await page.goto(path);
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll, `${path} scrolls sideways`).toBeLessThanOrEqual(client);
  };

  test("no page scrolls sideways and the menu button stays on screen", async ({ page }) => {
    await fitsWidth(page, "/");
    await signInAs(page, "company");
    for (const path of ["/discover", "/saved", "/developer/marina-costa", "/company-settings"])
      await fitsWidth(page, path);
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeInViewport({ ratio: 1 });

    await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await signInAs(page, "developer");
    for (const path of ["/create-profile", "/developer/demo-developer", "/interests"])
      await fitsWidth(page, path);
  });

  test("the language is chosen from the menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("banner").getByRole("combobox", { name: "Idioma" }).selectOption("en");
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  });
});
