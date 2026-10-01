import { expect, test } from "./fixtures";

test("verified profile links open the owner's real pages in a new tab", async ({ page }) => {
  await page.goto("/developer/gabriel-botelho");
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
  await expect(portfolio).toHaveAttribute("href", "https://gabrielanthony.vercel.app");
  await expect(portfolio).toHaveAttribute("target", "_blank");
  await expect(portfolio).toHaveAttribute("rel", "noopener noreferrer");
});

test("verified profile photo comes from the GitHub avatar", async ({ page }) => {
  await page.goto("/developer/gabriel-botelho");
  await expect(page.getByRole("img", { name: "Gabriel Botelho" })).toHaveAttribute(
    "src",
    "https://github.com/Gabs-X.png?size=768",
  );
});

test.describe("when the GitHub avatar fails to load", () => {
  test.use({ githubAvatars: "fail" });

  test("shows the initials instead of a broken image", async ({ page }) => {
    await page.goto("/developer/gabriel-botelho");
    await expect(page.getByText("GB", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Gabriel Botelho" })).toHaveCount(0);
  });
});

test("fictional profile links explain the example address instead of navigating", async ({
  page,
}) => {
  await page.goto("/developer/marina-costa");
  // The profile link only; project links start with the same address.
  await page.getByRole("button", { name: /^GitHub: github\.com\/marina-costa \(/ }).click();

  await expect(page.getByText("Link de demonstração")).toBeVisible();
  await expect(page).toHaveURL(/\/developer\/marina-costa$/);
});

test("saving from the profile adds it to the shortlist", async ({ page }) => {
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
