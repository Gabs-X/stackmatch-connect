import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { DeveloperProfileView } from "@/components/developer-profile";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { Button } from "@/components/ui/button";
import type { Developer } from "@/lib/developers";
import { fetchPublishedProfile } from "@/lib/profile-api";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/developer/$id")({
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
  const { saved, toggleSaved } = useApp();
  const isSaved = saved.includes(d.id);
  return (
    <main className="pb-20">
      <DeveloperProfileView
        developer={d}
        noProjects={t.profile.noProjects}
        top={
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t.profile.back}
          </Link>
        }
        actions={
          <>
            <Button
              variant={isSaved ? "secondary" : "outline"}
              onClick={() => {
                toggleSaved(d.id);
                toast(isSaved ? t.profile.toastRemoved : t.profile.toastSaved);
              }}
            >
              <Bookmark />
              {isSaved ? t.profile.saved : t.profile.save}
            </Button>
            <ScheduleDialog developerId={d.id} developerName={d.name} />
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
