import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BriefcaseBusiness, Plus, RotateCcw, Search } from "lucide-react";
import type { CSSProperties } from "react";
import { RequireAccount } from "@/components/require-account";
import { useCompensationLabel } from "@/lib/use-compensation-label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { finalStages, isFinalStage, jobStages, type JobSummary } from "@/lib/jobs";
import { myJobsQuery } from "@/lib/jobs-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jobs/")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Suas vagas e escopos de contratação no StackMatch." },
      { property: "og:title", content: "Vagas — Stack Match" },
    ],
  }),
  component: () => (
    <RequireAccount type="company">
      <JobsPage />
    </RequireAccount>
  ),
});

function JobsPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.jobs.title + " — Stack Match", t.jobs.sub);
  const { user } = useAuth();
  const { data: jobs, isPending, isError, refetch } = useQuery(myJobsQuery(user?.id ?? ""));

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="stagger-item flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-kicker">{t.jobs.kicker}</span>
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">{t.jobs.title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t.jobs.sub}</p>
        </div>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus />
            {t.jobs.create}
          </Link>
        </Button>
      </div>

      {isPending ? (
        <div className="mt-9 grid gap-5 md:grid-cols-2" aria-busy="true">
          <span role="status" className="sr-only">
            {t.common.loading}
          </span>
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="mt-10 grid min-h-72 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
          <div role="alert">
            <h2 className="text-xl font-bold">{t.jobs.loadError}</h2>
            <Button className="mt-5" onClick={() => void refetch()}>
              <RotateCcw />
              {t.common.retry}
            </Button>
          </div>
        </div>
      ) : jobs.length ? (
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          {jobs.map((job, index) => (
            <JobCard key={job.id} job={job} index={index} />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid min-h-80 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
          <div>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
              <BriefcaseBusiness />
            </span>
            <h2 className="mt-5 text-xl font-bold">{t.jobs.emptyTitle}</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">{t.jobs.emptySub}</p>
            <Button asChild className="mt-5">
              <Link to="/jobs/new">
                <Plus />
                {t.jobs.create}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function JobCard({ job, index }: { job: JobSummary; index: number }) {
  const { t } = useI18n();
  const compensation = useCompensationLabel()(job);
  const closed = job.status === "closed";
  const stack = [...job.requiredSkills, ...job.desiredSkills];
  return (
    <article
      className={cn(
        "stagger-item flex flex-col rounded-xl border bg-card p-5 shadow-sm sm:p-6",
        closed && "opacity-75",
      )}
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-lg font-bold">
          <Link
            to="/jobs/$id"
            params={{ id: job.id }}
            className="underline-offset-4 hover:underline"
          >
            {job.title}
          </Link>
        </h2>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            closed ? "bg-muted text-muted-foreground" : "bg-positive-soft text-positive",
          )}
        >
          {closed ? t.jobs.closed : t.jobs.open}
        </span>
      </div>
      {compensation && <p className="mt-1 text-sm text-muted-foreground">{compensation}</p>}
      {!closed && job.listed && (
        <p className="mt-1 text-xs font-semibold text-primary">{t.jobs.listedBadge}</p>
      )}
      {stack.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {stack.slice(0, 6).map((skill) => (
            <li key={skill} className="skill-chip">
              {skill}
            </li>
          ))}
          {stack.length > 6 && (
            <li className="skill-chip text-muted-foreground">+{stack.length - 6}</li>
          )}
        </ul>
      )}
      <dl className="mt-5 grid grid-cols-4 gap-2 border-t pt-4 text-center">
        {jobStages
          .filter((stage) => !isFinalStage(stage))
          .map((stage) => (
            // Label first for screen readers, number on top on screen.
            <div key={stage} className="flex flex-col-reverse">
              <dt className="text-[0.7rem] leading-tight text-muted-foreground">
                {t.jobs.stages[stage]}
              </dt>
              <dd className="font-display text-xl font-extrabold">{job.counts[stage]}</dd>
            </div>
          ))}
      </dl>
      {finalStages.some((stage) => job.counts[stage] > 0) && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {finalStages
            .filter((stage) => job.counts[stage] > 0)
            .map((stage) => `${t.jobs.stages[stage]}: ${job.counts[stage]}`)
            .join(" · ")}
        </p>
      )}
      {job.applied > 0 && (
        <p className="mt-3 text-center text-xs font-semibold text-primary">
          {t.jobs.appliedCount(job.applied)}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/jobs/$id" params={{ id: job.id }}>
            {t.jobs.viewJob}
          </Link>
        </Button>
        {!closed && (
          <Button asChild size="sm">
            <Link to="/discover" search={{ job: job.id }}>
              <Search />
              {t.jobs.searchDiscover}
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}
