import type { Page } from "@playwright/test";
import { expect, interceptServerFn, lastEmail, signInAs, test } from "./fixtures";

/** The test company publishes a job in the job board; its page's URL. */
async function publishJob(page: Page, title: string) {
  await signInAs(page, "company");
  await page.goto("/jobs/new");
  await page.getByLabel("Título").fill(title);
  await page.getByRole("button", { name: "Criar vaga" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.url();
}

/** The test developer applies for the job from the job board. */
async function applyFor(page: Page, title: string, message: string) {
  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/job-board");
  const job = page.getByRole("article", { name: title });
  await job.getByRole("button", { name: `Quero participar: ${title}` }).click();
  await page.getByRole("dialog").getByLabel("Mensagem (opcional)").fill(message);
  await page.getByRole("dialog").getByRole("button", { name: "Enviar" }).click();
  await expect(job.getByText(/^Você se ofereceu em/)).toBeVisible();
}

test("a developer follows an application the company ends, never seeing its note", async ({
  page,
}) => {
  const jobUrl = await publishJob(page, "Plataforma de Pagamentos");
  await applyFor(page, "Plataforma de Pagamentos", "Trabalhei com Pix por dois anos.");
  await page.getByRole("navigation").getByRole("link", { name: "Candidaturas" }).click();
  const application = page.getByRole("listitem", { name: "Plataforma de Pagamentos" });
  await expect(application.getByText("Enviada", { exact: true })).toBeVisible();
  await expect(application).toContainText("Empresa Teste");
  await expect(application).toContainText("Trabalhei com Pix por dois anos.");

  // The company keeps a private note and ends the process for them.
  await page.context().clearCookies();
  await signInAs(page, "company");
  await page.goto(jobUrl);
  await page.getByRole("button", { name: "Nota privada sobre Gabriel Botelho" }).click();
  await page.getByRole("dialog").getByLabel("Nota privada").fill("Pretensão acima da faixa.");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar nota" }).click();
  await expect(page.getByText("Pretensão acima da faixa.")).toBeVisible();
  await page.getByLabel("Etapa: Gabriel Botelho").selectOption({ label: "Não avançaram" });
  await page.getByRole("button", { name: "Histórico de Gabriel Botelho nesta vaga" }).click();
  await expect(page.getByRole("dialog")).toContainText("Etapa: Salvos → Não avançaram");
  await expect(page.getByRole("dialog")).toContainText("Candidatou-se à vaga");
  const notice = await lastEmail(page, "teste.dev@example.com");
  expect(notice.subject).toBe("Atualização da sua candidatura: Plataforma de Pagamentos");
  expect(notice.text).not.toContain("Pretensão");

  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/applications");
  await expect(application.getByText("Não avançou", { exact: true })).toBeVisible();
  await expect(application).toContainText("Resultado: não avançou");
  await expect(application.getByRole("button", { name: "Retirar candidatura" })).toHaveCount(0);
  await expect(page.getByText("Pretensão acima da faixa.")).toHaveCount(0);
});

test("withdrawing an application asks first, is final and tells the company", async ({ page }) => {
  const jobUrl = await publishJob(page, "Squad de Growth");
  await applyFor(page, "Squad de Growth", "");
  await page.goto("/applications");
  const application = page.getByRole("listitem", { name: "Squad de Growth" });

  // Canceling the confirmation keeps it.
  await application.getByRole("button", { name: "Retirar candidatura" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toContainText("não poderá se candidatar de novo à vaga Squad de Growth");
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(application.getByText("Enviada", { exact: true })).toBeVisible();

  await application.getByRole("button", { name: "Retirar candidatura" }).click();
  await confirm.getByRole("button", { name: "Retirar candidatura" }).click();
  await expect(application.getByText("Retirada", { exact: true })).toBeVisible();
  await expect(application).toContainText("Candidatura retirada");
  await expect(application.getByRole("button", { name: "Retirar candidatura" })).toHaveCount(0);
  const email = await lastEmail(page, "teste.emp@example.com");
  expect(email.subject).toBe("Gabriel Botelho retirou a candidatura para a vaga Squad de Growth");

  // The job board can't take a new one.
  await page.goto("/job-board");
  const job = page.getByRole("article", { name: "Squad de Growth" });
  await expect(job.getByText(/^Você retirou sua candidatura em/)).toBeVisible();
  await expect(job.getByRole("button", { name: /Quero participar/ })).toHaveCount(0);

  // The company still has them in the job, marked.
  await page.context().clearCookies();
  await signInAs(page, "company");
  await page.goto(jobUrl);
  await expect(page.getByText(/^Retirou a candidatura em/)).toBeVisible();
});

test("my applications show a loading error with a retry instead of an empty list", async ({
  page,
}) => {
  await signInAs(page, "developer");
  const failing = await interceptServerFn(page, "fetchMyApplications", "fail");
  await page.goto("/applications");
  // After the query's own retries.
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar suas candidaturas.",
    { timeout: 20_000 },
  );
  await expect(page.getByText("Você ainda não se candidatou a nenhuma vaga.")).toBeHidden();
  await failing.stop();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Você ainda não se candidatou a nenhuma vaga.")).toBeVisible();
});
