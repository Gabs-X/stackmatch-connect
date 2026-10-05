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

test("each developer account has its own profile, and companies see them all", async ({ page }) => {
  // A second developer signs up in the same browser and publishes their profile.
  await page.goto("/register?type=developer");
  const form = page.getByRole("main");
  await form.getByLabel("Nome completo").fill("Diego Fernandes");
  await form.getByLabel("Cargo profissional").fill("Backend Developer");
  await form.getByLabel("E-mail").fill("diego@example.com");
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/create-profile$/);
  await page.getByRole("button", { name: "4 Links" }).click();
  await page.getByRole("button", { name: "Concluir perfil" }).click();
  await page.getByRole("button", { name: "Ver como card" }).click();
  await expect(page.getByRole("article")).toContainText("Diego Fernandes");
  await expect(page.getByRole("article")).toContainText("Seu perfil");
  await page.getByRole("button", { name: "Menu da conta de Diego Fernandes" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  // teste.dev still has Gabriel's profile.
  await signInAs(page, "developer");
  await expect(page.getByRole("heading", { level: 1, name: "Gabriel Botelho" })).toBeVisible();
  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  // A company finds both, neither marked as its own.
  await signInAs(page, "company");
  const cards = page.locator("main section article");
  await expect(cards.first()).toContainText("Gabriel Botelho");
  await expect(cards.first()).not.toContainText("Seu perfil");
  await expect(page.getByText(/^1 de 18 perfis$/)).toBeVisible();
  await page.getByRole("button", { name: "Passar" }).click();
  await expect(cards.first()).toContainText("Diego Fernandes");

  await cards.first().getByRole("link", { name: "Ver perfil" }).click();
  await expect(page).toHaveURL(/\/developer\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Diego Fernandes" })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Seu perfil");
  await expect(page.getByRole("button", { name: "Propor reunião" })).toBeVisible();
});

test("signing out always lands on the home page, also from another tab", async ({
  page,
  context,
}) => {
  await signInAs(page, "company");
  await page.goto("/saved");
  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/$/);

  await signInAs(page, "company");
  await page.goto("/saved");
  const other = await context.newPage();
  await other.goto("/login");
  await other.waitForSelector("html[data-hydrated]", { state: "attached" });
  await other.getByRole("button", { name: "Sair" }).click();
  await expect(other).toHaveURL(/\/$/);
  // The first tab follows, instead of falling back to the login.
  await expect(page).toHaveURL(/\/$/);
});
