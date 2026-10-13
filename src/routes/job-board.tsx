import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { useEffect, useState, type CSSProperties } from "react";
import { enUS, ptBR } from "react-day-picker/locale";
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  MapPin,
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import { JobDetails } from "@/components/job-details";
import { MatchBreakdown } from "@/components/job-match";
import { ApplyDialog } from "@/components/open-jobs";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { workModeOptions } from "@/lib/developers";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { matchJob, type JobMatch } from "@/lib/job-match";
import type { BoardJob, JobBoardSort } from "@/lib/jobs";
import { jobBoardQuery } from "@/lib/jobs-api";
import { myProfileQuery } from "@/lib/profile-api";
import type { Translations } from "@/lib/translations";
import { useCompensationLabel } from "@/lib/use-compensation-label";

export const Route = createFileRoute("/job-board")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Vagas abertas publicadas pelas empresas." },
      { property: "og:title", content: "Vagas — Stack Match" },
    ],
  }),
  component: () => (
    <RequireAccount type="developer">
      <JobBoardPage />
    </RequireAccount>
  ),
});

function JobBoardPage() {
  const { t } = useI18n();
  useLocalizedMeta(`${t.jobBoard.title} — Stack Match`, t.jobBoard.sub);
  const { user } = useAuth();
  // RequireAccount only renders this page for a signed-in developer.
  return user ? <JobBoard user={user} /> : null;
}

type WorkMode = (typeof workModeOptions)[number];

/** How long typing waits before searching, so each key doesn't make a request. */
const searchDelayMs = 300;

/**
 * The open jobs companies listed, with how much of each the developer's profile meets. The server
 * searches, filters, orders and pages them (see listJobBoard); a page loads at a time.
 */
function JobBoard({ user }: { user: AuthUser }) {
  const { t, tv } = useI18n();
  // Assume a profile until the server says otherwise, so the notice never flashes.
  const { data: profile } = useQuery(myProfileQuery(user.id));
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), searchDelayMs);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [modes, setModes] = useState<WorkMode[]>([]);
  const [sort, setSort] = useState<JobBoardSort>("match");
  const [applying, setApplying] = useState<BoardJob | null>(null);
  const query = jobBoardQuery(user.id, { search: term, modes, sort });
  // The previous results stay while a new search loads.
  const board = useInfiniteQuery({ ...query, placeholderData: keepPreviousData });
  const { isPending, isError, refetch } = board;
  const pages = board.data?.pages ?? [];
  const translations = Object.assign({}, ...pages.map((page) => page.translations)) as Translations;
  const total = pages[0]?.total ?? 0;
  // A job whose score changed between pages could come twice; it shows once.
  const seen = new Set<string>();
  const entries = pages
    .flatMap((page) => page.jobs)
    .filter((job) => !seen.has(job.id) && Boolean(seen.add(job.id)))
    .map((job) => ({ job, match: profile ? matchJob(job, profile) : null }));
  const filtered = Boolean(term || modes.length);

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{t.jobBoard.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{t.jobBoard.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.jobBoard.sub}</p>

      {profile === null && (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{t.jobBoard.noProfile}</p>
          <Button asChild size="sm">
            <Link to="/create-profile">{t.jobBoard.createProfile}</Link>
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-end">
        <label className="min-w-0 flex-1 text-sm font-medium">
          {t.jobBoard.search}
          <span className="relative mt-2 block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              className="pl-9"
              placeholder={t.jobBoard.searchPh}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </span>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">{t.jobBoard.workModes}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {workModeOptions.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={modes.includes(mode)}
                className={modes.includes(mode) ? "filter-chip filter-chip-active" : "filter-chip"}
                onClick={() =>
                  setModes((current) =>
                    current.includes(mode)
                      ? current.filter((item) => item !== mode)
                      : [...current, mode],
                  )
                }
              >
                {tv(mode)}
              </button>
            ))}
          </div>
        </fieldset>
        {profile && (
          <label className="text-sm font-medium">
            {t.jobBoard.sort}
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as JobBoardSort)}
              className="mt-2 block h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="match">{t.jobBoard.sortMatch}</option>
              <option value="recent">{t.jobBoard.sortRecent}</option>
            </select>
          </label>
        )}
      </div>

      {isPending ? (
        <div className="mt-6 space-y-4" aria-busy="true">
          <span role="status" className="sr-only">
            {t.common.loading}
          </span>
          <Skeleton className="h-36 w-full rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
      ) : isError && !entries.length ? (
        <div role="alert" className="mt-6 rounded-lg border border-dashed bg-card p-8 text-center">
          <p className="font-semibold">{t.jobBoard.loadError}</p>
          <Button className="mt-4" onClick={() => void refetch()}>
            <RotateCcw />
            {t.common.retry}
          </Button>
        </div>
      ) : !entries.length ? (
        <div className="mt-6 rounded-lg border border-dashed bg-card p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
            <BriefcaseBusiness aria-hidden="true" />
          </span>
          {filtered ? (
            <>
              <p className="mt-4 font-semibold">{t.jobBoard.noResults}</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setModes([]);
                }}
              >
                {t.jobBoard.clear}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-4 font-semibold">{t.jobBoard.empty}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.jobBoard.emptySub}</p>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mt-6 text-xs font-semibold text-muted-foreground" role="status">
            {t.jobBoard.count(total)}
          </p>
          <ul className="mt-3 space-y-4">
            {entries.map(({ job, match }, index) => (
              <BoardItem
                key={job.id}
                job={job}
                match={match}
                translations={translations}
                canApply={profile !== null}
                onApply={() => setApplying(job)}
                index={index}
              />
            ))}
          </ul>
          {board.isFetchNextPageError && (
            <p role="alert" className="mt-6 text-center text-sm text-muted-foreground">
              {t.jobBoard.loadError}
            </p>
          )}
          {board.hasNextPage && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                disabled={board.isFetchingNextPage}
                onClick={() => void board.fetchNextPage()}
              >
                {board.isFetchingNextPage ? t.common.loading : t.jobBoard.loadMore}
              </Button>
            </div>
          )}
        </>
      )}

      <ApplyDialog
        job={applying}
        translations={translations}
        onClose={() => setApplying(null)}
        onApplied={(jobId, appliedAt) =>
          queryClient.setQueryData(query.queryKey, (current) =>
            current
              ? {
                  ...current,
                  pages: current.pages.map((page) => ({
                    ...page,
                    jobs: page.jobs.map((job) => (job.id === jobId ? { ...job, appliedAt } : job)),
                  })),
                }
              : current,
          )
        }
      />
    </main>
  );
}

function BoardItem({
  job,
  match,
  translations,
  canApply,
  onApply,
  index,
}: {
  job: BoardJob;
  match: JobMatch | null;
  translations: Translations;
  canApply: boolean;
  onApply: () => void;
  index: number;
}) {
  const { t, tv, lang } = useI18n();
  const compensation = useCompensationLabel()(job);
  const title = tv(job.title, translations);
  const stack = [...job.requiredSkills, ...job.desiredSkills];
  return (
    <li
      className="stagger-item rounded-lg border bg-card p-5 shadow-sm"
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <article aria-label={title}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold">{title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Building2 className="size-4" aria-hidden="true" />
                {job.company}
              </span>
              {job.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {job.location}
                </span>
              )}
            </p>
            {compensation && <p className="mt-1 text-sm font-medium">{compensation}</p>}
          </div>
          {match?.score != null && (
            <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
              {t.jobs.match.score(match.score)}
            </span>
          )}
        </div>
        {stack.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label={t.jobs.form.stack}>
            {stack.slice(0, 8).map((skill) => (
              <li key={skill} className="skill-chip">
                {skill}
              </li>
            ))}
            {stack.length > 8 && (
              <li className="skill-chip text-muted-foreground">+{stack.length - 8}</li>
            )}
          </ul>
        )}
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">{t.jobs.showDetails}</span>
            <span className="hidden group-open:inline">{t.jobs.hideDetails}</span>
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <JobDetails job={job} translations={translations} />
            {match && <MatchBreakdown match={match} />}
          </div>
        </details>
        <div className="mt-4">
          {job.appliedAt ? (
            <p
              className={`flex items-center gap-1.5 text-sm font-semibold ${job.withdrawnAt ? "text-muted-foreground" : "text-positive"}`}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {(job.withdrawnAt ? t.openJobs.withdrawn : t.openJobs.applied)(
                format(new Date(job.withdrawnAt ?? job.appliedAt), t.interests.dateFormat, {
                  locale: lang === "pt" ? ptBR : enUS,
                }),
              )}
            </p>
          ) : (
            <Button
              size="sm"
              disabled={!canApply}
              aria-label={`${t.openJobs.apply}: ${title}`}
              onClick={onApply}
            >
              <Send />
              {t.openJobs.apply}
            </Button>
          )}
        </div>
      </article>
    </li>
  );
}
