import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { Bookmark, BookmarkX, CircleCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DeveloperCard } from "@/components/developer-card";
import { DeveloperCardSkeleton } from "@/components/developer-card-skeleton";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { availabilityOptions, type Developer } from "@/lib/developers";
import { useSavedDevelopers } from "@/lib/use-saved-developers";
import { cn } from "@/lib/utils";
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
  component: () => (
    <RequireAccount type="company">
      <SavedPage />
    </RequireAccount>
  ),
});

type Filter = "all" | "available";
type Sort = "availability" | "rate" | "experience";

const availableNow = availabilityOptions[0];
// Unknown values go last, after every option in the catalog.
const availabilityRank = (developer: Developer) => {
  const rank = (availabilityOptions as readonly string[]).indexOf(developer.availability);
  return rank < 0 ? availabilityOptions.length : rank;
};
// Rate and experience are optional; profiles without them go last.
const rateOf = (developer: Developer) =>
  Number.isFinite(developer.rate) ? developer.rate : Number.POSITIVE_INFINITY;
const yearsOf = (developer: Developer) => Number.parseInt(developer.experience, 10) || -1;
const sorters: Record<Sort, (a: Developer, b: Developer) => number> = {
  availability: (a, b) => availabilityRank(a) - availabilityRank(b),
  rate: (a, b) => rateOf(a) - rateOf(b),
  experience: (a, b) => yearsOf(b) - yearsOf(a),
};

function SavedPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.saved.title + " — Stack Match", t.saved.sub);
  const { hydrated, saved, addSaved, removeSaved } = useApp();
  const { developers, isPending, isError, refetch } = useSavedDevelopers();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("availability");
  const items = developers ?? [];
  const available = items.filter((d) => d.availability === availableNow).length;
  // Back to every profile when the last available one leaves the shortlist.
  const activeFilter = filter === "available" && available === 0 ? "all" : filter;
  const shown = items
    .filter((d) => activeFilter === "all" || d.availability === availableNow)
    // Array.sort is stable, so ties keep the order the profiles came in.
    .sort(sorters[sort]);
  // Before storage is read the count is unknown, so show one row; after, match the saved count.
  const loading = !hydrated || (saved.length > 0 && isPending && !isError);
  const skeletonCount = hydrated ? Math.min(saved.length, 8) : 4;
  const grid = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  const filters = [
    { id: "all", label: t.saved.filterAll, count: items.length, icon: Bookmark },
    { id: "available", label: t.saved.filterAvailable, count: available, icon: CircleCheck },
  ] as const;
  const remove = (developer: Developer) => {
    removeSaved(developer.id);
    toast(t.profile.toastRemoved, {
      description: developer.name,
      action: { label: t.discover.undo, onClick: () => addSaved(developer.id) },
    });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-20">
      <section className="stagger-item border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="section-kicker">{t.saved.kicker}</span>
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{t.saved.title}</h1>
          <p className="mt-2 text-muted-foreground">{t.saved.sub}</p>

          {!loading && items.length > 0 && (
            // Each summary also filters the shortlist below.
            <div
              role="group"
              aria-label={t.saved.filterLabel}
              className="mt-7 grid max-w-xl grid-cols-2 gap-2 sm:gap-3"
            >
              {filters.map(({ id, label, count, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activeFilter === id}
                  // Nothing to list in an empty group.
                  disabled={count === 0}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50 sm:p-4",
                    activeFilter === id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "bg-background hover:border-primary/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[0.7rem] font-semibold leading-tight sm:text-xs",
                      activeFilter === id ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {label}
                  </span>
                  <span className="font-display text-2xl font-extrabold sm:text-3xl">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className={cn(grid, "mt-9")} aria-busy="true">
            <span role="status" className="sr-only">
              {t.common.loading}
            </span>
            {Array.from({ length: skeletonCount }, (_, i) => (
              <DeveloperCardSkeleton key={i} compact />
            ))}
          </div>
        ) : isError && saved.length > 0 ? (
          <div className="mt-10 grid min-h-80 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
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
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
                {t.saved.count(shown.length)}
              </p>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                {t.saved.sortLabel}
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as Sort)}
                  className="h-9 rounded-md border bg-card px-2 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="availability">{t.saved.sortAvailability}</option>
                  <option value="rate">{t.saved.sortRate}</option>
                  <option value="experience">{t.saved.sortExperience}</option>
                </select>
              </label>
            </div>
            <div className={cn(grid, "mt-4")}>
              {shown.map((d, index) => (
                <div
                  className="stagger-item relative"
                  style={{ "--stagger-index": index } as CSSProperties}
                  key={d.id}
                >
                  <DeveloperCard developer={d} compact />
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute right-3 top-3 z-10 rounded-full border-transparent bg-background/90 text-muted-foreground shadow-soft backdrop-blur hover:bg-destructive hover:text-white"
                    aria-label={`${t.saved.remove} ${d.name}`}
                    title={t.saved.remove}
                    onClick={() => remove(d)}
                  >
                    <BookmarkX />
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-10 grid min-h-80 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
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
      </div>
    </main>
  );
}
