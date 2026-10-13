import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { DeveloperProfileView } from "@/components/developer-profile";
import { MatchBreakdown } from "@/components/job-match";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { Button } from "@/components/ui/button";
import type { Developer } from "@/lib/developers";
import { fetchPublishedProfile } from "@/lib/profile-api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { matchJob } from "@/lib/job-match";
import { jobCandidatesQuery, jobQuery } from "@/lib/jobs-api";

export const Route = createFileRoute("/developer/$id")({
  // ?job=<id>: seen from one of the company's jobs, so saving and proposing a call count there.
  validateSearch: (search: Record<string, unknown>): { job?: string } =>
    typeof search["job"] === "string" ? { job: search["job"] } : {},
  // The id is the developer's account id.
  loader: ({ params }) => fetchPublishedProfile({ data: params.id }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: "Stack Match",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.role}, ${loaderData.seniority}, disponível para novos projetos.`
          : "Perfil indisponível.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.name} — Stack Match` : "Perfil não encontrado",
      },
      { property: "og:description", content: loaderData?.bio ?? "Perfil indisponível." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeveloperPage,
});
function DeveloperPage() {
  const d = Route.useLoaderData();
  return d ? <DeveloperProfile d={d} /> : <ProfileNotFound />;
}

function DeveloperProfile({ d }: { d: Developer }) {
  const { t, tv } = useI18n();
  useLocalizedMeta(d.name + " — Stack Match", tv(d.bio, d.translations));
  const { job: jobId } = Route.useSearch();
  return (
    <main className="pb-20">
      <DeveloperProfileView
        developer={d}
        noProjects={t.profile.noProjects}
        top={
          jobId ? (
            <>
              <Link
                to="/jobs/$id"
                params={{ id: jobId }}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                {t.jobs.backToJob}
              </Link>
              <JobMatchFor developer={d} jobId={jobId} />
            </>
          ) : (
            <Link
              to="/discover"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t.profile.back}
            </Link>
          )
        }
        actions={
          <>
            {jobId ? (
              <JobMembership developerId={d.id} jobId={jobId} />
            ) : (
              <SaveTalent developerId={d.id} />
            )}
            <ScheduleDialog developerId={d.id} developerName={d.name} jobId={jobId} />
          </>
        }
      />
    </main>
  );
}

/**
 * Adds the profile to the company's shortlist or takes it out. The button changes right away; the
 * confirmation shows once the server kept the change (a failure says so and puts the list back,
 * see AppProvider). Only confirmed companies have a shortlist: visitors go to the login and
 * unconfirmed accounts to the confirmation, both coming back here, and developers are told why not.
 */
function SaveTalent({ developerId }: { developerId: string }) {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const { pathname } = useLocation();
  const { hydrated, saved, addSaved, removeSaved } = useApp();
  const isSaved = saved.includes(developerId);
  const label = (
    <>
      <Bookmark />
      {isSaved ? t.profile.saved : t.profile.save}
    </>
  );
  if (!ready)
    return (
      <Button variant="outline" disabled>
        {label}
      </Button>
    );
  if (!user || !user.emailVerified)
    return (
      <Button asChild variant="outline">
        <Link to={user ? "/verify-email" : "/login"} search={{ redirect: pathname }}>
          {label}
        </Link>
      </Button>
    );
  if (user.accountType !== "company")
    return (
      <Button variant="outline" onClick={() => toast.info(t.profile.companyOnly)}>
        {label}
      </Button>
    );
  return (
    <Button
      variant={isSaved ? "secondary" : "outline"}
      // The shortlist must be known first: a failed load would show every profile as not saved.
      disabled={!hydrated}
      onClick={() => {
        void (isSaved ? removeSaved(developerId) : addSaved(developerId)).then((kept) => {
          if (kept) toast(isSaved ? t.profile.toastRemoved : t.profile.toastSaved);
        });
      }}
    >
      {label}
    </Button>
  );
}

/** No catalog entry or developer account has this profile. */
function ProfileNotFound() {
  const { t } = useI18n();
  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">{t.common.notFound}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.common.notFoundDescription}</p>
        <Button asChild className="mt-6">
          <Link to="/discover">{t.profile.back}</Link>
        </Button>
      </div>
    </main>
  );
}

/**
 * Inside a job: adds the developer to it (and to the shortlist) as saved, or says the stage they
 * are at. Taking them out happens on the job page.
 */
function JobMembership({ developerId, jobId }: { developerId: string; jobId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { hydrated, addSaved } = useApp();
  const queryClient = useQueryClient();
  const candidatesQuery = jobCandidatesQuery(user?.id ?? "", jobId);
  const { data: candidates } = useQuery({ ...candidatesQuery, enabled: Boolean(user) });
  const stage = candidates?.find((candidate) => candidate.developerId === developerId)?.stage;
  if (stage)
    return (
      <Button asChild variant="secondary">
        <Link to="/jobs/$id" params={{ id: jobId }}>
          <BriefcaseBusiness />
          {t.jobs.inJob(t.jobs.stages[stage])}
        </Link>
      </Button>
    );
  return (
    <Button
      variant="outline"
      disabled={!candidates || !hydrated}
      onClick={() => {
        void addSaved(developerId, jobId).then((kept) => {
          if (kept) toast(t.jobs.addedToJob);
          // Not added after all: show the job's candidates as the server has them.
          else void queryClient.invalidateQueries({ queryKey: candidatesQuery.queryKey });
        });
        queryClient.setQueryData(candidatesQuery.queryKey, (current) => [
          ...(current ?? []),
          {
            developerId,
            stage: "saved" as const,
            stageChangedAt: new Date().toISOString(),
            appliedAt: null,
            applicationMessage: "",
            withdrawnAt: null,
            note: "",
          },
        ]);
      }}
    >
      <Bookmark />
      {t.jobs.addToJob}
    </Button>
  );
}

/** How much of the job the profile meets, criterion by criterion. */
function JobMatchFor({ developer, jobId }: { developer: Developer; jobId: string }) {
  const { user } = useAuth();
  const { data: job } = useQuery({ ...jobQuery(user?.id ?? "", jobId), enabled: Boolean(user) });
  if (!job) return null;
  return <MatchBreakdown match={matchJob(job, developer)} className="mt-4 max-w-xl" />;
}
