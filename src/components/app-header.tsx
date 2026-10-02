import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BriefcaseBusiness,
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
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { useI18n, type Lang } from "@/lib/i18n";
import { useDevelopers } from "@/lib/use-developers";

export function AppHeader() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const { saved } = useApp();
  const { user, ready } = useAuth();
  // Count only saved ids that still match a profile, as the list does: older versions may have
  // left ids of profiles that no longer exist.
  const { developers } = useDevelopers({ enabled: user?.accountType === "company" });
  const savedCount = developers
    ? saved.filter((id) => developers.some((developer) => developer.id === id)).length
    : 0;
  // The app areas need an account, so visitors only get the sign-in buttons; each account type
  // sees just its own areas.
  const links = !user
    ? []
    : user.accountType === "developer"
      ? [
          { to: "/create-profile" as const, label: t.nav.myProfile, icon: UserRound },
          { to: "/interests" as const, label: t.nav.interests, icon: Heart },
        ]
      : [
          { to: "/discover" as const, label: t.nav.discover, icon: Search },
          { to: "/saved" as const, label: t.nav.saved, icon: Bookmark },
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
          <select
            aria-label={t.nav.language}
            value={lang}
            onChange={(event) => setLang(event.target.value as Lang)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="pt" lang="pt-BR">
              PT-BR
            </option>
            <option value="en" lang="en">
              EN
            </option>
          </select>
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
        <nav className="border-t border-border bg-background p-3 md:hidden">
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="nav-link flex w-full">
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
          {ready && !user && (
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
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
        </nav>
      )}
    </header>
  );
}
