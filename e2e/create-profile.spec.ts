import { fileURLToPath } from "node:url";
import { expect, signInAs, test, uniqueEmail } from "./fixtures";

test("a completed profile previews the card companies see in Discover", async ({ page }) => {
  await signInAs(page, "developer");
  // teste.dev opens on its published profile; edit it from the form.
  await page.getByRole("button", { name: "Voltar à edição" }).click();

  // Step 1: personal info.
  await page.getByLabel("Nome completo").fill("Ana Souza");
  await page.getByLabel("Cargo").fill("Frontend Developer");
  await page.getByLabel("Localização").fill("Recife, PE");
  await page.getByLabel("Senioridade").selectOption("Pleno");
  await page.getByLabel("Modelo de trabalho").selectOption("Remoto");
  await page.getByLabel("Disponibilidade").selectOption("Disponível agora");
  // Answers Discover filters on; only digits are kept.
  await page.getByLabel("Anos de experiência").fill("4");
  const rate = page.getByLabel("Valor por hora (R$)");
  await rate.fill("R$ 95");
  await expect(rate).toHaveValue("95");
  const clt = page.getByRole("button", { name: "CLT", exact: true });
  await clt.click();
  await expect(clt).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Bio profissional").fill("Desenvolvo interfaces acessíveis.");
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

  await expect(page.getByRole("heading", { level: 1, name: "Ana Souza" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo" })).toHaveAttribute(
    "href",
    "https://clinic-booking.vercel.app/",
  );

  // Developers don't browse Discover, so the preview can swap the profile for their card.
  await page.getByRole("button", { name: "Ver como card" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ana Souza" })).toBeHidden();
  const card = page.getByRole("region", { name: "Seu card no Discover" }).getByRole("article");
  await expect(card).toContainText("Ana Souza");
  await expect(card).toContainText("Seu perfil");
  await expect(card).toContainText("4 anos");
  await expect(card.getByRole("img")).toHaveAttribute(
    "src",
    "https://github.com/anasouza.png?size=768",
  );

  await page.getByRole("button", { name: "Ver perfil completo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ana Souza" })).toBeVisible();
  await expect(card).toBeHidden();
});

test("removing a project can be undone", async ({ page }) => {
  await signInAs(page, "developer");
  // teste.dev opens on its published profile; edit it from the form.
  await page.getByRole("button", { name: "Voltar à edição" }).click();
  await page.getByRole("button", { name: "Projetos" }).click();

  await page.getByRole("button", { name: "Remover Atlas CRM" }).click();
  await expect(page.getByRole("button", { name: "Remover Atlas CRM" })).toBeHidden();

  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("button", { name: "Remover Atlas CRM" })).toBeVisible();
});

test("required fields block the next step until they are filled", async ({ page }) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Voltar à edição" }).click();
  await page.getByLabel("Localização").fill("");
  await page.getByLabel("Bio profissional").fill("");

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("ETAPA 1 DE 4")).toBeVisible();
  await expect(page.getByText("Preencha os campos obrigatórios para continuar.")).toBeVisible();
  await expect(page.getByLabel("Localização")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Localização")).toBeFocused();
  await expect(page.getByText("Preencha este campo.")).toHaveCount(2);

  // Jumping ahead from the step list is held back the same way.
  await page.getByRole("button", { name: "4 Links" }).click();
  await expect(page.getByText("ETAPA 1 DE 4")).toBeVisible();

  await page.getByLabel("Localização").fill("Uberaba, MG");
  await page.getByLabel("Bio profissional").fill("Desenvolvo aplicações full stack.");
  await expect(page.getByText("Preencha este campo.")).toHaveCount(0);

  // Step 2 needs at least one skill.
  await page.getByRole("button", { name: "Continuar" }).click();
  for (const skill of ["React", "Next.js", "Node.js", "NestJS", "C#", "PostgreSQL"])
    await page.getByRole("button", { name: skill, exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Adicione pelo menos uma skill.")).toBeVisible();
  await expect(page.getByText("ETAPA 2 DE 4")).toBeVisible();
});

test("a developer can publish a profile without projects", async ({ page }) => {
  await page.goto("/register?type=developer");
  const form = page.getByRole("main");
  await form.getByLabel("Nome completo").fill("Rita Prado");
  await form.getByLabel("Cargo profissional").fill("QA Engineer");
  await form.getByLabel("E-mail").fill(uniqueEmail("rita@example.com"));
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/create-profile$/);

  await page.getByLabel("Localização").fill("Natal, RN");
  await page.getByLabel("Senioridade").selectOption("Júnior");
  await page.getByLabel("Modelo de trabalho").selectOption("Remoto");
  await page.getByLabel("Disponibilidade").selectOption("Em 15 dias");
  await page.getByLabel("Bio profissional").fill("Testo aplicações web e mobile.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText(/Projetos são opcionais/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar sem projetos" }).click();
  await page.getByRole("button", { name: "Concluir perfil" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Rita Prado" })).toBeVisible();
});

test("a profile photo replaces the GitHub avatar for companies too", async ({ page }) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Voltar à edição" }).click();

  // Without an upload, the preview shows the GitHub avatar.
  const preview = page.getByRole("img", { name: "Prévia da foto do perfil" });
  await expect(preview).toHaveAttribute("src", /github\.com\/Gabs-X\.png/);
  await page
    .getByLabel("Foto do perfil")
    .setInputFiles(fileURLToPath(new URL("./github-avatar.jpg", import.meta.url)));
  // Cropped and downscaled in the browser.
  await expect(preview).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  await expect(page.getByRole("button", { name: "Trocar foto" })).toBeVisible();

  await page.getByRole("button", { name: "4 Links" }).click();
  await page.getByRole("button", { name: "Concluir perfil" }).click();
  await expect(page.getByText("Perfil salvo!").first()).toBeVisible();
  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();

  await signInAs(page, "company");
  await expect(
    page
      .locator("main section article")
      .first()
      .getByRole("img", { name: "Foto de Gabriel Botelho" }),
  ).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
});

test("removing the photo goes back to the GitHub avatar", async ({ page }) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Voltar à edição" }).click();
  await page
    .getByLabel("Foto do perfil")
    .setInputFiles(fileURLToPath(new URL("./github-avatar.jpg", import.meta.url)));
  await page.getByRole("button", { name: "Remover foto" }).click();
  await expect(page.getByRole("img", { name: "Prévia da foto do perfil" })).toHaveAttribute(
    "src",
    /github\.com\/Gabs-X\.png/,
  );
  await expect(page.getByRole("button", { name: "Escolher foto" })).toBeVisible();
});
