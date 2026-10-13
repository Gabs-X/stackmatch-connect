import { expect, seedBoardJobs, signInAs, test } from "./fixtures";

test("the job board loads more jobs a page at a time and searches all of them", async ({
  page,
}) => {
  await seedBoardJobs(page, 45);
  await signInAs(page, "developer");
  await page.goto("/job-board");
  const jobs = page.getByRole("main").getByRole("article");

  // The newest first, 20 at a time, counting every job found.
  await expect(page.getByRole("status").filter({ hasText: "vagas" })).toHaveText("45 vagas");
  await expect(jobs).toHaveCount(20);
  await expect(jobs.first()).toHaveAccessibleName("Vaga de teste 45");
  await page.getByRole("button", { name: "Carregar mais vagas" }).click();
  await expect(jobs).toHaveCount(40);
  await page.getByRole("button", { name: "Carregar mais vagas" }).click();
  await expect(jobs).toHaveCount(45);
  await expect(jobs.last()).toHaveAccessibleName("Vaga de teste 1");
  await expect(page.getByRole("button", { name: "Carregar mais vagas" })).toHaveCount(0);

  // The search reaches jobs that weren't loaded yet, on the server.
  await page.reload();
  await expect(jobs).toHaveCount(20);
  await page.getByLabel("Buscar vagas").fill("vaga de teste 7");
  await expect(page.getByRole("status").filter({ hasText: "vaga" })).toHaveText("1 vaga");
  await expect(jobs).toHaveCount(1);
  await expect(jobs.first()).toHaveAccessibleName("Vaga de teste 7");

  await page.getByLabel("Buscar vagas").fill("nenhuma vaga assim");
  await expect(page.getByText("Nenhuma vaga com esses filtros.")).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(jobs).toHaveCount(20);
});
