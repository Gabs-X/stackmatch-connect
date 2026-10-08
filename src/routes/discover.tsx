import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { Bookmark, BriefcaseBusiness, Check, Filter, RotateCcw, Undo2, X } from "lucide-react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DeveloperCard } from "@/components/developer-card";
import { DeveloperCardSkeleton } from "@/components/developer-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterPanel } from "@/components/filter-panel";
import { usePlaceLabel } from "@/lib/use-place-label";
import { MatchBreakdown } from "@/components/job-match";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Developer } from "@/lib/developers";
import {
  canUndo,
  createHistoryEntry,
  type DiscoverAction,
  type HistoryEntry,
} from "@/lib/discover-history";
import { defaultFilters, type FilterGroup, type Filters } from "@/lib/filters";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { matchJob } from "@/lib/job-match";
import { jobFilters, type Job } from "@/lib/jobs";
import { jobCandidatesQuery, jobQuery } from "@/lib/jobs-api";
import { discoverQuery } from "@/lib/profile-api";

export const Route = createFileRoute("/discover")({
  // ?job=<id>: searching for one of the company's jobs (see src/lib/jobs.ts).
  validateSearch: (search: Record<string, unknown>): { job?: string } =>
    typeof search["job"] === "string" ? { job: search["job"] } : {},
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
  component: () => (
    <RequireAccount type="company">
      <DiscoverRoute />
    </RequireAccount>
  ),
});

function DiscoverRoute() {
  const { job: jobId } = Route.useSearch();
  const { t } = useI18n();
  const { user } = useAuth();
  const accountId = user?.id ?? "";
  const job = useQuery({ ...jobQuery(accountId, jobId ?? ""), enabled: Boolean(jobId && user) });
  const candidates = useQuery({
    ...jobCandidatesQuery(accountId, jobId ?? ""),
    enabled: Boolean(jobId && user),
  });
  if (!jobId) return <DiscoverPage key="all" />;
  // Fresh, not cached: who is already in the job decides what this round leaves out.
  if (job.data && candidates.data && candidates.isFetchedAfterMount)
    return (
      <DiscoverPage
        key={jobId}
        job={job.data}
        members={candidates.data.map((candidate) => candidate.developerId)}
      />
    );
  const missing = job.data === null || candidates.data === null;
  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 text-center">
      {missing || job.isError || candidates.isError ? (
        <div role="alert">
          <p className="text-sm text-muted-foreground">
            {missing ? t.jobs.notFound : t.jobs.loadError}
          </p>
          <Button asChild className="mt-4">
            <Link to="/jobs">{t.jobs.backToJobs}</Link>
          </Button>
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {t.common.loading}
        </p>
      )}
    </main>
  );
}

/**
 * The cards, one at a time. Inside a job, it starts from the job's filters, leaves out the developers
 * already in it (instead of the saved ones) and adds each saved or marked developer to it.
 */
function DiscoverPage({ job, members: initialMembers }: { job?: Job; members?: string[] }) {
  const { t, tv } = useI18n();
  const placeLabel = usePlaceLabel();
  useLocalizedMeta(t.discover.title + " — Stack Match", t.discover.sub);

  const [filters, setFilters] = useState<Filters>(job ? jobFilters(job) : defaultFilters);
  // Developers in the job, kept here as this round adds and undoes them.
  const [members, setMembers] = useState<readonly string[]>(initialMembers ?? noIds);
  const [index, setIndex] = useState(0);
  const {
    hydrated,
    saved,
    interests,
    addSaved,
    registerInterest,
    removeSaved,
    removeInterest,
    leaveJob,
  } = useApp();
  // What a round leaves out: the saved profiles, or inside a job, the ones already in it.
  const alreadyIn = job ? members : saved;
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
  // Profiles already in the shortlist (or the job) when this round started stay out of Discover.
  // Ones saved during the round stay in place, so the position, the counter and undo keep working.
  const [hiddenIds, setHiddenIds] = useState<readonly string[] | null>(null);
  useEffect(() => {
    if (hydrated) setHiddenIds((current) => current ?? alreadyIn);
  }, [hydrated, alreadyIn]);
  // The server filters and sends the profiles a page at a time, leaving out the hidden ones.
  const { data, isPending, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      ...discoverQuery(filters, hiddenIds ?? noIds, job?.id),
      enabled: hiddenIds !== null,
    });
  const loaded = useMemo(
    () => data?.pages.flatMap((page) => page.developers) ?? noDevelopers,
    [data],
  );
  const total = data?.pages.at(-1)?.total ?? 0;
  const hiddenCount = data?.pages.at(-1)?.hidden ?? 0;
  // Ask for the next page a few profiles before the loaded ones run out.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && index >= loaded.length - 5) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, index, loaded.length, fetchNextPage]);
  const current = loaded[index];
  const currentMatch = job && current ? matchJob(job, current) : null;
  const loading =
    (isPending && !isError) || hiddenIds === null || (!current && index < total && !isError);
  const startRound = () => {
    setHiddenIds(alreadyIn);
    setIndex(0);
    setFeedback(null);
    updateHistory([]);
  };
  const changeFilters = (next: Filters) => {
    setFeedback(null);
    setFilters(next);
    setHiddenIds(alreadyIn);
    setIndex(0);
    updateHistory([]);
  };
  const active = (
    ["skills", "seniority", "mode", "hiring", "availability", "places"] as FilterGroup[]
  ).flatMap((group) => filters[group].map((value) => ({ group, value })));
  const chipLabel = (group: FilterGroup, value: string) =>
    group === "places" ? placeLabel(value) : tv(value);
  const finished = total > 0 && index >= total;
  const progress = total ? Math.min(index / total, 1) * 100 : 0;
  const undo = (entry = historyRef.current.at(-1)) => {
    if (!entry || !canUndo(entry, historyRef.current)) return;
    if (entry.addedSaved) removeSaved(entry.id);
    if (entry.addedInterest) removeInterest(entry.id);
    if (job && entry.addedToJob) {
      leaveJob(entry.id, job.id);
      setMembers((ids) => ids.filter((id) => id !== entry.id));
    }
    updateHistory(historyRef.current.slice(0, -1));
    setFeedback(null);
    setIndex(entry.index);
    toast(t.discover.undone, { description: entry.name });
  };
  const next = (action: DiscoverAction) => {
    if (!current) return;
    const entry = createHistoryEntry(
      current,
      action,
      index,
      saved,
      interests,
      job ? members : null,
    );
    updateHistory([...historyRef.current, entry]);
    if (action !== "pass") {
      addSaved(current.id, job?.id);
      if (action === "interest") registerInterest(current.id, job?.id);
      if (job && entry.addedToJob) setMembers((ids) => [...ids, current.id]);
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
        <div className="stagger-item flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap">
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
        {job && (
          <JobBanner
            job={job}
            changed={JSON.stringify(filters) !== JSON.stringify(jobFilters(job))}
            onReset={() => changeFilters(jobFilters(job))}
          />
        )}
        {active.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {active.map(({ group, value }) => (
              <button
                type="button"
                className="filter-chip filter-chip-active"
                key={group + value}
                aria-label={t.filters.remove + ": " + chipLabel(group, value)}
                onClick={() =>
                  changeFilters({
                    ...filters,
                    [group]: filters[group].filter((item) => item !== value),
                  })
                }
              >
                {chipLabel(group, value)} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-7 grid items-start gap-8 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,500px)_1fr]">
          <aside className="stagger-item stagger-1 sticky top-24 hidden rounded-lg border bg-card p-5 lg:block">
            <FilterPanel value={filters} onChange={changeFilters} />
          </aside>
          <section className="stagger-item stagger-2 mx-auto min-w-0 w-full max-w-[500px]">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex flex-wrap items-center gap-x-2">
                <span>
                  {loading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : total ? (
                    `${Math.min(index + 1, total)} ${t.discover.of} ${total} ${t.discover.profiles(total)}`
                  ) : (
                    t.discover.none
                  )}
                </span>
                {!loading && hiddenCount > 0 && total > 0 && (
                  <Link
                    {...(job ? { to: "/jobs/$id", params: { id: job.id } } : { to: "/saved" })}
                    className="font-normal underline-offset-4 hover:underline"
                  >
                    {job ? t.jobs.hiddenInJob(hiddenCount) : t.discover.hiddenSaved(hiddenCount)}
                  </Link>
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
                    <Button className="mt-5" onClick={startRound}>
                      <RotateCcw />
                      {t.discover.restart}
                    </Button>
                  </div>
                </div>
              ) : !current && hiddenCount > 0 ? (
                <div className="grid min-h-[500px] place-items-center rounded-lg border border-dashed bg-card p-8 text-center">
                  <div>
                    <Bookmark className="mx-auto size-12 text-primary" />
                    <h2 className="mt-4 text-xl font-bold">
                      {job ? t.jobs.allInJobTitle : t.discover.allSavedTitle}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {job ? t.jobs.allInJobSub : t.discover.allSavedSub}
                    </p>
                    <Button asChild className="mt-5">
                      {job ? (
                        <Link to="/jobs/$id" params={{ id: job.id }}>
                          {t.jobs.viewJob}
                        </Link>
                      ) : (
                        <Link to="/saved">{t.discover.viewSaved}</Link>
                      )}
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
                    <DeveloperCard
                      developer={current}
                      showProfile
                      jobId={job?.id}
                      match={currentMatch?.score}
                    />
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
          <aside className="stagger-item stagger-3 sticky top-24 hidden space-y-4 xl:block">
            {loading && (
              <div className="space-y-5 rounded-lg border bg-card p-5" aria-hidden="true">
                <Skeleton className="h-3 w-28" />
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-4 w-36" />
                ))}
              </div>
            )}
            {currentMatch && <MatchBreakdown match={currentMatch} />}
            {current && !currentMatch && (
              <>
                <div className="rounded-lg border bg-card p-5">
                  <p className="text-xs font-bold uppercase text-muted-foreground">
                    {t.discover.compat}
                  </p>
                  <div className="mt-5 space-y-3">
                    {[current.seniority, current.workMode, current.availability]
                      .filter(Boolean)
                      .map((value) => tv(value))
                      .map((x) => (
                        <p className="flex items-center gap-2 text-sm" key={x}>
                          <Check className="size-4 text-positive" />
                          {x}
                        </p>
                      ))}
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
const noIds: string[] = [];

function SearchOff() {
  return (
    <div className="mx-auto grid size-12 place-items-center rounded-lg bg-muted">
      <Filter className="text-muted-foreground" />
    </div>
  );
}

/** Which job Discover is searching for, with a way back to its filters and out of it. */
function JobBanner({ job, changed, onReset }: { job: Job; changed: boolean; onReset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="stagger-item mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <BriefcaseBusiness className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-muted-foreground">{t.jobs.searchingFor}</span>
        <Link
          to="/jobs/$id"
          params={{ id: job.id }}
          className="truncate font-semibold underline-offset-4 hover:underline"
        >
          {job.title}
        </Link>
      </p>
      <span className="flex flex-wrap gap-2">
        {changed && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw />
            {t.jobs.resetFilters}
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to="/discover">{t.jobs.leaveJob}</Link>
        </Button>
      </span>
    </div>
  );
}
