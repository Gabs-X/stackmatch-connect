import { Link } from "@tanstack/react-router";
import { Bookmark, Heart, LogOut, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
};

/** Sign-in buttons when logged out; account menu, with items per account type, when logged in. */
export function AccountMenu() {
  const { t } = useI18n();
  const { user, ready, signOut } = useAuth();

  // Same footprint as the avatar while the stored session loads, so the header doesn't jump.
  if (!ready) return <span className="hidden size-9 md:block" aria-hidden="true" />;

  if (!user)
    return (
      <div className="hidden items-center gap-2 md:flex">
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">{t.nav.signIn}</Link>
        </Button>
        <Button asChild size="sm" className="hidden lg:inline-flex">
          <Link to="/register">{t.nav.signUp}</Link>
        </Button>
      </div>
    );

  const isDeveloper = user.accountType === "developer";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t.auth.menu.open(user.name)}
          className="grid size-9 cursor-pointer place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {initials(user.name)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="level-badge shrink-0 px-2 py-0.5 text-[0.65rem]">
              {isDeveloper ? t.auth.badgeDeveloper : t.auth.badgeCompany}
            </span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[user.jobTitle, isDeveloper ? "" : user.company].filter(Boolean).join(" · ") ||
              user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isDeveloper ? (
          <>
            <DropdownMenuItem asChild>
              <Link to="/create-profile">
                <UserRound />
                {t.auth.menu.myProfile}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/interests">
                <Heart />
                {t.auth.menu.interests}
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link to="/discover">
                <Search />
                {t.auth.menu.discover}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/saved">
                <Bookmark />
                {t.auth.menu.saved}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            signOut();
            toast(t.auth.signedOut);
          }}
        >
          <LogOut />
          {t.auth.menu.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
