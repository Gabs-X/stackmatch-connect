import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 5299;
const isCI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "./e2e",
  // One test at a time: they share the server's database, which each test resets (see fixtures.ts).
  workers: 1,
  forbidOnly: isCI,
  // One retry absorbs dev-server compile stalls under parallel load; retried passes are still
  // reported as "flaky", so instability stays visible.
  retries: 1,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "pt-BR",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      // Uses the Chrome installed on the machine; run `npx playwright install chrome` where it's missing.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "chrome" },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    // A throwaway in-memory database and image folder, and the reset endpoint the fixtures call
    // before each test.
    env: {
      DATABASE_URL: "memory://",
      UPLOADS_DIR: path.join(os.tmpdir(), "stackmatch-e2e-uploads"),
      E2E: "1",
      // Lets e2e/cron.spec.ts call the daily cleanup like Vercel Cron does.
      CRON_SECRET: "e2e-cron-secret",
      // The seed's company account doubles as the admin in e2e/admin.spec.ts.
      ADMIN_EMAILS: "teste.emp@example.com",
    },
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
