import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Heart,
  LogIn,
  Menu,
  Search,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useI18n, type Lang } from "@/lib/i18n";
import { useSavedDevelopers } from "@/lib/use-saved-developers";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { user, ready } = useAuth();
  // Count only saved ids that still match a profile, as the list does: older versions may have
  // left ids of profiles that no longer exist.
  const { count: savedCount } = useSavedDevelopers({
    enabled: user?.accountType === "company" && user.emailVerified,
  });
  // The app areas need an account, so visitors only get the sign-in buttons; each account type
  // sees just its own areas.
  const links = !user
    ? []
    : user.accountType === "developer"
      ? [
          { to: "/create-profile" as const, label: t.nav.myProfile, icon: UserRound },
          { to: "/job-board" as const, label: t.nav.jobs, icon: BriefcaseBusiness },
          { to: "/interests" as const, label: t.nav.interests, icon: Heart },
        ]
      : [
          { to: "/discover" as const, label: t.nav.discover, icon: Search },
          { to: "/jobs" as const, label: t.nav.jobs, icon: BriefcaseBusiness },
          { to: "/saved" as const, label: t.nav.saved, icon: Bookmark },
          { to: "/proposals" as const, label: t.nav.proposals, icon: CalendarDays },
        ];
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-xl font-bold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-4" />
          </span>
          Stack<span className="text-primary">Match</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeProps={{ className: "nav-active" }} className="nav-link">
              <Icon className="size-4" />
              {label}
              {to === "/saved" && savedCount > 0 && (
                <span className="count-badge">{savedCount}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {/* On phones it moves into the menu, so the header fits narrow screens. */}
          <LanguageSelect className="hidden sm:block" />
          <ThemeToggle />
          <AccountMenu />
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            aria-label={open ? t.common.close : t.nav.openMenu}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="divide-y divide-border border-t border-border bg-background px-3 md:hidden">
          {links.length > 0 && (
            <div className="py-3">
              {links.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  activeProps={{ className: "nav-active" }}
                  className="nav-link flex w-full"
                >
                  <Icon className="size-4" />
                  {label}
                  {to === "/saved" && savedCount > 0 && (
                    <span className="count-badge">{savedCount}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
          {ready && !user && (
            <div className="grid grid-cols-2 gap-2 py-3">
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link to="/login">
                  <LogIn />
                  {t.nav.signIn}
                </Link>
              </Button>
              <Button asChild onClick={() => setOpen(false)}>
                <Link to="/register">
                  <UserPlus />
                  {t.nav.signUp}
                </Link>
              </Button>
            </div>
          )}
          <label className="flex items-center justify-between gap-3 py-3 text-sm font-medium sm:hidden">
            {t.nav.language}
            <LanguageSelect />
          </label>
        </nav>
      )}
    </header>
  );
}

function LanguageSelect({ className }: { className?: string }) {
  const { t, lang, setLang } = useI18n();
  return (
    <select
      aria-label={t.nav.language}
      value={lang}
      onChange={(event) => setLang(event.target.value as Lang)}
      className={cn(
        "h-9 rounded-md border border-input bg-background px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <option value="pt" lang="pt-BR">
        PT-BR
      </option>
      <option value="en" lang="en">
        EN
      </option>
    </select>
  );
}
