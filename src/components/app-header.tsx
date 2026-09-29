import { Link } from "@tanstack/react-router";
import { Bookmark, BriefcaseBusiness, Menu, Search, UserRoundPlus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";

const links = [
  { to: "/discover" as const, label: "Discover", icon: Search },
  { to: "/saved" as const, label: "Talentos salvos", icon: Bookmark },
  { to: "/create-profile" as const, label: "Criar perfil", icon: UserRoundPlus },
];

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const { saved } = useApp();
  return <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><BriefcaseBusiness className="size-4" /></span>
        Stack<span className="text-primary">Match</span>
      </Link>
      <nav className="hidden items-center gap-1 md:flex">{links.map(({ to, label, icon: Icon }) => <Link key={to} to={to} activeProps={{ className: "nav-active" }} className="nav-link"><Icon className="size-4" />{label}{to === "/saved" && saved.length > 0 && <span className="count-badge">{saved.length}</span>}</Link>)}</nav>
      <Button size="icon" variant="ghost" className="md:hidden" aria-label="Abrir menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
    </div>
    {open && <nav className="border-t border-border bg-background p-3 md:hidden">{links.map(({ to, label, icon: Icon }) => <Link key={to} to={to} onClick={() => setOpen(false)} className="nav-link flex w-full"><Icon className="size-4" />{label}</Link>)}</nav>}
  </header>;
}