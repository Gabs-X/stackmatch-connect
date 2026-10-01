import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Bookmark, RotateCcw, Trash2 } from "lucide-react";
import { DeveloperCard } from "@/components/developer-card";
import { DeveloperCardSkeleton } from "@/components/developer-card-skeleton";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useDevelopers } from "@/lib/use-developers";
export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Sua shortlist de profissionais de tecnologia." },
      { property: "og:title", content: "Talentos salvos — Stack Match" },
      { property: "og:description", content: "Sua seleção de talentos para o próximo projeto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavedPage,
});
function SavedPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.saved.title + " — Stack Match", t.saved.sub);
  const { hydrated, saved, toggleSaved } = useApp();
  const { developers, isPending, isError, refetch } = useDevelopers();
  const items = developers?.filter((d) => saved.includes(d.id)) ?? [];
  // Before storage is read the count is unknown, so show one row; after, match the saved count.
  const loading = !hydrated || (saved.length > 0 && isPending && !isError);
  const skeletonCount = hydrated ? Math.min(saved.length, 8) : 4;
  const grid = "mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{t.saved.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{t.saved.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.saved.sub}</p>
      {loading ? (
        <div className={grid} aria-busy="true">
          <span role="status" className="sr-only">
            {t.common.loading}
          </span>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <DeveloperCardSkeleton key={i} compact />
          ))}
        </div>
      ) : isError && saved.length > 0 ? (
        <div className="mt-16 grid min-h-80 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
          <div role="alert">
            <h2 className="text-xl font-bold">{t.discover.loadError}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t.discover.loadErrorSub}</p>
            <Button className="mt-5" onClick={() => void refetch()}>
              <RotateCcw />
              {t.common.retry}
            </Button>
          </div>
        </div>
      ) : items.length ? (
        <div className={grid}>
          {items.map((d, index) => (
            <div
              className="stagger-item relative"
              style={{ "--stagger-index": index } as CSSProperties}
              key={d.id}
            >
              <DeveloperCard developer={d} compact />
              <Button
                size="icon"
                variant="destructive"
                className="absolute right-3 top-3 z-10"
                aria-label={`${t.saved.remove} ${d.name}`}
                onClick={() => toggleSaved(d.id)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-16 grid min-h-80 place-items-center rounded-xl border border-dashed bg-card text-center">
          <div>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
              <Bookmark />
            </span>
            <h2 className="mt-5 text-xl font-bold">{t.saved.emptyTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t.saved.emptySub}</p>
            <Button asChild className="mt-5">
              <Link to="/discover">{t.profile.back}</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
