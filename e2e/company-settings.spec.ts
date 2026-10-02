import { expect, signInAs, test } from "./fixtures";

test("a company edits its contact details and developers see them", async ({ page }) => {
  await signInAs(page, "company");
  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Dados da empresa" }).click();
  await expect(page).toHaveURL(/\/company-settings$/);

  // Registration details are shown for reference only.
  const registration = page.getByRole("region", { name: "Dados do cadastro" });
  await expect(registration).toContainText("Empresa Teste");
  await expect(registration).toContainText("11.222.333/0001-81");
  await expect(registration).toContainText("teste.emp@stackmatch.app");
  await expect(registration.getByRole("textbox")).toHaveCount(0);

  // Starts from the sign-up details; nothing to save until something changes.
  const contactName = page.getByLabel("Nome do colaborador de contato");
  await expect(contactName).toHaveValue("Recrutadora Teste");
  const save = page.getByRole("button", { name: "Salvar alterações" });
  await expect(save).toBeDisabled();

  const contactEmail = page.getByLabel("E-mail de contato");
  await contactEmail.fill("carla@");
  await save.click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();

  await contactName.fill("Carla Dias");
  await contactEmail.fill("carla@empresateste.com.br");
  await page.getByLabel("Site (opcional)").fill("empresateste.com.br");
  await expect(page.getByRole("complementary")).toContainText(
    "Contato: Carla Dias · Tech Recruiter",
  );
  await save.click();
  await expect(page.getByText("Dados da empresa salvos")).toBeVisible();
  await expect(save).toBeDisabled();

  await page.reload();
  await expect(contactName).toHaveValue("Carla Dias");

  // Interest marked in Discover is signed with the new contact.
  await page.goto("/discover");
  await page.getByRole("button", { name: "Interessado" }).click();
  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  await signInAs(page, "developer");
  await page.getByRole("banner").getByRole("link", { name: "Empresas interessadas" }).click();
  const company = page.getByRole("main").getByRole("listitem").filter({ hasText: "Empresa Teste" });
  await expect(company).toContainText("Contato: Carla Dias");
  await expect(company.getByRole("link", { name: "Responder por e-mail" })).toHaveAttribute(
    "href",
    /^mailto:carla@empresateste\.com\.br\?/,
  );
});

test("developers can't open the company details", async ({ page }) => {
  await signInAs(page, "developer");
  await page.goto("/company-settings");
  await expect(page.getByRole("heading", { name: "Área para contas de empresa" })).toBeVisible();
});
