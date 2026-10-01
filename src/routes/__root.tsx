import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  type ErrorComponentProps,
  Scripts,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { useEffect, type ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { AssistantWidget } from "@/components/assistant-widget";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/lib/app-context";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ThemeProvider, themeInitScript, useTheme } from "@/lib/theme";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

// Vercel Analytics only collects on Vercel hosting; elsewhere its script 404s, so opt in per deploy.
const vercelAnalyticsEnabled = import.meta.env.VITE_VERCEL_ANALYTICS === "true";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t.common.notFound}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.common.notFoundDescription}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.common.home}
          </Link>
        </div>
      </div>
    </div>
  );
}

// The router types `error` as unknown: anything can be thrown, not only Error instances.
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const { t } = useI18n();
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t.common.error}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.common.errorDescription}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.common.retry}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t.common.home}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Stack Match" },
      {
        name: "description",
        content: "Descubra desenvolvedores qualificados para o seu próximo projeto.",
      },
      { name: "author", content: "Stack Match" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Applies the saved or system theme before first paint to avoid a light flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { resolved } = useTheme();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Discover pins its action bar to the bottom on phones; lift floating UI above it there.
  const raised = pathname === "/discover";
  // Marks when client handlers are attached; e2e tests wait for it before interacting.
  useEffect(() => {
    document.documentElement.dataset["hydrated"] = "";
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AuthProvider>
          <AppHeader />
          {/* Keyed by path so each navigation replays the entrance animation. */}
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
          <Toaster
            richColors
            theme={resolved}
            position="bottom-right"
            offset={{ bottom: 96, right: 24 }}
            mobileOffset={{ bottom: raised ? 176 : 80 }}
          />
          <AssistantWidget raised={raised} />
          {vercelAnalyticsEnabled && <Analytics />}
        </AuthProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
