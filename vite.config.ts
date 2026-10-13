import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    // Resolves the "@/..." imports from tsconfig.json.
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts wraps TanStack Start's server entry to handle SSR errors.
      server: { entry: "server" },
      // Server-only code must never end up in the browser bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Builds the deployable server; the hosting provider (e.g. Vercel) is detected automatically.
    // On Vercel it also schedules the daily cleanup (src/routes/api.cron.cleanup.ts), at 03:00 in
    // Brasília, and the retries of notification e-mails (src/routes/api.cron.notifications.ts),
    // daily by default since Hobby plans allow one run a day; on Pro, NOTIFICATIONS_CRON can set
    // a closer schedule, such as "*/10 * * * *".
    ...(command === "build"
      ? [
          nitro({
            vercel: {
              config: {
                version: 3,
                crons: [
                  { path: "/api/cron/cleanup", schedule: "0 6 * * *" },
                  {
                    path: "/api/cron/notifications",
                    schedule: process.env["NOTIFICATIONS_CRON"]?.trim() || "30 6 * * *",
                  },
                ],
              },
            },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
