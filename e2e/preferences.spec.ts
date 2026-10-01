import { expect, test } from "./fixtures";

test("switching to English translates the interface and is remembered", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");

  await expect(page.getByRole("heading", { name: "Find your next hire" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Find your next hire" })).toBeVisible();
});

test("the dark theme applies before paint and survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Tema:/ }).click();
  await page.getByRole("menuitemradio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  // The head script must apply the class before the app hydrates.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { darkAtLoad: boolean }).darkAtLoad =
        document.documentElement.classList.contains("dark");
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { darkAtLoad: boolean }).darkAtLoad)).toBe(
    true,
  );
});

test.describe("with a dark operating system", () => {
  test.use({ colorScheme: "dark" });

  test("follows the system until a theme is chosen", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: /^Tema:/ }).click();
    await page.getByRole("menuitemradio", { name: "Claro" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
