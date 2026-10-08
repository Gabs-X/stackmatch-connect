import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { DeveloperProfileView } from "@/components/developer-profile";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { Button } from "@/components/ui/button";
import type { Developer } from "@/lib/developers";
import { fetchPublishedProfile } from "@/lib/profile-api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { jobCandidatesQuery } from "@/lib/jobs-api";

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
  const { saved, addSaved, removeSaved } = useApp();
  const isSaved = saved.includes(d.id);
  return (
    <main className="pb-20">
      <DeveloperProfileView
        developer={d}
        noProjects={t.profile.noProjects}
        top={
          jobId ? (
            <Link
              to="/jobs/$id"
              params={{ id: jobId }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t.jobs.backToJob}
            </Link>
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
              <Button
                variant={isSaved ? "secondary" : "outline"}
                onClick={() => {
                  if (isSaved) removeSaved(d.id);
                  else addSaved(d.id);
                  toast(isSaved ? t.profile.toastRemoved : t.profile.toastSaved);
                }}
              >
                <Bookmark />
                {isSaved ? t.profile.saved : t.profile.save}
              </Button>
            )}
            <ScheduleDialog developerId={d.id} developerName={d.name} jobId={jobId} />
          </>
        }
      />
    </main>
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
  const { addSaved } = useApp();
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
      disabled={!candidates}
      onClick={() => {
        addSaved(developerId, jobId);
        queryClient.setQueryData(candidatesQuery.queryKey, (current) => [
          ...(current ?? []),
          { developerId, stage: "saved" as const, stageChangedAt: new Date().toISOString() },
        ]);
        toast(t.jobs.addedToJob);
      }}
    >
      <Bookmark />
      {t.jobs.addToJob}
    </Button>
  );
}
