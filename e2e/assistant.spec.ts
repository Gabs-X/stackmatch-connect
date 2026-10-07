import { expect, signInAs, test } from "./fixtures";

test("the assistant answers a suggestion with the preview reply", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir assistente" }).click();

  const chat = page.getByRole("dialog", { name: "Assistente StackMatch" });
  await chat.getByRole("button", { name: "Como funciona o Discover?" }).click();

  await expect(chat.getByText("Como funciona o Discover?")).toBeVisible();
  await expect(chat.getByText(/Ainda estou em modo de prévia/)).toBeVisible();
  await expect(chat.getByText(/propostas de reunião\.$/)).toBeVisible();
});

test("stopping a reply halts the text and Escape closes the chat", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  const chat = page.getByRole("dialog", { name: "Assistente StackMatch" });

  await chat.getByLabel("Mensagem para o assistente").fill("Oi");
  await chat.getByLabel("Mensagem para o assistente").press("Enter");
  await expect(chat.getByText(/Obrigado pela mensagem/)).toBeVisible();
  await chat.getByRole("button", { name: "Parar resposta" }).click();

  const reply = chat.getByText(/Obrigado pela mensagem/);
  const stopped = await reply.textContent();
  await page.waitForTimeout(600);
  await expect(reply).toHaveText(stopped ?? "");

  await page.keyboard.press("Escape");
  await expect(chat).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir assistente" })).toBeFocused();
});

test("a signed-in chat greets by name, follows the account and leaves on sign-out", async ({
  page,
}) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  const chat = page.getByRole("dialog", { name: "Assistente StackMatch" });
  await expect(
    chat.getByRole("heading", { name: "Olá, Gabriel! Como posso ajudar?" }),
  ).toBeVisible();

  await chat.getByLabel("Mensagem para o assistente").fill("Minha pergunta salva");
  await chat.getByLabel("Mensagem para o assistente").press("Enter");
  await expect(chat.getByText(/propostas de reunião\.$/)).toBeVisible();

  // The conversation comes back after a reload: it's kept on the server for the account.
  await page.reload();
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  await expect(chat.getByText("Minha pergunta salva")).toBeVisible();
  await expect(chat.getByText(/propostas de reunião\.$/)).toBeVisible();

  // Signing out clears it from the screen.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  await expect(chat.getByRole("heading", { name: "Olá! Como posso ajudar?" })).toBeVisible();
  await expect(chat.getByText("Minha pergunta salva")).toBeHidden();

  // Another account doesn't see it; the same account gets it back.
  await signInAs(page, "company");
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  await expect(chat.getByRole("heading", { name: /Como posso ajudar\?/ })).toBeVisible();
  await expect(chat.getByText("Minha pergunta salva")).toBeHidden();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  await expect(chat.getByText("Minha pergunta salva")).toBeVisible();

  // New conversation clears it for good.
  await chat.getByRole("button", { name: "Nova conversa" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Abrir assistente" }).click();
  await expect(chat.getByText("Minha pergunta salva")).toBeHidden();
});
