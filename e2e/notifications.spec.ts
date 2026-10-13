import type { Page } from "@playwright/test";
import { expect, signInAs, test } from "./fixtures";

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
async function applyFor(page: Page, title: string) {
  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/job-board");
  const job = page.getByRole("article", { name: title });
  await job.getByRole("button", { name: `Quero participar: ${title}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Enviar" }).click();
  await expect(job.getByText(/^Você se ofereceu em/)).toBeVisible();
}

async function emailsTo(page: Page, to: string) {
  const response = await page.request.get(`/api/test-emails?to=${encodeURIComponent(to)}`);
  return ((await response.json()) as { subjects?: string[] }).subjects ?? [];
}

test("the company sees an application in its notifications and opens it", async ({ page }) => {
  const jobUrl = await publishJob(page, "Plataforma de Pagamentos");
  await applyFor(page, "Plataforma de Pagamentos");

  await page.context().clearCookies();
  await signInAs(page, "company");
  const bell = page.getByRole("link", { name: /^Notificações/ });
  await expect(bell).toHaveAccessibleName("Notificações (1 não lidas)");
  await bell.click();
  await page.waitForURL(/\/notifications$/);
  const item = page.getByRole("button", {
    name: /Gabriel Botelho se candidatou\. Vaga: Plataforma de Pagamentos\./,
  });
  await expect(item).toContainText("Não lida");
  await item.click();
  await page.waitForURL(jobUrl);
  await expect(bell).toHaveAccessibleName("Notificações");

  await page.goto("/notifications");
  await expect(item).not.toContainText("Não lida");
  await expect(page.getByRole("button", { name: "Marcar todas como lidas" })).toBeDisabled();
});

test("a developer turns off application e-mails and still sees the notification", async ({
  page,
}) => {
  const jobUrl = await publishJob(page, "Back-end Pleno");
  await applyFor(page, "Back-end Pleno");
  await page.goto("/account");
  const applications = page.getByRole("checkbox", { name: /^Candidaturas/ });
  await expect(applications).toBeChecked();
  await applications.uncheck();
  await expect(page.getByText("Preferências salvas.")).toBeVisible();
  await page.reload();
  await expect(applications).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Interesse de empresas" })).toBeChecked();

  // The company ends the application: no e-mail, but the notification is there.
  await page.context().clearCookies();
  await signInAs(page, "company");
  await page.goto(jobUrl);
  await page.getByLabel("Etapa: Gabriel Botelho").selectOption({ label: "Não avançaram" });
  await expect(page.getByLabel("Etapa: Gabriel Botelho")).toHaveValue("not_advanced");

  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/notifications");
  await expect(
    page.getByRole("button", { name: /Sua candidatura na Empresa Teste não avançou\./ }),
  ).toBeVisible();
  expect(await emailsTo(page, "teste.dev@example.com")).not.toContain(
    "Atualização da sua candidatura: Back-end Pleno",
  );
});

test("the language picked in the header becomes the account's", async ({ page }) => {
  await signInAs(page, "developer");
  await page.goto("/account");
  const language = page.getByLabel("Idioma da conta");
  await expect(language).toHaveValue("pt");
  await page.getByRole("combobox", { name: "Idioma" }).first().selectOption("en");
  await expect(page.getByLabel("Account language")).toHaveValue("en");
  // Saved on the server, not only on this screen.
  await page.evaluate(() => window.localStorage.removeItem("stackmatch-lang"));
  await page.reload();
  await expect(page.getByLabel("Idioma da conta")).toHaveValue("en");
});
