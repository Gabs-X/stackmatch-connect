import { expect, signInAs, test } from "./fixtures";

test("visitors are sent to the login before account-only pages", async ({ page }) => {
  await page.goto("/interests");
  await expect(page).toHaveURL(/\/login\?redirect=%2Finterests$/);

  await page.getByRole("button", { name: "Preencher com a conta de teste: Desenvolvedor" }).click();
  await page.getByRole("main").getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/interests$/);
});

test("each account type only reaches its own areas", async ({ page }) => {
  await signInAs(page, "developer");
  const nav = page.getByRole("banner").getByRole("navigation");
  await expect(nav.getByRole("link", { name: "Empresas interessadas" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Talentos salvos" })).toBeHidden();
  await expect(nav.getByRole("link", { name: "Discover" })).toBeHidden();
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Área para contas de empresa" })).toBeVisible();
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Área para contas de empresa" })).toBeVisible();

  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  await signInAs(page, "company");
  await expect(nav.getByRole("link", { name: "Talentos salvos" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Empresas interessadas" })).toBeHidden();
  await page.goto("/interests");
  await expect(
    page.getByRole("heading", { name: "Área para contas de desenvolvedor" }),
  ).toBeVisible();
});

test("a developer sees the companies interested in their profile", async ({ page }) => {
  // teste.dev's profile (Gabriel Botelho) is already published, first in Discover.
  // The test company marks it as interesting.
  await signInAs(page, "company");
  await expect(page.locator("main section article").first()).toContainText("Gabriel Botelho");
  await page.getByRole("button", { name: "Interessado" }).click();
  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  await signInAs(page, "developer");
  await page.getByRole("banner").getByRole("link", { name: "Empresas interessadas" }).click();
  const list = page.getByRole("main").getByRole("listitem");
  const company = list.filter({ hasText: "Empresa Teste" });
  await expect(company).toContainText("Marcou interesse");
  await expect(company.getByRole("link", { name: "Responder por e-mail" })).toHaveAttribute(
    "href",
    /^mailto:teste\.emp@stackmatch\.app\?subject=/,
  );
  // The demo account also has mock activity from the (future) API.
  await expect(list.filter({ hasText: "VerdeTech" })).toContainText("Propôs uma conversa");
  await expect(list).toHaveCount(4);
});

test("visitors see no app areas until they sign in", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("banner");
  for (const name of ["Discover", "Talentos salvos", "Criar perfil"])
    await expect(banner.getByRole("link", { name })).toBeHidden();

  await page.goto("/discover");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdiscover$/);
});

test("a company sees the developer's profile from this browser as a regular candidate", async ({
  page,
}) => {
  await signInAs(page, "developer");
  // teste.dev opens on its published profile; edit it from the form.
  await page.getByRole("button", { name: "Voltar à edição" }).click();
  await page.getByLabel("Nome completo").fill("Diego Fernandes");
  await page.getByRole("button", { name: "4 Links" }).click();
  await page.getByRole("button", { name: "Concluir perfil" }).click();
  await page.getByRole("button", { name: "Ver como card" }).click();
  // The developer still sees it as their own.
  await expect(page.getByRole("article")).toContainText("Seu perfil");
  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  await signInAs(page, "company");
  const card = page.locator("main section article").first();
  await expect(card).toContainText("Diego Fernandes");
  await expect(card).not.toContainText("Seu perfil");

  await card.getByRole("link", { name: "Ver perfil" }).click();
  await expect(page).toHaveURL(/\/developer\/local-profile$/);
  await expect(page.getByRole("heading", { level: 1, name: "Diego Fernandes" })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Seu perfil");
  await expect(page.getByRole("button", { name: "Propor reunião" })).toBeVisible();
});
