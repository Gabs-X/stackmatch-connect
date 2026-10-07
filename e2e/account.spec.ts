import type { Page } from "@playwright/test";
import { emailCode, expect, lastEmail, signInAs, test, uniqueEmail } from "./fixtures";

const main = (page: Page) => page.getByRole("main");

async function openAccount(page: Page, name: string) {
  await page.getByRole("button", { name: `Menu da conta de ${name}` }).click();
  await page.getByRole("menuitem", { name: "Conta" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sua conta" })).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await main(page).getByLabel("E-mail").fill(email);
  await main(page).getByLabel("Senha", { exact: true }).fill(password);
  await main(page).getByRole("button", { name: "Entrar" }).click();
}

test("an account changes its password", async ({ page }) => {
  await signInAs(page, "developer");
  await openAccount(page, "Gabriel Botelho");
  const section = main(page).getByRole("region", { name: "Senha" });
  await section.getByLabel("Senha atual").fill("errada123");
  await section.getByLabel("Nova senha").fill("novasenha1");
  await section.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(section.getByRole("alert")).toHaveText("Senha atual incorreta.");

  await section.getByLabel("Senha atual").fill("teste1234");
  await section.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("Senha alterada.")).toBeVisible();

  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await signIn(page, "teste.dev@example.com", "novasenha1");
  await expect(page).toHaveURL(/\/create-profile$/);
});

test("an account changes its e-mail with a code sent to the new address", async ({ page }) => {
  const newEmail = uniqueEmail("rh@acme.com");
  await signInAs(page, "company");
  await openAccount(page, "Recrutadora Teste");
  const section = main(page).getByRole("region", { name: "E-mail de acesso" });
  await expect(section).toContainText("Você entra com teste.emp@example.com.");

  await section.getByLabel("Novo e-mail").fill(newEmail);
  await section.getByLabel("Senha atual").fill("teste1234");
  await section.getByRole("button", { name: "Enviar código" }).click();
  await expect(section).toContainText(`Enviamos um código de 6 dígitos para ${newEmail}`);
  await section.getByLabel("Código").fill(await emailCode(page, newEmail));
  await section.getByRole("button", { name: "Confirmar novo e-mail" }).click();

  await expect(page.getByText("E-mail alterado. Use o novo endereço para entrar.")).toBeVisible();
  await expect(section).toContainText(`Você entra com ${newEmail}.`);
  // The old address is told, in case the change wasn't its owner's.
  expect((await lastEmail(page, "teste.emp@example.com")).subject).toBe(
    "O e-mail da sua conta no StackMatch foi alterado",
  );

  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await signIn(page, newEmail, "teste1234");
  await expect(page).toHaveURL(/\/discover$/);
});

test("a developer deletes their account and disappears from Discover", async ({ page }) => {
  await signInAs(page, "developer");
  await openAccount(page, "Gabriel Botelho");
  const section = main(page).getByRole("region", { name: "Excluir conta" });
  await section.getByLabel("Senha atual").fill("teste1234");
  await section.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(
    section.getByText("Confirme que entende que a exclusão é definitiva."),
  ).toBeVisible();

  await section.getByLabel("Entendo que a exclusão é definitiva.").check();
  await section.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Sua conta foi excluída.")).toBeVisible();

  await signIn(page, "teste.dev@example.com", "teste1234");
  await expect(main(page).getByRole("alert")).toHaveText("E-mail ou senha incorretos.");

  await signInAs(page, "company");
  await expect(page.getByText(/^1 de 4 perfis$/)).toBeVisible();
  await expect(main(page)).not.toContainText("Gabriel Botelho");
});
