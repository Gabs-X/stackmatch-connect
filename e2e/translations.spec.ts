import { expect, signInAs, test } from "./fixtures";

const bio = "Marina Costa trabalha com React e TypeScript.";
const project = "Projeto de Marina Costa.";

test("what a developer wrote shows in the chosen language, with the original a click away", async ({
  page,
}) => {
  // As if the model had translated Marina's texts when she saved her profile.
  const response = await page.request.post("/api/test-seed", {
    data: {
      translations: [
        {
          ownerId: "marina-costa",
          text: bio,
          pt: bio,
          en: "Marina Costa works with React and TypeScript.",
        },
        {
          ownerId: "marina-costa",
          text: "Frontend Developer",
          pt: "Desenvolvedora Frontend",
          en: "Frontend Developer",
        },
        { ownerId: "marina-costa", text: project, pt: project, en: "Marina Costa's project." },
      ],
    },
  });
  expect(response.ok()).toBe(true);

  await page.goto("/developer/marina-costa");
  const main = page.getByRole("main");
  // In Portuguese the bio is the original; the role, written in English, is translated.
  await expect(main.getByText(bio)).toBeVisible();
  await expect(main.getByText("Desenvolvedora Frontend").first()).toBeVisible();
  await expect(main.getByText("Traduzido automaticamente com IA.")).toBeVisible();

  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  await expect(main.getByText("Marina Costa works with React and TypeScript.")).toBeVisible();
  await expect(main.getByText("Marina Costa's project.")).toBeVisible();
  await expect(main.getByText("Frontend Developer").first()).toBeVisible();
  await expect(main.getByText("Automatically translated with AI.")).toBeVisible();

  await main.getByRole("button", { name: "See original" }).click();
  await expect(main.getByText(bio)).toBeVisible();
  await expect(main.getByText(project)).toBeVisible();
  await expect(main.getByText("Showing the original text.")).toBeVisible();
  await main.getByRole("button", { name: "See translation" }).click();
  await expect(main.getByText("Marina Costa works with React and TypeScript.")).toBeVisible();
});

test("profiles without translations show as written, without the note", async ({ page }) => {
  await page.goto("/developer/marina-costa");
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  const main = page.getByRole("main");
  await expect(main.getByText(bio)).toBeVisible();
  await expect(main.getByText("Automatically translated with AI.")).toBeHidden();
});

test("the developer's own preview shows the saved translations", async ({ page }) => {
  // As if the model had translated Gabriel's role when he saved his profile.
  const response = await page.request.post("/api/test-seed", {
    data: {
      translations: [
        {
          ownerId: "demo-developer",
          text: "Full Stack Developer",
          pt: "Desenvolvedor Full Stack",
          en: "Full Stack Developer",
        },
      ],
    },
  });
  expect(response.ok()).toBe(true);

  await signInAs(page, "developer");
  const main = page.getByRole("main");
  await expect(main.getByText("Desenvolvedor Full Stack").first()).toBeVisible();
  await expect(main.getByText("Traduzido automaticamente com IA.")).toBeVisible();
  await main.getByRole("button", { name: "Ver original" }).click();
  await expect(main.getByText("Full Stack Developer").first()).toBeVisible();
  await expect(main.getByText("Mostrando o texto original.")).toBeVisible();

  // The Discover card in the preview uses them too.
  await main.getByRole("button", { name: "Ver como card" }).click();
  await expect(main.getByText("Desenvolvedor Full Stack").first()).toBeVisible();
});
