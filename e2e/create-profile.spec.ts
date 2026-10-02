import { expect, signInAs, test } from "./fixtures";

test("a completed profile shows up first in Discover", async ({ page }) => {
  await signInAs(page, "developer");

  // Step 1: personal info.
  await page.getByLabel("Nome completo").fill("Ana Souza");
  await page.getByLabel("Cargo").fill("Frontend Developer");
  await page.getByLabel("Localização").fill("Recife, PE");
  await page.getByLabel("Senioridade").selectOption("Pleno");
  await page.getByLabel("Modelo de trabalho").selectOption("Remoto");
  await page.getByLabel("Disponibilidade").selectOption("Disponível agora");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 2: skills.
  await page.getByLabel("Tecnologias").fill("Vue");
  await page.getByLabel("Tecnologias").press("Enter");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 3: a project, checking validation on the way.
  await page.getByRole("button", { name: "Adicionar manualmente" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Salvar projeto" }).click();
  await expect(dialog.getByText("Dê um nome ao projeto.")).toBeVisible();

  await dialog.getByLabel("Nome do projeto").fill("Clinic Booking");
  await dialog.getByLabel("Descrição").fill("Agendamento online para clínicas.");
  await dialog.getByLabel("Link da demonstração").fill("not a url ::");
  await expect(dialog.getByText("Informe um endereço válido")).toBeVisible();
  await dialog.getByLabel("Link da demonstração").fill("clinic-booking.vercel.app");
  await dialog.getByRole("button", { name: "+ React" }).click();
  await dialog.getByRole("button", { name: "Salvar projeto" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Clinic Booking" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 4: links, then finish.
  await page.getByLabel("GitHub").fill("github.com/anasouza");
  await page.getByRole("button", { name: "Concluir perfil" }).click();

  await expect(page.getByRole("heading", { name: "Ana Souza" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo" })).toHaveAttribute(
    "href",
    "https://clinic-booking.vercel.app/",
  );

  await page.getByRole("link", { name: "Ver no Discover" }).click();
  const card = page.locator("main section article").first();
  await expect(card).toContainText("Ana Souza");
  await expect(card).toContainText("Seu perfil");
  await expect(card.getByRole("img")).toHaveAttribute(
    "src",
    "https://github.com/anasouza.png?size=768",
  );
});

test("removing a project can be undone", async ({ page }) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Projetos" }).click();
  await page.getByRole("button", { name: "Simular importação do GitHub" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Portfolio/ })
    .click();
  await page.getByRole("button", { name: "Importar selecionados" }).click();

  await page.getByRole("button", { name: "Remover Portfolio" }).click();
  await expect(page.getByRole("button", { name: "Remover Portfolio" })).toBeHidden();

  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("button", { name: "Remover Portfolio" })).toBeVisible();
});
