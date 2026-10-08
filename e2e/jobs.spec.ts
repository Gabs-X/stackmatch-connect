import { expect, lastEmail, signInAs, test } from "./fixtures";

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
  // She has TypeScript, is senior and remote: everything the job asks for.
  await expect(card).toContainText("100% compatível");
  await page.getByRole("button", { name: "Interessado" }).click();
  await expect(page.getByText("Você chegou ao fim da lista")).toBeVisible();
  // A new round leaves out who is already in the job.
  await page.getByRole("button", { name: "Rever perfis" }).click();
  await expect(page.getByText("Todos estes perfis já estão na vaga")).toBeVisible();

  // The job page has her at "showed interest"; moving her by hand sticks.
  await page.getByRole("link", { name: "Ver vaga" }).click();
  const stage = page.getByLabel("Etapa: Marina Costa");
  await expect(stage).toHaveValue("interest");
  await expect(page.getByRole("main").getByRole("article")).toContainText("100% compatível");
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
  // A job without criteria has nothing to compare.
  await expect(page.getByText("A vaga não define critérios para comparar.")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar à vaga" }).click();
  await expect(page.getByRole("link", { name: "Na vaga · Salvos" })).toBeVisible();
  await page.getByRole("link", { name: "Voltar à vaga" }).click();
  await expect(page.getByLabel("Etapa: Rafael Lima")).toHaveValue("saved");
});

test("a proposal from a job tells the developer what the job is about", async ({ page }) => {
  // Thursday noon in Brasília, so Friday has every time open (see meeting.spec.ts).
  await page.clock.setFixedTime(new Date("2030-10-03T12:00:00-03:00"));
  await signInAs(page, "company");
  await page.goto("/jobs/new");
  await page.getByLabel("Título").fill("Full Stack Pleno");
  await page.getByLabel("Skills obrigatórias").fill("Node.js");
  await page.getByLabel("Skills obrigatórias").press("Enter");
  await page.getByRole("button", { name: "Criar vaga" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Full Stack Pleno" })).toBeVisible();
  const jobId = page.url().split("/").at(-1) ?? "";

  await page.goto(`/developer/demo-developer?job=${jobId}`);
  await page.getByRole("button", { name: "Propor reunião" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[data-day="04/10/2030"]').click();
  await dialog.getByRole("button", { name: "10:30" }).click();
  await dialog.getByRole("button", { name: "Continuar" }).click();
  const preview = dialog.getByRole("region", { name: "Prévia do e-mail" });
  await expect(preview).toContainText("Vaga: Full Stack Pleno");
  await dialog.getByRole("button", { name: "Enviar proposta" }).click();
  await expect(dialog.getByRole("heading", { name: "Proposta enviada" })).toBeVisible();
  await dialog.getByRole("button", { name: "Concluir" }).click();

  const sent = await lastEmail(page, "teste.dev@example.com");
  expect(sent.text).toContain("Vaga: Full Stack Pleno");
  expect(sent.text).toContain("Skills obrigatórias: Node.js");
  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByLabel("Etapa: Gabriel Botelho")).toHaveValue("contacted");

  // The developer sees the job with the company that reached them.
  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/interests");
  const job = page.getByRole("main").getByText("Sobre a vaga").locator("..");
  await expect(job).toContainText("Full Stack Pleno");
  await page.getByText("Ver detalhes").click();
  await expect(page.getByRole("main")).toContainText("Skills obrigatórias");

  // Accepting tells the company and schedules the call in the job.
  const company = page.getByRole("listitem").filter({ hasText: "Empresa Teste" });
  await company.getByRole("button", { name: "Aceitar" }).click();
  await expect(company.getByText("Você aceitou este horário")).toBeVisible();
  const answer = await lastEmail(page, "teste.emp@example.com");
  expect(answer.subject).toBe("Gabriel Botelho aceitou a conversa pelo StackMatch");
  await page.context().clearCookies();
  await signInAs(page, "company");
  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByLabel("Etapa: Gabriel Botelho")).toHaveValue("meeting");
});

test("a developer the company reached offers themselves for one of its jobs", async ({ page }) => {
  await signInAs(page, "company");
  await page.goto("/jobs/new");
  await page.getByLabel("Título").fill("Mobile Pleno");
  await page.getByRole("button", { name: "Criar vaga" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mobile Pleno" })).toBeVisible();
  const jobUrl = page.url();
  // Reaching him outside the job is enough for him to see the company's open jobs.
  await page.goto("/discover");
  await expect(page.locator("main section article").first()).toContainText("Gabriel Botelho");
  await page.getByRole("button", { name: "Interessado" }).click();
  await expect(page.locator("main section article").first()).not.toContainText("Gabriel Botelho");

  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/interests");
  await page
    .getByRole("listitem")
    .filter({ hasText: "Empresa Teste" })
    .getByRole("link", { name: "Ver empresa" })
    .click();
  const jobs = page.getByRole("region", { name: "Vagas abertas" });
  await expect(jobs).toContainText("Mobile Pleno");
  await jobs.getByRole("button", { name: "Quero participar: Mobile Pleno" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mensagem (opcional)").fill("Trabalho com React Native há 3 anos.");
  await dialog.getByRole("button", { name: "Enviar" }).click();
  await expect(jobs.getByText(/^Você se ofereceu em/)).toBeVisible();

  const email = await lastEmail(page, "teste.emp@example.com");
  expect(email.subject).toBe("Gabriel Botelho se ofereceu para a vaga Mobile Pleno");
  expect(email.text).toContain("> Trabalho com React Native há 3 anos.");

  await page.context().clearCookies();
  await signInAs(page, "company");
  await page.goto(jobUrl);
  await expect(page.getByLabel("Etapa: Gabriel Botelho")).toHaveValue("saved");
  await expect(page.getByRole("main")).toContainText("Trabalho com React Native há 3 anos.");
  await expect(page.getByText(/^Se ofereceu em/)).toBeVisible();
});
