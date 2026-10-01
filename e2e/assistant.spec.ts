import { expect, test } from "./fixtures";

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
