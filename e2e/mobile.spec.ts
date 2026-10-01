import { expect, test } from "./fixtures";

test("the Discover action bar stays usable above the assistant button", async ({ page }) => {
  await page.goto("/discover");
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
  await page.goto("/discover");
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
