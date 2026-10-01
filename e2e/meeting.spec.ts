import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Thursday noon in Brasília, so the next day (Friday) has every time open.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-01T12:00:00-03:00"));
});

async function registerCompany(page: Page) {
  await page.goto("/register?type=company");
  const form = page.getByRole("main");
  await form.getByLabel("Nome completo").fill("Bia Santos");
  await form.getByLabel("Empresa").fill("Acme");
  await form.getByLabel("E-mail").fill("bia@acme.com");
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/discover$/);
}

test("asks visitors to sign in before proposing a meeting", async ({ page }) => {
  await page.goto("/developer/marina-costa");
  await page.getByRole("button", { name: "Propor reunião" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Entre para enviar a proposta")).toBeVisible();
  await dialog.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdeveloper%2Fmarina-costa$/);
});

test("a company proposes one time and sees the e-mail the developer will get", async ({ page }) => {
  await registerCompany(page);
  await page.goto("/developer/marina-costa");
  await page.getByRole("button", { name: "Propor reunião" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.locator('[data-day="02/10/2026"]').click();
  // 10:30 on Friday is still ahead; earlier times today would be disabled.
  await dialog.getByRole("button", { name: "10:30" }).click();
  await dialog.getByRole("button", { name: "Continuar" }).click();

  await dialog.getByLabel(/Sobre a oportunidade/).fill("Projeto de dashboard em React.");
  const preview = dialog.getByRole("region", { name: "Prévia do e-mail" });
  await expect(preview).toContainText("Acme quer conversar com você pelo StackMatch");
  await expect(preview).toContainText("bia@acme.com");
  await expect(preview).toContainText("sexta-feira, 2 de outubro, às 10:30");
  await expect(preview).toContainText("Projeto de dashboard em React.");

  await dialog.getByRole("button", { name: "Enviar proposta" }).click();
  await expect(dialog.getByRole("heading", { name: "Proposta enviada" })).toBeVisible();
  await expect(dialog).toContainText("As respostas chegam em bia@acme.com");
  await dialog.getByRole("button", { name: "Concluir" }).click();

  // The proposal is remembered, but another one can still be sent.
  await page.getByRole("button", { name: "Propor reunião" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Você já enviou uma proposta para este profissional (sexta-feira, 2 de outubro, às 10:30)",
  );
});

test("developer accounts can't send proposals", async ({ page }) => {
  await page.goto("/register");
  const form = page.getByRole("main");
  await form.getByText("Sou desenvolvedor").click();
  await form.getByLabel("Nome completo").fill("Ana Souza");
  await form.getByLabel("Cargo profissional").fill("Frontend Developer");
  await form.getByLabel("E-mail").fill("ana@example.com");
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/create-profile$/);

  await page.goto("/developer/marina-costa");
  await page.getByRole("button", { name: "Propor reunião" }).click();
  await expect(page.getByRole("dialog")).toContainText("Disponível para contas de empresa");
});
