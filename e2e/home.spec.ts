import { expect, test } from "./fixtures";

test("the home page illustrates the card with a fictional person, not a real profile", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.getByRole("article");
  await expect(card).toContainText("Marina Costa");
  await expect(card).not.toContainText("Gabriel Botelho");
  // A bundled photo, not a GitHub avatar.
  await expect(card.getByRole("img", { name: "Foto de Marina Costa" })).toHaveAttribute(
    "src",
    /hero-developer/,
  );
});
