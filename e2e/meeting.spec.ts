import type { Page } from "@playwright/test";
import { confirmEmail, expect, lastEmail, signInAs, test, uniqueEmail } from "./fixtures";

// Thursday noon in Brasília, so the next day (Friday) has every time open. The server checks the
// proposed time against its own clock, so the browser's is set to a date still ahead.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2030-10-03T12:00:00-03:00"));
});

async function registerCompany(page: Page, email: string) {
  await page.goto("/register?type=company");
  const form = page.getByRole("main");
  await form.getByLabel("Nome completo").fill("Bia Santos");
  await form.getByLabel("Empresa").fill("Acme");
  await form.getByLabel("CNPJ").fill("11222333000181");
  await form.getByLabel("E-mail").fill(email);
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
  await confirmEmail(page);
  await expect(page).toHaveURL(/\/discover$/);
}

test("asks visitors to sign in before proposing a meeting", async ({ page }) => {
  await page.goto("/developer/marina-costa");
  await page.getByRole("button", { name: "Propor reunião" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Entre para enviar a proposta")).toBeVisible();
  await dialog.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdeveloper%2Fmarina-costa$/);
});

test("a company proposes one time and sees the e-mail the developer will get", async ({ page }) => {
  const email = uniqueEmail("bia@acme.com");
  await registerCompany(page, email);
  await page.goto("/developer/marina-costa");
  await page.getByRole("button", { name: "Propor reunião" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.locator('[data-day="04/10/2030"]').click();
  // 10:30 on Friday is still ahead; earlier times today would be disabled.
  await dialog.getByRole("button", { name: "10:30" }).click();
  await dialog.getByRole("button", { name: "Continuar" }).click();

  await dialog.getByLabel(/Sobre a oportunidade/).fill("Projeto de dashboard em React.");
  const preview = dialog.getByRole("region", { name: "Prévia do e-mail" });
  await expect(preview).toContainText("Acme quer conversar com você pelo StackMatch");
  await expect(preview).toContainText(email);
  await expect(preview).toContainText("sexta-feira, 4 de outubro, às 10:30");
  await expect(preview).toContainText("Projeto de dashboard em React.");

  await dialog.getByRole("button", { name: "Enviar proposta" }).click();
  await expect(dialog.getByRole("heading", { name: "Proposta enviada" })).toBeVisible();
  await expect(dialog).toContainText(`As respostas chegam em ${email}`);
  await expect(dialog).toContainText("Marina Costa recebeu a proposta por e-mail");
  await dialog.getByRole("button", { name: "Concluir" }).click();

  // The e-mail Marina gets says what the preview showed, and replies go to the company.
  const sent = await lastEmail(page, "marina-costa@example.com");
  expect(sent.subject).toBe("Acme quer conversar com você pelo StackMatch");
  expect(sent.replyTo).toBe(email);
  expect(sent.text).toContain("sexta-feira, 4 de outubro, às 10:30");
  expect(sent.text).toContain("Projeto de dashboard em React.");

  // The proposal is remembered, but another one can still be sent.
  await page.getByRole("button", { name: "Propor reunião" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Você já enviou uma proposta para este profissional (sexta-feira, 4 de outubro, às 10:30, aguardando resposta)",
  );
});

test("developer accounts can't send proposals", async ({ page }) => {
  await page.goto("/register");
  const form = page.getByRole("main");
  await form.getByText("Sou desenvolvedor").click();
  await form.getByLabel("Nome completo").fill("Ana Souza");
  await form.getByLabel("Cargo profissional").fill("Frontend Developer");
  await form.getByLabel("E-mail").fill(uniqueEmail("ana@example.com"));
  await form.getByLabel("Senha", { exact: true }).fill("segredo123");
  await form.getByLabel(/Li e aceito/).check();
  await form.getByRole("button", { name: "Criar conta" }).click();
  await confirmEmail(page);
  await expect(page).toHaveURL(/\/create-profile$/);

  await page.goto("/developer/marina-costa");
  await page.getByRole("button", { name: "Propor reunião" }).click();
  await expect(page.getByRole("dialog")).toContainText("Disponível para contas de empresa");
});

test("a company can't flood the same developer with proposals", async ({ page }) => {
  await signInAs(page, "company");
  await page.goto("/developer/marina-costa");
  const dialog = page.getByRole("dialog");
  const propose = async (time: string) => {
    await page.getByRole("button", { name: "Propor reunião" }).click();
    await dialog.locator('[data-day="04/10/2030"]').click();
    await dialog.getByRole("button", { name: time }).click();
    await dialog.getByRole("button", { name: "Continuar" }).click();
    await dialog.getByRole("button", { name: "Enviar proposta" }).click();
  };

  for (const time of ["09:00", "10:30", "14:00"]) {
    await propose(time);
    await expect(dialog.getByRole("heading", { name: "Proposta enviada" })).toBeVisible();
    await dialog.getByRole("button", { name: "Concluir" }).click();
  }

  // The fourth in a week is refused, and Marina's last e-mail is still the third proposal.
  await propose("15:30");
  await expect(
    page.getByText("Você já enviou 3 propostas para esta pessoa nos últimos 7 dias."),
  ).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Proposta enviada" })).toBeHidden();
  expect((await lastEmail(page, "marina-costa@example.com")).text).toContain("às 14:00");
});

test("the developer suggests another time, the company accepts it and then cancels", async ({
  page,
}) => {
  await signInAs(page, "company");
  await page.goto("/developer/demo-developer");
  await page.getByRole("button", { name: "Propor reunião" }).click();
  const proposal = page.getByRole("dialog");
  await proposal.locator('[data-day="04/10/2030"]').click();
  await proposal.getByRole("button", { name: "10:30" }).click();
  await proposal.getByRole("button", { name: "Continuar" }).click();
  await proposal.getByRole("button", { name: "Enviar proposta" }).click();
  await proposal.getByRole("button", { name: "Concluir" }).click();

  // The developer can't make it and suggests Monday instead.
  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/interests");
  // The card, not the lists inside it.
  const fromCompany = page.getByRole("listitem").filter({ hasText: "Empresa Teste" }).first();
  await fromCompany.getByRole("button", { name: "Sugerir outro horário" }).click();
  const reschedule = page.getByRole("dialog");
  await reschedule.locator('[data-day="07/10/2030"]').click();
  await reschedule.getByRole("button", { name: "14:00" }).click();
  await reschedule.getByLabel("Mensagem (opcional)").fill("Na sexta estou viajando.");
  await reschedule.getByRole("button", { name: "Enviar novo horário" }).click();
  await expect(fromCompany.getByText("Aguardando resposta de Empresa Teste")).toBeVisible();
  await expect(fromCompany.getByText("Novo horário sugerido por você")).toBeVisible();
  await expect(fromCompany).toContainText("7 de outubro, às 14:00");
  const suggested = await lastEmail(page, "teste.emp@example.com");
  expect(suggested.subject).toBe("Gabriel Botelho sugeriu um novo horário para a conversa");
  expect(suggested.text).toContain("> Na sexta estou viajando.");

  // The company answers the new time in its sent proposals.
  await page.context().clearCookies();
  await signInAs(page, "company");
  await page.goto("/proposals");
  const sent = page.getByRole("article", { name: "Gabriel Botelho" });
  await expect(sent).toContainText("Novo horário para você responder");
  await expect(sent).toContainText("Na sexta estou viajando.");
  await sent.getByRole("button", { name: "Aceitar" }).click();
  await expect(sent.getByText("Você aceitou este horário")).toBeVisible();
  const accepted = await lastEmail(page, "teste.dev@example.com");
  expect(accepted.subject).toBe("Empresa Teste aceitou o horário que você sugeriu");
  expect(accepted.attachments).toEqual(["conversa-stackmatch.ics"]);

  // Then the company cancels it, saying why.
  await sent.getByRole("button", { name: "Cancelar" }).click();
  const cancel = page.getByRole("dialog");
  await cancel.getByLabel("Mensagem (opcional)").fill("A vaga foi preenchida.");
  await cancel.getByRole("button", { name: "Cancelar conversa" }).click();
  await expect(sent.getByText("Você cancelou esta conversa")).toBeVisible();
  await expect(sent.getByRole("button", { name: "Remarcar" })).toBeHidden();
  const canceled = await lastEmail(page, "teste.dev@example.com");
  expect(canceled.subject).toBe("Empresa Teste cancelou a conversa");

  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/interests");
  await expect(page.getByText("Conversa cancelada por Empresa Teste")).toBeVisible();
  await expect(page.getByText("A vaga foi preenchida.")).toBeVisible();
});
