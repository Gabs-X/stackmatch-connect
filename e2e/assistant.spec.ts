import { expect, signInAs, test } from "./fixtures";

test("visitors are asked to create an account or sign in before chatting", async ({ page }) => {
  await page.goto("/terms");
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  const chat = page.getByRole("dialog", { name: "Ada" });
  await expect(chat.getByText(/Para conversar comigo, entre na sua conta/)).toBeVisible();
  await expect(chat.getByLabel("Mensagem para a Ada")).toBeHidden();
  await expect(chat.getByRole("button", { name: "Como funciona o Discover?" })).toBeHidden();

  await chat.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/register\?redirect=%2Fterms$/);
  await expect(page.getByRole("heading", { name: "Criar sua conta" })).toBeVisible();
  await expect(chat).toBeHidden();

  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  await chat.getByRole("button", { name: "Já tenho conta" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("the API answers only signed-in accounts", async ({ request }) => {
  const response = await request.post("/api/assistant", {
    data: { messages: [{ role: "user", content: "Oi" }], locale: "pt-BR" },
  });
  expect(response.status()).toBe(401);
});

test("the assistant answers a suggestion with the preview reply", async ({ page }) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();

  const chat = page.getByRole("dialog", { name: "Ada" });
  await chat.getByRole("button", { name: "Como funciona o Discover?" }).click();

  await expect(chat.getByText("Como funciona o Discover?")).toBeVisible();
  await expect(chat.getByText(/Ainda estou em modo de prévia/)).toBeVisible();
  await expect(chat.getByText(/propostas de reunião\.$/)).toBeVisible();
});

test("stopping a reply halts the text and Escape closes the chat", async ({ page }) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  const chat = page.getByRole("dialog", { name: "Ada" });

  await chat.getByLabel("Mensagem para a Ada").fill("Oi");
  await chat.getByLabel("Mensagem para a Ada").press("Enter");
  await expect(chat.getByText(/Obrigada pela mensagem/)).toBeVisible();
  await chat.getByRole("button", { name: "Parar resposta" }).click();

  const reply = chat.getByText(/Obrigada pela mensagem/);
  const stopped = await reply.textContent();
  await page.waitForTimeout(600);
  await expect(reply).toHaveText(stopped ?? "");

  await page.keyboard.press("Escape");
  await expect(chat).toBeHidden();
  await expect(page.getByRole("button", { name: "Conversar com a Ada" })).toBeFocused();
});

test("a signed-in chat greets by name, follows the account and leaves on sign-out", async ({
  page,
}) => {
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  const chat = page.getByRole("dialog", { name: "Ada" });
  await expect(chat.getByRole("heading", { name: "Oi, Gabriel! Eu sou a Ada." })).toBeVisible();

  await chat.getByLabel("Mensagem para a Ada").fill("Minha pergunta salva");
  await chat.getByLabel("Mensagem para a Ada").press("Enter");
  await expect(chat.getByText(/propostas de reunião\.$/)).toBeVisible();

  // The conversation comes back after a reload: it's kept on the server for the account.
  await page.reload();
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  await expect(chat.getByText("Minha pergunta salva")).toBeVisible();
  await expect(chat.getByText(/propostas de reunião\.$/)).toBeVisible();

  // Signing out clears it from the screen.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Menu da conta de Gabriel Botelho" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  await expect(chat.getByRole("button", { name: "Criar conta" })).toBeVisible();
  await expect(chat.getByText("Minha pergunta salva")).toBeHidden();

  // Another account doesn't see it; the same account gets it back.
  await signInAs(page, "company");
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  await expect(chat.getByRole("heading", { name: /Eu sou a Ada\./ })).toBeVisible();
  await expect(chat.getByText("Minha pergunta salva")).toBeHidden();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Menu da conta de Recrutadora Teste" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await signInAs(page, "developer");
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  await expect(chat.getByText("Minha pergunta salva")).toBeVisible();

  // New conversation clears it for good.
  await chat.getByRole("button", { name: "Nova conversa" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Conversar com a Ada" }).click();
  await expect(chat.getByText("Minha pergunta salva")).toBeHidden();
});
