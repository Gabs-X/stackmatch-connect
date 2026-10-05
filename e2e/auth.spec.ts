import type { Page } from "@playwright/test";
import { expect, test, uniqueEmail } from "./fixtures";

const main = (page: Page) => page.getByRole("main");

async function registerAccount(
  page: Page,
  account: {
    type: "developer" | "company";
    name: string;
    email: string;
    title?: string;
    company?: string;
    cnpj?: string;
  },
) {
  await page.goto("/register");
  const form = main(page);
  // The radio itself is visually hidden; people click the card.
  await form
    .getByText(account.type === "developer" ? "Sou desenvolvedor" : "Quero contratar")
    .click();
  await form.getByLabel("Nome completo").fill(account.name);
  if (account.company) await form.getByLabel("Empresa").fill(account.company);
  if (account.cnpj) await form.getByLabel("CNPJ").fill(account.cnpj);
  if (account.title)
    await form
      .getByLabel(account.type === "developer" ? "Cargo profissional" : /Seu cargo/)
      .fill(account.title);
  await form.getByLabel("E-mail").fill(account.email);
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
}

test("a developer signs up, lands on the profile form prefilled, and signs out", async ({
  page,
}) => {
  await registerAccount(page, {
    type: "developer",
    name: "Ana Souza",
    title: "Frontend Developer",
    email: uniqueEmail("ana@example.com"),
  });

  await expect(page).toHaveURL(/\/create-profile$/);
  await expect(page.getByLabel("Nome completo")).toHaveValue("Ana Souza");
  await expect(page.getByRole("textbox", { name: "Cargo", exact: true })).toHaveValue(
    "Frontend Developer",
  );

  await page.getByRole("button", { name: "Menu da conta de Ana Souza" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("Desenvolvedor");
  await expect(menu.getByRole("menuitem", { name: "Meu perfil" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Sair" }).click();

  await expect(page.getByText("Você saiu da sua conta")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("banner").getByRole("link", { name: "Entrar" })).toBeVisible();
});

test("a hiring account needs a company and lands on Discover", async ({ page }) => {
  await registerAccount(page, {
    type: "company",
    name: "Bruno Lima",
    email: uniqueEmail("bruno@acme.com"),
  });
  await expect(main(page).getByText("Informe o nome da empresa.")).toBeVisible();
  await expect(main(page).getByText("Informe um CNPJ válido.")).toBeVisible();

  await main(page).getByLabel("Empresa").fill("Acme");
  // Typed digits get the CNPJ mask; the check digits must match.
  const cnpj = main(page).getByLabel("CNPJ");
  await cnpj.pressSequentially("11222333000182");
  await expect(cnpj).toHaveValue("11.222.333/0001-82");
  await main(page).getByRole("button", { name: "Criar conta" }).click();
  await expect(main(page).getByText("Informe um CNPJ válido.")).toBeVisible();
  await cnpj.fill("");
  await cnpj.pressSequentially("11222333000181");
  await main(page).getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/discover$/);
  await page.getByRole("button", { name: "Menu da conta de Bruno Lima" }).click();
  await expect(page.getByRole("menu")).toContainText("Empresa");
  await expect(page.getByRole("menuitem", { name: "Talentos salvos" })).toBeVisible();
});

test("the password checklist follows what is typed", async ({ page }) => {
  await page.goto("/register");
  const password = main(page).getByLabel("Senha", { exact: true });
  await password.fill("abc");
  await expect(main(page).getByRole("listitem").filter({ hasText: "Um número" })).not.toHaveClass(
    /text-positive/,
  );
  await password.fill("abcdefg1");
  for (const rule of ["Pelo menos 8 caracteres", "Uma letra", "Um número"])
    await expect(main(page).getByRole("listitem").filter({ hasText: rule })).toHaveClass(
      /text-positive/,
    );

  await main(page).getByRole("button", { name: "Mostrar senha" }).click();
  await expect(password).toHaveAttribute("type", "text");
});

test("signing in rejects a wrong password and honors the redirect", async ({ page }) => {
  const email = uniqueEmail("bruno@acme.com");
  await registerAccount(page, {
    type: "company",
    name: "Bruno Lima",
    company: "Acme",
    cnpj: "11222333000181",
    email,
  });
  await expect(page).toHaveURL(/\/discover$/);
  await page.getByRole("button", { name: "Menu da conta de Bruno Lima" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  await page.goto("/login?redirect=/saved");
  await main(page).getByLabel("E-mail").fill(email);
  await main(page).getByLabel("Senha", { exact: true }).fill("errada123");
  await main(page).getByRole("button", { name: "Entrar" }).click();
  await expect(main(page).getByRole("alert")).toHaveText("E-mail ou senha incorretos.");

  await main(page).getByLabel("Senha", { exact: true }).fill("segredo123");
  await main(page).getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByText("Olá, Bruno!")).toBeVisible();
});

test("an e-mail can only be registered once", async ({ page, context }) => {
  const account = {
    type: "developer" as const,
    name: "Ana Souza",
    title: "Dev",
    email: uniqueEmail("ana@example.com"),
  };
  await registerAccount(page, account);
  await expect(page).toHaveURL(/\/create-profile$/);
  // Signs out by dropping the session cookie, without going through the menu.
  await context.clearCookies();

  await registerAccount(page, { ...account, email: account.email.toUpperCase() });
  await expect(main(page).getByRole("alert")).toHaveText("Já existe uma conta com esse e-mail.");
});

test("password recovery confirms without revealing whether the account exists", async ({
  page,
}) => {
  await page.goto("/login");
  await main(page).getByRole("link", { name: "Esqueci minha senha" }).click();
  await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
  await main(page).getByLabel("E-mail").fill("ninguem@example.com");
  await main(page).getByRole("button", { name: "Enviar instruções" }).click();

  await expect(main(page).getByRole("status")).toContainText(
    "Se existir uma conta para ninguem@example.com",
  );
});
