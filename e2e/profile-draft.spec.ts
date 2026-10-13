import type { Page } from "@playwright/test";
import { confirmEmail, expect, signInAs, test, uniqueEmail } from "./fixtures";

const draftKey = "stackmatch-profile-draft:demo-developer";

/** Opens the test developer's form and changes the bio, waiting for the draft to be kept. */
async function editBio(page: Page, bio: string) {
  await page.getByRole("button", { name: "Voltar à edição" }).click();
  await page.getByLabel("Bio profissional").fill(bio);
  await expect(page.getByText(/^Alterações não publicadas\./)).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), draftKey))
    .toContain(bio);
}

const banner = (page: Page) =>
  page.getByRole("region", { name: "Você tem um rascunho não publicado" });

test("leaving with unpublished changes asks, and the draft comes back without being published", async ({
  page,
}) => {
  await signInAs(page, "developer");
  await editBio(page, "Rascunho: interfaces acessíveis e design systems.");

  const jobs = page.getByRole("navigation").getByRole("link", { name: "Vagas" });
  const leave = page.getByRole("dialog", { name: "Sair sem publicar?" });
  await jobs.click();
  await leave.getByRole("button", { name: "Continuar editando" }).click();
  await expect(page).toHaveURL(/\/create-profile$/);
  await expect(page.getByLabel("Bio profissional")).toHaveValue(
    "Rascunho: interfaces acessíveis e design systems.",
  );
  await jobs.click();
  await leave.getByRole("button", { name: "Sair sem publicar" }).click();
  await page.waitForURL(/\/job-board$/);

  // Companies still see the published profile.
  await page.goto("/developer/demo-developer");
  await expect(page.getByRole("heading", { level: 1, name: "Gabriel Botelho" })).toBeVisible();
  await expect(page.getByText("Rascunho: interfaces acessíveis")).toHaveCount(0);

  await page.goto("/create-profile");
  await banner(page).getByRole("button", { name: "Recuperar rascunho" }).click();
  await expect(page.getByLabel("Bio profissional")).toHaveValue(
    "Rascunho: interfaces acessíveis e design systems.",
  );
  await expect(banner(page)).toHaveCount(0);
  await page.getByRole("button", { name: "4 Links" }).click();
  await page.getByRole("button", { name: "Concluir perfil" }).click();
  await expect(page.getByText("Perfil salvo!").first()).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key), draftKey))
    .toBeNull();
});

test("after a reload the draft can be discarded", async ({ page }) => {
  // The browser asks before reloading a page with unpublished changes.
  page.on("dialog", (dialog) => void dialog.accept());
  await signInAs(page, "developer");
  await editBio(page, "Bio que vou descartar.");
  await page.reload();
  await expect(banner(page)).toContainText("Alterações feitas neste navegador em");
  await banner(page).getByRole("button", { name: "Descartar rascunho" }).click();
  await expect(banner(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Voltar à edição" }).click();
  await expect(page.getByLabel("Bio profissional")).not.toHaveValue("Bio que vou descartar.");
  await page.reload();
  await expect(page.getByRole("button", { name: "Voltar à edição" })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test("a draft older than the saved profile warns, and finishing it asks which version stays", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await signInAs(page, "developer");
  await editBio(page, "Bio do rascunho antigo.");

  // Another tab publishes a change meanwhile; it doesn't touch the draft.
  const other = await page.context().newPage();
  await other.goto("/create-profile");
  await expect(banner(other)).toBeVisible();
  await other.getByRole("button", { name: "Voltar à edição" }).click();
  await other.getByLabel("Cargo").fill("Staff Engineer");
  await other.getByRole("button", { name: "4 Links" }).click();
  await other.getByRole("button", { name: "Concluir perfil" }).click();
  await expect(other.getByText("Perfil salvo!").first()).toBeVisible();
  await other.close();

  await page.reload();
  await expect(banner(page)).toContainText("Seu perfil foi salvo depois deste rascunho");
  await banner(page).getByRole("button", { name: "Recuperar rascunho" }).click();
  await page.getByRole("button", { name: "4 Links" }).click();
  await page.getByRole("button", { name: "Concluir perfil" }).click();
  const conflict = page.getByRole("alert").filter({ hasText: "salvo em outra aba" });
  await expect(conflict).toBeVisible();
  await conflict.getByRole("button", { name: "Salvar minhas alterações" }).click();
  await expect(page.getByText("Perfil salvo!").first()).toBeVisible();
  await expect(page.getByText("Bio do rascunho antigo.")).toBeVisible();
});

test("signing out asks and deletes the draft; a session ended elsewhere keeps it for the same account only", async ({
  page,
}) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await signInAs(page, "developer");
  await editBio(page, "Rascunho que fica.");

  // The session ends without signing out here (expired, or another tab): the draft stays.
  await page.context().clearCookies();
  await signInAs(page, "developer");
  await expect(banner(page)).toBeVisible();

  // Another account never sees it.
  await page.context().clearCookies();
  await page.goto("/register?type=developer");
  const form = page.getByRole("main");
  await form.getByLabel("Nome completo").fill("Rita Prado");
  await form.getByLabel("Cargo profissional").fill("QA Engineer");
  await form.getByLabel("E-mail").fill(uniqueEmail("rita@example.com"));
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
  await confirmEmail(page);
  await expect(page.getByLabel("Nome completo")).toHaveValue("Rita Prado");
  await expect(banner(page)).toHaveCount(0);

  await page.context().clearCookies();
  await signInAs(page, "developer");
  await banner(page).getByRole("button", { name: "Recuperar rascunho" }).click();
  const menu = page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" });
  const ask = page.getByRole("dialog", { name: "Sair sem publicar?" });
  await menu.click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(ask).toContainText("Ao sair da conta, o rascunho é apagado deste navegador.");
  await ask.getByRole("button", { name: "Continuar editando" }).click();
  await expect(page).toHaveURL(/\/create-profile$/);
  await expect(menu).toBeVisible();

  await menu.click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await ask.getByRole("button", { name: "Sair e descartar" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  expect(await page.evaluate((key) => window.localStorage.getItem(key), draftKey)).toBeNull();
  await signInAs(page, "developer");
  await expect(page.getByRole("button", { name: "Voltar à edição" })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});
