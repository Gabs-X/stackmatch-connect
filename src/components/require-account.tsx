import { Link, useLocation, useMatch, useRouter } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { homeFor, type AccountType } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

/**
 * Shows its children only to signed-in accounts that confirmed their e-mail, of the given type when
 * one is set. Visitors go to the login and unconfirmed accounts to the confirmation, both with a
 * redirect back here; the other account type sees a notice. The server enforces the same rules.
 */
export function RequireAccount({ type, children }: { type?: AccountType; children: ReactNode }) {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const router = useRouter();
  const { pathname } = useLocation();
  // The guarded route, not the URL: while navigating to the login this page is still on screen.
  const route = useMatch({ strict: false, select: (match) => match.pathname });

  useEffect(() => {
    if (!ready || user?.emailVerified || pathname !== route) return;
    // Signed in but not confirmed yet: the code first, then back here.
    if (user)
      void router.navigate({ to: "/verify-email", search: { redirect: route }, replace: true });
    else void router.navigate({ to: "/login", search: { redirect: route }, replace: true });
  }, [ready, user, pathname, route, router]);

  if (!ready || !user?.emailVerified)
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t.access.checking}
        </p>
      </main>
    );

  if (type && user.accountType !== type) {
    const isCompanyArea = type === "company";
    return (
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl place-items-center px-4 py-10">
        <div className="max-w-md rounded-xl border border-dashed bg-card p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
            <ShieldAlert aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-bold">
            {isCompanyArea ? t.access.companyTitle : t.access.developerTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isCompanyArea ? t.access.companySub : t.access.developerSub}
          </p>
          <Button asChild className="mt-5">
            <Link to={homeFor(user)}>{t.access.goHome}</Link>
          </Button>
        </div>
      </main>
    );
  }

  return children;
}
