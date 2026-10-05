import { expect, signInAs, test } from "./fixtures";

test("developer opens an interested company and sees its description", async ({ page }) => {
  await signInAs(page, "developer");
  await page.goto("/interests");
  const card = page.getByRole("listitem").filter({ hasText: "VerdeTech" });
  await card.getByRole("link", { name: "Ver empresa" }).click();

  await page.waitForURL(/\/company\/demo-company-verdetech$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "VerdeTech" })).toBeVisible();
  await expect(main.getByText(/Plataforma de gestão para o agronegócio/)).toBeVisible();
  await expect(main.getByText("Campinas, SP")).toBeVisible();
  await expect(main.getByText("Paula Nogueira")).toBeVisible();
  await expect(main.getByText("Head de Engenharia")).toBeVisible();
  await expect(main.getByText(/Horário sugerido/)).toBeVisible();
  await expect(main.getByRole("link", { name: "Responder por e-mail" })).toHaveAttribute(
    "href",
    /^mailto:paula@verdetech\.example/,
  );

  await main.getByRole("link", { name: "Voltar para empresas interessadas" }).click();
  await page.waitForURL(/\/interests$/);
});

test("company name in the list also opens its page", async ({ page }) => {
  await signInAs(page, "developer");
  await page.goto("/interests");
  await page.getByRole("link", { name: "NuvemPay", exact: true }).click();
  await page.waitForURL(/\/company\/demo-company-nuvempay$/);
  await expect(page.getByText(/Fintech de pagamentos digitais/)).toBeVisible();
});

test("a company that never reached the developer is not shown", async ({ page }) => {
  await signInAs(page, "developer");
  await page.goto("/company/someone-else");
  await expect(page.getByRole("heading", { name: "Empresa não encontrada" })).toBeVisible();
});
