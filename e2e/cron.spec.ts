import { expect, test } from "./fixtures";

test("the daily cleanup only runs for Vercel Cron's secret", async ({ page }) => {
  expect((await page.request.get("/api/cron/cleanup")).status()).toBe(401);
  const wrong = await page.request.get("/api/cron/cleanup", {
    headers: { authorization: "Bearer outro-segredo" },
  });
  expect(wrong.status()).toBe(401);

  const run = await page.request.get("/api/cron/cleanup", {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  expect(run.status()).toBe(200);
  expect(await run.json()).toMatchObject({ deleted: { sessions: expect.any(Number) } });
});
