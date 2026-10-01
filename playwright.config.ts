import { defineConfig, devices } from "@playwright/test";

const port = 5299;
const isCI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
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
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
