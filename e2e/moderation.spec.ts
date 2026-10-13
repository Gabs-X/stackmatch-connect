import type { Page } from "@playwright/test";
import { expect, signInAs, test } from "./fixtures";

// The test company account is the admin in the e2e server (ADMIN_EMAILS).

async function signInWith(page: Page, email: string) {
  await page.goto("/login");
  const form = page.getByRole("main");
  await form.getByLabel("E-mail").fill(email);
  await form.getByLabel("Senha", { exact: true }).fill("teste1234");
  await form.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function openReports(page: Page) {
  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Denúncias (admin)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Denúncias" })).toBeVisible();
}

test("a reported profile is suspended, its account can't sign in, and lifting it brings it back", async ({
  page,
}) => {
  await signInAs(page, "company");
  await page.goto("/developer/demo-developer");
  await page.getByRole("button", { name: "Denunciar: Gabriel Botelho" }).click();
  const dialog = page.getByRole("dialog", { name: "Denunciar perfil" });
  await dialog.getByLabel("Motivo").selectOption({ label: "Informação falsa ou perfil falso" });
  await dialog.getByLabel("Detalhes (opcional)").fill("Os projetos são de outra pessoa.");
  await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(page.getByText("Denúncia enviada. A equipe vai analisar.")).toBeVisible();

  await openReports(page);
  const report = page.getByRole("article", { name: "Perfil: Gabriel Botelho" });
  await expect(report).toContainText("Informação falsa ou perfil falso");
  await expect(report).toContainText("Os projetos são de outra pessoa.");
  await expect(report).toContainText("teste.dev@example.com");
  const suspend = report.getByRole("button", { name: "Suspender conta" });
  await expect(suspend).toBeDisabled();
  await report.getByLabel("Motivo da decisão").fill("Projetos copiados.");
  await suspend.click();
  await expect(page.getByText("Feito.")).toBeVisible();
  await expect(report).toHaveCount(0);
  const suspended = page.getByRole("article", { name: "Gabriel Botelho" });
  await expect(suspended).toContainText("teste.dev@example.com · Desenvolvedor");
  await expect(suspended).toContainText("Suspensa · teste.emp@example.com: Projetos copiados.");

  // Gone from the company's view, and its account can't sign in.
  await page.goto("/developer/demo-developer");
  await expect(page.getByText("Gabriel Botelho")).toHaveCount(0);
  await page.context().clearCookies();
  await signInWith(page, "teste.dev@example.com");
  await expect(page.getByText(/Esta conta está suspensa/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await signInAs(page, "company");
  await openReports(page);
  await suspended.getByLabel("Motivo da decisão").fill("Comprovou a autoria.");
  await suspended.getByRole("button", { name: "Reativar conta" }).click();
  await expect(page.getByText("Nenhuma conta suspensa.")).toBeVisible();
  await page.getByRole("button", { name: "Todas" }).click();
  await expect(page.getByRole("article", { name: "Perfil: Gabriel Botelho" })).toContainText(
    "Conta suspensa",
  );

  await page.context().clearCookies();
  await signInAs(page, "developer");
});

test("an admin dismisses a report about a job", async ({ page }) => {
  await signInAs(page, "company");
  await page.goto("/jobs/new");
  await page.getByLabel("Título").fill("Vaga Denunciada");
  await page.getByRole("button", { name: "Criar vaga" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vaga Denunciada" })).toBeVisible();
  // The company doesn't see a report button on its own job.
  await page.goto("/job-board");
  await expect(page.getByRole("button", { name: /^Denunciar/ })).toHaveCount(0);

  await page.context().clearCookies();
  await signInAs(page, "developer");
  await page.goto("/job-board");
  await page.getByRole("button", { name: "Denunciar: Vaga Denunciada" }).click();
  const dialog = page.getByRole("dialog", { name: "Denunciar vaga" });
  await dialog.getByLabel("Motivo").selectOption({ label: "Spam ou propaganda" });
  await dialog.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(page.getByText("Denúncia enviada. A equipe vai analisar.")).toBeVisible();

  await page.context().clearCookies();
  await signInAs(page, "company");
  await openReports(page);
  const report = page.getByRole("article", { name: "Vaga: Vaga Denunciada" });
  await report.getByLabel("Motivo da decisão").fill("Vaga legítima.");
  await report.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("Nenhuma denúncia aqui.")).toBeVisible();
  await page.getByRole("button", { name: "Todas" }).click();
  await expect(report).toContainText("Descartada");
  await expect(report).toContainText("Revisada por teste.emp@example.com: Vaga legítima.");
});

test("only admins reach the reports, and every response carries its request id", async ({
  page,
}) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await expect(page.getByRole("menuitem", { name: "Denúncias (admin)" })).toBeHidden();
  await page.keyboard.press("Escape");
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Área restrita" })).toBeVisible();

  const response = await page.request.get("/");
  expect(response.headers()["x-request-id"]).toMatch(/^[\w.:-]{8,128}$/);
  const sent = await page.request.get("/", { headers: { "x-request-id": "e2e-request-0001" } });
  expect(sent.headers()["x-request-id"]).toBe("e2e-request-0001");
});
