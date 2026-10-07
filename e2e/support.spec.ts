import { expect, lastEmail, signInAs, test } from "./fixtures";

test("a visitor opens a ticket from the footer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Suporte" }).click();
  await expect(page).toHaveURL(/\/support$/);
  const form = page.getByRole("main");

  // Required fields are checked before anything is sent.
  await form.getByRole("button", { name: "Enviar ticket" }).click();
  await expect(form.getByText("Escreva um título com pelo menos 3 caracteres.")).toBeVisible();
  await expect(form.getByText("Informe um e-mail válido.")).toBeVisible();

  await form.getByLabel("Assunto").selectOption({ label: "Problema ou bug" });
  await form.getByLabel("Seu nome").fill("Bruna Dias");
  await form.getByLabel("E-mail para resposta").fill("bruna@example.com");
  await form.getByLabel("Título").fill("Botão de salvar não responde");
  await form.getByLabel("Mensagem").fill("No Discover, o botão de salvar não faz nada no celular.");
  await expect(form.getByLabel("Anexar minha conversa com a Ada")).toBeHidden();
  await form.getByRole("button", { name: "Enviar ticket" }).click();

  await expect(form.getByRole("heading", { name: /Ticket #\d+ aberto/ })).toBeVisible();
  await expect(form.getByText(/A equipe responde no e-mail que você informou/)).toBeVisible();
  // Visitors have no ticket list; that's for accounts.
  await expect(form.getByRole("heading", { name: "Meus tickets" })).toBeHidden();
});

test("a signed-in account opens a ticket, gets a receipt and sees it listed", async ({ page }) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await page.getByRole("menuitem", { name: "Suporte" }).click();
  await expect(page).toHaveURL(/\/support$/);
  const form = page.getByRole("main");

  await expect(form.getByText("Você ainda não abriu nenhum ticket.")).toBeVisible();
  await expect(form.getByText(/A resposta vai para teste\.dev@example\.com/)).toBeVisible();
  await expect(form.getByLabel("Seu nome")).toBeHidden();
  await expect(form.getByLabel("Anexar minha conversa com a Ada")).toBeChecked();

  await form.getByLabel("Título").fill("Não consigo trocar a foto");
  await form.getByLabel("Mensagem").fill("A foto nova não aparece depois de salvar o perfil.");
  await form.getByRole("button", { name: "Enviar ticket" }).click();

  const heading = form.getByRole("heading", { name: /Ticket #\d+ aberto/ });
  await expect(heading).toBeVisible();
  const id = (await heading.textContent())?.match(/#(\d+)/)?.[1] ?? "";
  const list = form.getByRole("region", { name: "Meus tickets" });
  await expect(list.getByText(`#${id}`)).toBeVisible();
  await expect(list.getByText("Não consigo trocar a foto")).toBeVisible();
  await expect(list.getByText("Aberto", { exact: true })).toBeVisible();

  const receipt = await lastEmail(page, "teste.dev@example.com");
  expect(receipt.subject).toBe(`Recebemos seu ticket #${id}`);
});

test("the assistant's ticket link leads to Support", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  await page
    .getByRole("dialog", { name: "Ada" })
    .getByRole("button", { name: "Abrir um ticket" })
    .click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole("heading", { name: "Suporte", level: 1 })).toBeVisible();
});

test("the terms open from sign-up in a new tab and from the footer", async ({ page }) => {
  await page.goto("/register");
  const [terms] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "termos de uso e a política de privacidade" }).click(),
  ]);
  await expect(terms).toHaveURL(/\/terms$/);
  await expect(
    terms.getByRole("heading", { name: "Termos de uso e privacidade", level: 1 }),
  ).toBeVisible();
  await expect(terms.getByRole("heading", { name: "Política de privacidade" })).toBeVisible();
  await terms.close();
  // The form underneath keeps its state: still on the sign-up page.
  await expect(page).toHaveURL(/\/register$/);

  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Termos de uso e privacidade" })
    .click();
  await expect(page).toHaveURL(/\/terms$/);
  await page.getByRole("link", { name: "Fale com o Suporte" }).click();
  await expect(page).toHaveURL(/\/support$/);
});
