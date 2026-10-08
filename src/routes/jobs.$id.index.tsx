import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserMinus,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { DeveloperCard } from "@/components/developer-card";
import { DeveloperCardSkeleton } from "@/components/developer-card-skeleton";
import { JobDetails } from "@/components/job-details";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { matchJob } from "@/lib/job-match";
import { jobStages, type Job, type JobCandidate, type JobStage } from "@/lib/jobs";
import {
  deleteJobFn,
  jobCandidatesQuery,
  jobQuery,
  jobsQueryKey,
  moveCandidateFn,
  removeCandidateFn,
  setJobStatusFn,
} from "@/lib/jobs-api";
import { profilesByIdQuery } from "@/lib/profile-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jobs/$id/")({
  head: () => ({ meta: [{ title: "Stack Match" }] }),
  component: () => (
    <RequireAccount type="company">
      <JobPage />
    </RequireAccount>
  ),
});

function JobPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const accountId = user?.id ?? "";
  const job = useQuery(jobQuery(accountId, id));
  const candidates = useQuery(jobCandidatesQuery(accountId, id));
  useLocalizedMeta((job.data?.title ?? t.jobs.title) + " — Stack Match", t.jobs.sub);
  if (job.data && candidates.data)
    return <JobView job={job.data} candidates={candidates.data} accountId={accountId} />;
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

function JobView({
  job,
  candidates,
  accountId,
}: {
  job: Job;
  candidates: JobCandidate[];
  accountId: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [stage, setStage] = useState<JobStage | "all">("all");
  const closed = job.status === "closed";
  const refresh = () => queryClient.invalidateQueries({ queryKey: jobsQueryKey });
  const counts = Object.fromEntries(
    jobStages.map((value) => [value, candidates.filter((c) => c.stage === value).length]),
  ) as Record<JobStage, number>;
  // Back to every stage when the last developer leaves the chosen one.
  const activeStage = stage !== "all" && counts[stage] === 0 ? "all" : stage;
  const shown = candidates.filter((c) => activeStage === "all" || c.stage === activeStage);

  const toggleStatus = async () => {
    try {
      await setJobStatusFn({ data: { id: job.id, status: closed ? "open" : "closed" } });
      await refresh();
      toast(closed ? t.jobs.reopened : t.jobs.closedToast);
    } catch {
      toast.error(t.jobs.saveError);
    }
  };
  const remove = async () => {
    try {
      await deleteJobFn({ data: job.id });
      await navigate({ to: "/jobs" });
      await refresh();
      toast(t.jobs.deleted);
    } catch {
      toast.error(t.jobs.saveError);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-20">
      <section className="stagger-item border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t.jobs.backToJobs}
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="section-kicker">{closed ? t.jobs.closed : t.jobs.open}</span>
              <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{job.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {!closed && (
                <Button asChild>
                  <Link to="/discover" search={{ job: job.id }}>
                    <Search />
                    {t.jobs.searchDiscover}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/jobs/$id/edit" params={{ id: job.id }}>
                  <Pencil />
                  {t.jobs.edit}
                </Link>
              </Button>
              <Button variant="outline" onClick={() => void toggleStatus()}>
                {closed ? <ArchiveRestore /> : <Archive />}
                {closed ? t.jobs.reopen : t.jobs.close}
              </Button>
              <DeleteJob title={job.title} onConfirm={remove} />
            </div>
          </div>
          <JobDetails job={job} className="mt-6 max-w-4xl" />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mt-10 text-xl font-bold">{t.jobs.pipeline}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.jobs.pipelineSub}</p>
        <div
          role="group"
          aria-label={t.jobs.stageFilter}
          className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3"
        >
          {(["all", ...jobStages] as const).map((value) => {
            const count = value === "all" ? candidates.length : counts[value];
            return (
              <button
                key={value}
                type="button"
                aria-pressed={activeStage === value}
                disabled={count === 0}
                onClick={() => setStage(value)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50",
                  activeStage === value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "bg-card hover:border-primary/50",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold",
                    activeStage === value ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {value === "all" ? t.jobs.allStages : t.jobs.stages[value]}
                </span>
                <span className="font-display text-2xl font-extrabold">{count}</span>
              </button>
            );
          })}
        </div>
        {candidates.length ? (
          <CandidateGrid job={job} candidates={shown} accountId={accountId} />
        ) : (
          <div className="mt-8 grid min-h-64 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
            <div>
              <h3 className="text-lg font-bold">{t.jobs.noCandidates}</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {t.jobs.noCandidatesSub}
              </p>
              {!closed && (
                <Button asChild className="mt-5">
                  <Link to="/discover" search={{ job: job.id }}>
                    <Search />
                    {t.jobs.searchDiscover}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CandidateGrid({
  job,
  candidates,
  accountId,
}: {
  job: Job;
  candidates: JobCandidate[];
  accountId: string;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const ids = candidates.map((candidate) => candidate.developerId);
  const { data, isPending, isError, refetch } = useQuery({
    ...profilesByIdQuery(ids),
    placeholderData: keepPreviousData,
  });
  const [sort, setSort] = useState<"match" | "added">("match");
  const candidatesKey = jobCandidatesQuery(accountId, job.id).queryKey;
  const refresh = () => queryClient.invalidateQueries({ queryKey: jobsQueryKey });
  const move = async (developerId: string, stage: JobStage) => {
    // Shown right away; the server's answer replaces it.
    queryClient.setQueryData(candidatesKey, (current) =>
      current?.map((c) => (c.developerId === developerId ? { ...c, stage } : c)),
    );
    try {
      await moveCandidateFn({ data: { jobId: job.id, developerId, stage } });
    } catch {
      toast.error(t.jobs.saveError);
    }
    await refresh();
  };
  const remove = async (developerId: string, name: string) => {
    queryClient.setQueryData(candidatesKey, (current) =>
      current?.filter((c) => c.developerId !== developerId),
    );
    try {
      await removeCandidateFn({ data: { jobId: job.id, developerId } });
      toast(t.jobs.removedFromJob, { description: name });
    } catch {
      toast.error(t.jobs.saveError);
    }
    await refresh();
  };

  if (isPending)
    return (
      <div
        className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        aria-busy="true"
      >
        <span role="status" className="sr-only">
          {t.common.loading}
        </span>
        {ids.slice(0, 8).map((id) => (
          <DeveloperCardSkeleton key={id} compact />
        ))}
      </div>
    );
  if (isError)
    return (
      <div role="alert" className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">{t.discover.loadError}</p>
        <Button className="mt-4" onClick={() => void refetch()}>
          <RotateCcw />
          {t.common.retry}
        </Button>
      </div>
    );
  const byId = new Map(data.developers.map((developer) => [developer.id, developer]));
  // Profiles deleted since they joined the job are left out.
  const entries = candidates.flatMap((candidate) => {
    const developer = byId.get(candidate.developerId);
    return developer ? [{ candidate, developer, match: matchJob(job, developer).score }] : [];
  });
  // Array.sort is stable: equal scores keep the order they joined in.
  if (sort === "match") entries.sort((a, b) => (b.match ?? -1) - (a.match ?? -1));
  return (
    <>
      <div className="mt-6 flex justify-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t.jobs.match.sortLabel}
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="h-9 rounded-md border bg-card px-2 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="match">{t.jobs.match.sortMatch}</option>
            <option value="added">{t.jobs.match.sortAdded}</option>
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entries.map(({ candidate, developer, match }, index) => {
          return (
            <div
              key={candidate.developerId}
              className="stagger-item flex flex-col gap-2"
              style={{ "--stagger-index": index } as CSSProperties}
            >
              <DeveloperCard developer={developer} compact jobId={job.id} match={match} />
              <div className="flex items-center gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
                  {t.jobs.stage}
                  <select
                    value={candidate.stage}
                    onChange={(event) =>
                      void move(candidate.developerId, event.target.value as JobStage)
                    }
                    aria-label={`${t.jobs.stage}: ${developer.name}`}
                    className="h-8 min-w-0 flex-1 rounded-md border bg-card px-2 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {jobStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {t.jobs.stages[stage]}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label={`${t.jobs.removeFromJob} ${developer.name}`}
                  title={t.jobs.removeFromJob}
                  onClick={() => void remove(candidate.developerId, developer.name)}
                >
                  <UserMinus />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DeleteJob({ title, onConfirm }: { title: string; onConfirm: () => Promise<void> }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <Trash2 />
          {t.jobs.delete}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{t.jobs.deleteTitle}</DialogTitle>
        <DialogDescription>{t.jobs.deleteSub(title)}</DialogDescription>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">{t.jobs.form.cancel}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onConfirm().finally(() => setBusy(false));
            }}
          >
            {t.jobs.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
