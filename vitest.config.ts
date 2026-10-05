import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: the TanStack Start and Nitro plugins aren't needed to test plain
// logic and would slow down or break the test run.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Images saved by the tests go to a throwaway folder.
    env: { UPLOADS_DIR: path.join(os.tmpdir(), "stackmatch-test-uploads") },
  },
});
