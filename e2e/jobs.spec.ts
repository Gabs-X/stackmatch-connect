import { expect, signInAs, test } from "./fixtures";

test("a job searches Discover with its filters and keeps who the company reached", async ({
  page,
}) => {
  await signInAs(page, "company");
  await page.goto("/jobs");
  await expect(page.getByText("Você ainda não criou nenhuma vaga.")).toBeVisible();
  await page.getByRole("link", { name: "Nova vaga" }).first().click();

  // The title is the only required field.
  await page.getByRole("button", { name: "Criar vaga" }).click();
  await expect(page.getByText("Dê um título à vaga.")).toBeVisible();
  await page.getByLabel("Título").fill("Front-end Sênior");
  await page.getByLabel("Skills obrigatórias").fill("TypeScript");
  await page.getByLabel("Skills obrigatórias").press("Enter");
  const profile = page.getByRole("group", { name: "Senioridade" });
  await profile.getByRole("button", { name: "Sênior" }).click();
  await page
    .getByRole("group", { name: "Modelo de trabalho" })
    .getByRole("button", { name: "Remoto" })
    .click();
  await page.getByLabel("Mínimo (R$)").fill("9000");
  await page.getByLabel("Máximo (R$)").fill("R$ 8.000");
  await page.getByRole("button", { name: "Criar vaga" }).click();
  await expect(page.getByText("O valor máximo não pode ser menor que o mínimo.")).toBeVisible();
  await page.getByLabel("Máximo (R$)").fill("12000");
  await page.getByRole("button", { name: "Criar vaga" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Front-end Sênior" })).toBeVisible();
  await expect(page.getByText("R$ 9.000 – R$ 12.000 por mês")).toBeVisible();
  await expect(page.getByText("Ninguém nesta vaga ainda.")).toBeVisible();

  // Discover starts from the job's filters: TypeScript, senior, remote.
  await page.getByRole("link", { name: "Buscar no Discover" }).first().click();
  await expect(page.getByText("Buscando para a vaga")).toBeVisible();
  const card = page.locator("main section article").first();
  await expect(card).toContainText("Marina Costa");
  await expect(page.getByText(/^1 de 1 perfil/)).toBeVisible();
  await page.getByRole("button", { name: "Interessado" }).click();
  await expect(page.getByText("Você chegou ao fim da lista")).toBeVisible();
  // A new round leaves out who is already in the job.
  await page.getByRole("button", { name: "Rever perfis" }).click();
  await expect(page.getByText("Todos estes perfis já estão na vaga")).toBeVisible();

  // The job page has her at "showed interest"; moving her by hand sticks.
  await page.getByRole("link", { name: "Ver vaga" }).click();
  const stage = page.getByLabel("Etapa: Marina Costa");
  await expect(stage).toHaveValue("interest");
  await stage.selectOption({ label: "Conversa agendada" });
  await page.reload();
  await expect(page.getByLabel("Etapa: Marina Costa")).toHaveValue("meeting");

  // Interest inside a job is still interest: she's in the shortlist too.
  await page.goto("/saved");
  await expect(page.getByRole("main").getByRole("article")).toContainText("Marina Costa");

  // The list shows the job with its stage counts.
  await page.goto("/jobs");
  const job = page.getByRole("article").filter({ hasText: "Front-end Sênior" });
  await expect(job).toContainText("Aberta");
  await expect(job.getByRole("definition").nth(3)).toHaveText("1");
});

test("undoing in a job's Discover takes the developer out of the job", async ({ page }) => {
  await signInAs(page, "company");
  await page.goto("/jobs/new");
  await page.getByLabel("Título").fill("Qualquer perfil");
  await page.getByRole("button", { name: "Criar vaga" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Qualquer perfil" })).toBeVisible();
  const jobUrl = page.url();

  await page.getByRole("link", { name: "Buscar no Discover" }).first().click();
  const card = page.locator("main section article").first();
  await expect(card).toBeVisible();
  const name = (await card.getByRole("heading", { level: 2 }).textContent()) ?? "";
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .locator("[data-sonner-toast]")
    .first()
    .getByRole("button", { name: "Desfazer" })
    .click();
  await expect(card).toContainText(name);

  await page.goto(jobUrl);
  await expect(page.getByText("Ninguém nesta vaga ainda.")).toBeVisible();
});

test("a profile opened from a job is added to it and shows its stage", async ({ page }) => {
  await signInAs(page, "company");
  await page.goto("/jobs/new");
  await page.getByLabel("Título").fill("Backend");
  await page.getByRole("button", { name: "Criar vaga" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Backend" })).toBeVisible();
  const jobId = page.url().split("/").at(-1) ?? "";

  await page.goto(`/developer/rafael-lima?job=${jobId}`);
  await page.getByRole("button", { name: "Adicionar à vaga" }).click();
  await expect(page.getByRole("link", { name: "Na vaga · Salvos" })).toBeVisible();
  await page.getByRole("link", { name: "Voltar à vaga" }).click();
  await expect(page.getByLabel("Etapa: Rafael Lima")).toHaveValue("saved");
});
