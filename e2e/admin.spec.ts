import { expect, signInAs, test } from "./fixtures";

test("only admins reach the ticket admin page", async ({ page }) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await expect(page.getByRole("menuitem", { name: "Suporte" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Tickets (admin)" })).toBeHidden();
  await page.keyboard.press("Escape");

  await page.goto("/admin/tickets");
  await expect(page.getByRole("heading", { name: "Área restrita" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tickets de suporte" })).toBeHidden();
});

test("an admin resolves and reopens a ticket", async ({ page }) => {
  // A visitor opens a ticket.
  await page.goto("/support");
  const form = page.getByRole("main");
  await form.getByLabel("Assunto").selectOption({ label: "Conta e acesso" });
  await form.getByLabel("Seu nome").fill("Bruna Dias");
  await form.getByLabel("E-mail para resposta").fill("bruna@example.com");
  await form.getByLabel("Título").fill("Não consigo entrar");
  await form.getByLabel("Mensagem").fill("A tela diz que minha conta está bloqueada há horas.");
  await form.getByRole("button", { name: "Enviar ticket" }).click();
  const sent = form.getByRole("heading", { name: /Ticket #\d+ aberto/ });
  await expect(sent).toBeVisible();
  const id = (await sent.textContent())?.match(/#(\d+)/)?.[1] ?? "";

  // The test company account is the admin in the e2e server (ADMIN_EMAILS).
  await signInAs(page, "company");
  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Tickets (admin)" }).click();
  await expect(page).toHaveURL(/\/admin\/tickets$/);
  await expect(page.getByRole("heading", { name: "Tickets de suporte" })).toBeVisible();

  const filters = page.getByRole("group", { name: "Filtrar tickets" });
  await expect(filters.getByRole("button", { name: /Abertos/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const ticket = page.getByRole("article", { name: "Não consigo entrar" });
  await expect(ticket.getByText(`#${id}`)).toBeVisible();
  await expect(ticket.getByText(/bruna@example\.com/)).toBeVisible();
  await expect(ticket.getByText("Visitante sem login", { exact: false })).toBeVisible();
  await expect(
    ticket.getByText("A tela diz que minha conta está bloqueada há horas."),
  ).toBeVisible();
  await expect(ticket.getByRole("link", { name: "Responder por e-mail" })).toHaveAttribute(
    "href",
    `mailto:bruna@example.com?subject=${encodeURIComponent(`Re: [Ticket #${id}] Não consigo entrar`)}`,
  );

  await ticket.getByRole("button", { name: "Marcar como resolvido" }).click();
  await expect(page.getByText(`Ticket #${id} resolvido.`)).toBeVisible();
  await expect(ticket).toBeHidden();
  await expect(page.getByText("Nenhum ticket aberto. Tudo em dia!")).toBeVisible();

  await filters.getByRole("button", { name: /Resolvidos/ }).click();
  await expect(ticket.getByText(/Resolvido por teste\.emp@example\.com em/)).toBeVisible();
  await ticket.getByRole("button", { name: "Reabrir" }).click();
  await expect(page.getByText(`Ticket #${id} reaberto.`)).toBeVisible();
  await expect(page.getByText("Nenhum ticket resolvido ainda.")).toBeVisible();
});
