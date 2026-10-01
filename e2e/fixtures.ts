import { test as base, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Stand-in for GitHub avatars so tests never depend on the network.
const avatar = readFileSync(new URL("../src/assets/developer-rafael.jpg", import.meta.url));

/**
 * Pages are server-rendered, so buttons exist before React attaches their handlers; a click in
 * that window does nothing. Wait for the root's data-hydrated flag after every navigation.
 */
function waitForHydrationOnNavigation(page: Page) {
  const ready = () => page.waitForSelector("html[data-hydrated]", { state: "attached" });
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  page.goto = async (...args) => {
    const response = await goto(...args);
    await ready();
    return response;
  };
  page.reload = async (...args) => {
    const response = await reload(...args);
    await ready();
    return response;
  };
}

export const test = base.extend<{ githubAvatars: "serve" | "fail" }>({
  githubAvatars: ["serve", { option: true }],
  // Named `provide` instead of Playwright's usual `use` so the React hooks lint rule ignores it.
  page: async ({ page, githubAvatars }, provide) => {
    await page.route("https://github.com/**", (route) =>
      githubAvatars === "serve"
        ? route.fulfill({ status: 200, contentType: "image/jpeg", body: avatar })
        : route.fulfill({ status: 404, body: "" }),
    );
    waitForHydrationOnNavigation(page);
    await provide(page);
  },
});

export { expect } from "@playwright/test";
