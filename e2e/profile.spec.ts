import { expect, seedSavedTalents, signInAs, test } from "./fixtures";

test("verified profile links open the owner's real pages in a new tab", async ({ page }) => {
  await page.goto("/developer/demo-developer");
  const links = page.getByRole("complementary");

  await expect(links.getByRole("link", { name: /^GitHub:/ })).toHaveAttribute(
    "href",
    "https://github.com/Gabs-X",
  );
  await expect(links.getByRole("link", { name: /^LinkedIn:/ })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/gabriel-anthony-7688bb224/",
  );
  const portfolio = links.getByRole("link", { name: /^Portfólio:/ });
  await expect(portfolio).toHaveAttribute("href", "https://gabrielanthony.vercel.app/");
  await expect(portfolio).toHaveAttribute("target", "_blank");
  await expect(portfolio).toHaveAttribute("rel", "noopener noreferrer");
});

test("verified profile photo comes from the GitHub avatar", async ({ page }) => {
  await page.goto("/developer/demo-developer");
  await expect(page.getByRole("img", { name: "Gabriel Botelho" })).toHaveAttribute(
    "src",
    "https://github.com/Gabs-X.png?size=768",
  );
});

test.describe("when the GitHub avatar fails to load", () => {
  test.use({ githubAvatars: "fail" });

  test("shows the initials instead of a broken image", async ({ page }) => {
    await page.goto("/developer/demo-developer");
    await expect(page.getByText("GB", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Gabriel Botelho" })).toHaveCount(0);
  });
});

test("saving from the profile adds it to the shortlist", async ({ page }) => {
  await signInAs(page, "company");
  await page.goto("/developer/marina-costa");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page
    .getByRole("link", { name: /Talentos salvos/ })
    .first()
    .click();

  await expect(page.getByRole("heading", { name: "Marina Costa" })).toBeVisible();
  await page.getByRole("button", { name: "Remover Marina Costa" }).click();
  await expect(page.getByText("Você ainda não salvou nenhum talento.")).toBeVisible();
});

test("the shortlist filters, sorts and undoes a removal", async ({ page }) => {
  await seedSavedTalents(page, ["marina-costa", "rafael-lima", "diego-santos"]);
  await signInAs(page, "company");
  await page.goto("/saved");
  const cards = page.getByRole("main").getByRole("article");
  await expect(cards).toHaveCount(3);

  await page.getByRole("button", { name: /Disponíveis agora/ }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Marina Costa");
  await page.getByRole("button", { name: /Todos os salvos/ }).click();

  await page.getByLabel("Ordenar por").selectOption({ label: "Menor valor por hora" });
  await expect(cards.first()).toContainText("Diego Santos");
  await page.getByLabel("Ordenar por").selectOption({ label: "Mais experiência" });
  await expect(cards.first()).toContainText("Marina Costa");

  await page.getByRole("button", { name: "Remover Rafael Lima" }).click();
  await expect(cards).toHaveCount(2);
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Desfazer" }).click();
  await expect(cards).toHaveCount(3);
});
