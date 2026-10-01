import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, Check, ExternalLink, Github, Linkedin, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { Button } from "@/components/ui/button";
import { developers } from "@/lib/developers";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/developer/$id")({
  loader: ({ params }) => {
    const developer = developers.find((d) => d.id === params.id);
    if (!developer) throw notFound();
    return developer;
  },
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
  const { t, tv, formatCurrency } = useI18n();
  const d = Route.useLoaderData();
  useLocalizedMeta(d.name + " — Stack Match", tv(d.bio));
  const { saved, toggleSaved } = useApp();
  const isSaved = saved.includes(d.id);
  return (
    <main className="pb-20">
      <section className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t.profile.back}
          </Link>
          <div className="mt-8 flex flex-col gap-7 sm:flex-row sm:items-center">
            <img
              src={d.image}
              alt={d.name}
              width={768}
              height={768}
              className="size-36 rounded-xl bg-muted object-cover shadow-soft"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl font-extrabold">{d.name}</h1>
                <span className="level-badge">{tv(d.seniority)}</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-primary">{d.role}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {d.location} · {tv(d.workMode)}
                </span>
                <span className="flex items-center gap-1.5 text-positive">
                  <span className="status-dot" />
                  {tv(d.availability)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_300px] lg:px-8">
        <div className="space-y-12">
          <section>
            <h2 className="text-xl font-bold">{t.profile.about}</h2>
            <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">{tv(d.bio)}</p>
          </section>
          <section>
            <h2 className="text-xl font-bold">{t.profile.skills}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {d.skills.map((s) => (
                <span className="skill-chip px-3 py-2" key={s}>
                  {s}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-xl font-bold">{t.profile.experience}</h2>
            <div className="mt-5 border-l-2 border-primary pl-5">
              <p className="font-bold">
                {d.role} · {tv(d.seniority)}
              </p>
              <p className="text-sm text-primary">{tv(d.experience)}</p>
            </div>
          </section>
          <section id="portfolio" className="scroll-mt-24">
            <div>
              <span className="section-kicker">{t.profile.portfolioLink}</span>
              <h2 className="section-title">{t.profile.featured}</h2>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {d.projects.map((p) => (
                <article className="overflow-hidden rounded-lg border bg-card" key={p.name}>
                  <div className={`grid aspect-[16/10] place-items-center ${p.color}`}>
                    <span className="font-display text-4xl font-extrabold text-white">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold">{p.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {tv(p.description)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {p.tech.map((t) => (
                        <span className="skill-chip" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 flex gap-4 text-xs font-bold">
                      <button
                        type="button"
                        disabled
                        title={t.profile.unavailableLinks}
                        className="flex items-center gap-1 opacity-50"
                      >
                        <Github className="size-4" />
                        GitHub
                      </button>
                      <button
                        type="button"
                        disabled
                        title={t.profile.unavailableLinks}
                        className="flex items-center gap-1 opacity-50"
                      >
                        <ExternalLink className="size-4" />
                        Demo
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.profile.unavailableLinks}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
        <aside>
          <div className="sticky top-24 rounded-lg border bg-card p-6">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              {t.profile.availability}
            </p>
            <p className="mt-2 flex items-center gap-2 font-bold text-positive">
              <Check className="size-4" />
              {tv(d.availability)}
            </p>
            <div className="my-5 border-t" />
            <p className="text-xs text-muted-foreground">{t.profile.rate}</p>
            <p className="mt-1 font-display text-2xl font-bold">
              {formatCurrency(d.rate)}
              <span className="text-sm font-normal text-muted-foreground">/h</span>
            </p>
            <div className="my-5 border-t" />
            <p className="text-xs font-bold uppercase text-muted-foreground">{t.profile.links}</p>
            <div className="mt-3 space-y-2">
              <Button disabled variant="outline" className="w-full justify-start">
                <Github />
                GitHub
              </Button>
              <Button disabled variant="outline" className="w-full justify-start">
                <Linkedin />
                LinkedIn
              </Button>
              <p className="text-xs text-muted-foreground">{t.profile.unavailableLinks}</p>
              <Button asChild variant="outline" className="w-full justify-start">
                <a href="#portfolio">
                  <ExternalLink />
                  {t.profile.portfolioLink}
                </a>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
