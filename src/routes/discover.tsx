import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { Bookmark, Check, Filter, RotateCcw, Undo2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DeveloperCard } from "@/components/developer-card";
import { DeveloperCardSkeleton } from "@/components/developer-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilterPanel,
  defaultFilters,
  type Filters,
  type FilterGroup,
} from "@/components/filter-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { developersQuery } from "@/lib/api";
import type { Developer } from "@/lib/developers";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      {
        name: "description",
        content: "Explore desenvolvedores por stack, senioridade e disponibilidade.",
      },
      { property: "og:title", content: "Discover — Stack Match" },
      {
        property: "og:description",
        content: "Encontre profissionais compatíveis com seu projeto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { t, tv, formatCurrency } = useI18n();
  useLocalizedMeta(t.discover.title + " — Stack Match", t.discover.sub);

  const {
    data: developers = noDevelopers,
    isPending,
    isError,
    refetch,
  } = useQuery(developersQuery);
  const loading = isPending && !isError;
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [index, setIndex] = useState(0);
  const { saved, interests, addSaved, registerInterest, removeSaved, removeInterest } = useApp();
  const [feedback, setFeedback] = useState<{ action: "save" | "interest"; name: string } | null>(
    null,
  );
  // Each entry records only what the action added, so undo never removes a pre-existing save.
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const historyRef = useRef<HistoryEntry[]>([]);
  const updateHistory = (next: HistoryEntry[]) => {
    historyRef.current = next;
    setHistory(next);
  };
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-8, 8]);
  const yesOpacity = useTransform(x, [30, 120], [0, 1]);
  const noOpacity = useTransform(x, [-120, -30], [1, 0]);
  const filtered = useMemo(
    () =>
      developers.filter(
        (d) =>
          (!filters.skills.length || filters.skills.some((s) => d.skills.includes(s))) &&
          (!filters.seniority.length || filters.seniority.includes(d.seniority)) &&
          (!filters.mode.length || filters.mode.includes(d.workMode)) &&
          (!filters.hiring.length || filters.hiring.some((type) => d.hiringTypes.includes(type))) &&
          (!filters.availability.length || filters.availability.includes(d.availability)) &&
          d.rate <= (filters.rate[0] ?? 300),
      ),
    [filters, developers],
  );
  const current = filtered[index];
  const changeFilters = (next: Filters) => {
    setFeedback(null);
    setFilters(next);
    setIndex(0);
    updateHistory([]);
  };
  const active = (
    ["skills", "seniority", "mode", "hiring", "availability"] as FilterGroup[]
  ).flatMap((group) => filters[group].map((value) => ({ group, value })));
  const rateActive = filters.rate[0] !== defaultFilters.rate[0];
  const finished = filtered.length > 0 && index >= filtered.length;
  const progress = filtered.length ? Math.min(index / filtered.length, 1) * 100 : 0;
  const undo = (entry = historyRef.current.at(-1)) => {
    if (!entry || historyRef.current.at(-1) !== entry) return;
    if (entry.addedSaved) removeSaved(entry.id);
    if (entry.addedInterest) removeInterest(entry.id);
    updateHistory(historyRef.current.slice(0, -1));
    setFeedback(null);
    setIndex(entry.index);
    toast(t.discover.undone, { description: entry.name });
  };
  const next = (action: "pass" | "save" | "interest") => {
    if (!current) return;
    const entry: HistoryEntry = {
      id: current.id,
      name: current.name,
      index,
      addedSaved: action !== "pass" && !saved.includes(current.id),
      addedInterest: action === "interest" && !interests.includes(current.id),
    };
    updateHistory([...historyRef.current, entry]);
    if (action !== "pass") {
      addSaved(current.id);
      if (action === "interest") registerInterest(current.id);
      setFeedback({ action, name: current.name });
    } else setFeedback(null);
    toast(
      action === "pass"
        ? t.discover.toastPass
        : action === "save"
          ? t.discover.toastSave
          : t.discover.toastInterest,
      {
        description: current.name,
        action: { label: t.discover.undo, onClick: () => undo(entry) },
      },
    );
    setIndex((i) => i + 1);
  };
  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap">
          <div>
            <span className="section-kicker">{t.discover.kicker}</span>
            <h1 className="mt-1 font-display text-3xl font-extrabold">{t.discover.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.discover.sub}</p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden">
                <Filter />
                {t.filters.title}
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetTitle className="sr-only">{t.discover.filtersA11y}</SheetTitle>
              <FilterPanel value={filters} onChange={changeFilters} />
            </SheetContent>
          </Sheet>
        </div>
        {(active.length > 0 || rateActive) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {active.map(({ group, value }) => (
              <button
                type="button"
                className="filter-chip filter-chip-active"
                key={group + value}
                aria-label={t.filters.remove + ": " + tv(value)}
                onClick={() =>
                  changeFilters({
                    ...filters,
                    [group]: filters[group].filter((item) => item !== value),
                  })
                }
              >
                {tv(value)} <span aria-hidden="true">×</span>
              </button>
            ))}
            {rateActive && (
              <button
                type="button"
                className="filter-chip filter-chip-active"
                aria-label={t.filters.remove + ": " + t.filters.maxRate}
                onClick={() => changeFilters({ ...filters, rate: defaultFilters.rate })}
              >
                {t.filters.maxRate}: {formatCurrency(filters.rate[0] ?? 300)}{" "}
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
        )}
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,500px)_1fr]">
          <aside className="sticky top-24 hidden rounded-lg border bg-card p-5 lg:block">
            <FilterPanel value={filters} onChange={changeFilters} />
          </aside>
          <section className="mx-auto min-w-0 w-full max-w-[500px]">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>
                {loading ? (
                  <Skeleton className="h-4 w-24" />
                ) : filtered.length ? (
                  `${Math.min(index + 1, filtered.length)} ${t.discover.of} ${filtered.length} ${t.discover.profiles(filtered.length)}`
                ) : (
                  t.discover.none
                )}
              </span>
              <span className="flex items-center gap-3">
                {Math.round(progress)}% {t.discover.explored}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!history.length}
                  onClick={() => undo()}
                >
                  <Undo2 />
                  {t.discover.undo}
                </Button>
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
            {feedback && (
              <p
                role="status"
                className={`mt-4 flex items-center gap-2 rounded-md border p-3 text-sm ${feedback.action === "interest" ? "border-positive/30 bg-positive-soft text-positive" : "bg-muted text-foreground"}`}
              >
                {feedback.action === "interest" ? (
                  <Check className="size-4 shrink-0" />
                ) : (
                  <Bookmark className="size-4 shrink-0" />
                )}
                <span>
                  {feedback.name}:{" "}
                  {feedback.action === "interest"
                    ? t.discover.interestFeedback
                    : t.discover.saveFeedback}
                </span>
              </p>
            )}
            <div className="relative mt-5 sm:min-h-[570px]" aria-busy={loading}>
              {loading ? (
                <>
                  <span role="status" className="sr-only">
                    {t.common.loading}
                  </span>
                  <DeveloperCardSkeleton showProfile />
                </>
              ) : isError ? (
                <div className="grid min-h-[500px] place-items-center rounded-lg border border-dashed bg-card p-8 text-center">
                  <div role="alert">
                    <h2 className="text-xl font-bold">{t.discover.loadError}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{t.discover.loadErrorSub}</p>
                    <Button className="mt-5" onClick={() => void refetch()}>
                      <RotateCcw />
                      {t.common.retry}
                    </Button>
                  </div>
                </div>
              ) : finished ? (
                <div className="grid min-h-[500px] place-items-center rounded-lg border bg-card p-8 text-center">
                  <div>
                    <Check className="mx-auto size-12 text-positive" />
                    <h2 className="mt-4 text-xl font-bold">{t.discover.finishedTitle}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{t.discover.finishedSub}</p>
                    <Button
                      className="mt-5"
                      onClick={() => {
                        setIndex(0);
                        setFeedback(null);
                        updateHistory([]);
                      }}
                    >
                      <RotateCcw />
                      {t.discover.restart}
                    </Button>
                  </div>
                </div>
              ) : !current ? (
                <div className="grid min-h-[500px] place-items-center rounded-lg border border-dashed bg-card p-8 text-center">
                  <div>
                    <SearchOff />
                    <h2 className="mt-4 text-xl font-bold">{t.discover.emptyTitle}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{t.discover.emptySub}</p>
                    <Button className="mt-5" onClick={() => changeFilters(defaultFilters)}>
                      <RotateCcw />
                      {t.discover.clearFilters}
                    </Button>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${current.id}-${index}`}
                    drag={reduceMotion ? false : "x"}
                    dragConstraints={{ left: 0, right: 0 }}
                    style={reduceMotion ? {} : { x, rotate }}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 100) next("interest");
                      else if (info.offset.x < -100) next("pass");
                    }}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                    transition={reduceMotion ? { duration: 0 } : {}}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <motion.div
                      aria-hidden="true"
                      style={{ opacity: yesOpacity }}
                      className="pointer-events-none absolute right-5 top-24 z-20 rotate-6 rounded-md border-2 border-positive bg-positive-soft px-4 py-2 font-display text-xl font-extrabold text-positive"
                    >
                      {t.discover.stampYes}
                    </motion.div>
                    <motion.div
                      aria-hidden="true"
                      style={{ opacity: noOpacity }}
                      className="pointer-events-none absolute left-5 top-24 z-20 -rotate-6 rounded-md border-2 border-destructive bg-danger-soft px-4 py-2 font-display text-xl font-extrabold text-destructive"
                    >
                      {t.discover.stampNo}
                    </motion.div>
                    <DeveloperCard developer={current} showProfile />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
            {(current || loading) && (
              <div className="sticky bottom-0 z-20 mt-3 grid grid-cols-3 gap-2 rounded-lg border bg-background/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-soft backdrop-blur sm:static sm:mt-5 sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
                <Button
                  variant="outline"
                  className="h-14 min-w-0 flex-col gap-1 border-destructive/30 px-1 text-xs text-destructive hover:bg-danger-soft sm:h-12 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm"
                  disabled={loading}
                  onClick={() => next("pass")}
                >
                  <X />
                  {t.discover.pass}
                </Button>
                <Button
                  variant="outline"
                  className="h-14 min-w-0 flex-col gap-1 px-1 text-xs sm:h-12 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm"
                  disabled={loading}
                  onClick={() => next("save")}
                >
                  <Bookmark />
                  {t.discover.save}
                </Button>
                <Button
                  className="h-14 min-w-0 flex-col gap-1 bg-positive px-1 text-xs hover:bg-positive/90 sm:h-12 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm"
                  disabled={loading}
                  onClick={() => next("interest")}
                >
                  <Check />
                  {t.discover.interested}
                </Button>
              </div>
            )}
          </section>
          <aside className="sticky top-24 hidden space-y-4 xl:block">
            {loading && (
              <div className="space-y-5 rounded-lg border bg-card p-5" aria-hidden="true">
                <Skeleton className="h-3 w-28" />
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-4 w-36" />
                ))}
              </div>
            )}
            {current && (
              <>
                <div className="rounded-lg border bg-card p-5">
                  <p className="text-xs font-bold uppercase text-muted-foreground">
                    {t.discover.compat}
                  </p>
                  <div className="mt-5 space-y-3">
                    {[tv(current.seniority), tv(current.workMode), tv(current.availability)].map(
                      (x) => (
                        <p className="flex items-center gap-2 text-sm" key={x}>
                          <Check className="size-4 text-positive" />
                          {x}
                        </p>
                      ),
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
const noDevelopers: Developer[] = [];

type HistoryEntry = {
  id: string;
  name: string;
  index: number;
  addedSaved: boolean;
  addedInterest: boolean;
};

function SearchOff() {
  return (
    <div className="mx-auto grid size-12 place-items-center rounded-lg bg-muted">
      <Filter className="text-muted-foreground" />
    </div>
  );
}
