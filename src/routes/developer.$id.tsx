import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { ArrowLeft, Bookmark, Check, ExternalLink, Github, Linkedin, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ProfileLink } from "@/components/profile-link";
import { DeveloperPhoto } from "@/components/developer-photo";
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
  const { t, tv, formatCurrency } = useI18n();
  useLocalizedMeta(d.name + " — Stack Match", tv(d.bio));
  const { saved, toggleSaved } = useApp();
  const isSaved = saved.includes(d.id);
  // Rate and experience are optional in the profile form.
  const place = [d.location, tv(d.workMode)].filter(Boolean).join(" · ");
  return (
    <main className="pb-20">
      <section className="stagger-item border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t.profile.back}
          </Link>
          <div className="mt-8 flex flex-col gap-7 sm:flex-row sm:items-center">
            <DeveloperPhoto
              name={d.name}
              image={d.image}
              alt={d.name}
              fallbackSize="lg"
              className="size-36 shrink-0 overflow-hidden rounded-xl bg-muted shadow-soft"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl font-extrabold">{d.name}</h1>
                {d.seniority && <span className="level-badge">{tv(d.seniority)}</span>}
              </div>
              <p className="mt-2 text-lg font-semibold text-primary">{d.role}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {place && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {place}
                  </span>
                )}
                {d.availability && (
                  <span className="flex items-center gap-1.5 text-positive">
                    <span className="status-dot" />
                    {tv(d.availability)}
                  </span>
                )}
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
      <div className="stagger-item stagger-1 mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
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
          {d.experience && (
            <section>
              <h2 className="text-xl font-bold">{t.profile.experience}</h2>
              <div className="mt-5 border-l-2 border-primary pl-5">
                <p className="font-bold">{[d.role, tv(d.seniority)].filter(Boolean).join(" · ")}</p>
                <p className="text-sm text-primary">{tv(d.experience)}</p>
              </div>
            </section>
          )}
          <section id="portfolio" className="scroll-mt-24">
            <div>
              <span className="section-kicker">{t.profile.portfolioLink}</span>
              <h2 className="section-title">{t.profile.featured}</h2>
            </div>
            {d.projects.length === 0 && (
              <p className="mt-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {t.profile.noProjects}
              </p>
            )}
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {d.projects.map((p, index) => (
                <article
                  className="stagger-item overflow-hidden rounded-lg border bg-card"
                  style={{ "--stagger-index": index } as CSSProperties}
                  key={p.name}
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="aspect-[16/10] w-full object-cover"
                    />
                  ) : (
                    <div className={`grid aspect-[16/10] place-items-center ${p.color}`}>
                      <span className="font-display text-4xl font-extrabold text-white">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
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
                    {(p.links.github || p.links.demo) && (
                      <div className="mt-5 flex gap-4 text-xs font-bold">
                        {p.links.github && (
                          <ProfileLink url={p.links.github} label="GitHub" icon={Github} />
                        )}
                        {p.links.demo && (
                          <ProfileLink url={p.links.demo} label="Demo" icon={ExternalLink} />
                        )}
                      </div>
                    )}
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
              {d.availability ? tv(d.availability) : "—"}
            </p>
            {Number.isFinite(d.rate) && (
              <>
                <div className="my-5 border-t" />
                <p className="text-xs text-muted-foreground">{t.profile.rate}</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {formatCurrency(d.rate)}
                  <span className="text-sm font-normal text-muted-foreground">/h</span>
                </p>
              </>
            )}
            <div className="my-5 border-t" />
            <p className="text-xs font-bold uppercase text-muted-foreground">{t.profile.links}</p>
            <div className="mt-3 space-y-2">
              {d.links.github && (
                <ProfileLink url={d.links.github} label="GitHub" icon={Github} variant="block" />
              )}
              {d.links.linkedin && (
                <ProfileLink
                  url={d.links.linkedin}
                  label="LinkedIn"
                  icon={Linkedin}
                  variant="block"
                />
              )}
              {d.links.website ? (
                <ProfileLink
                  url={d.links.website}
                  label={t.profile.portfolioLink}
                  icon={ExternalLink}
                  variant="block"
                />
              ) : (
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href="#portfolio">
                    <ExternalLink />
                    {t.profile.portfolioLink}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
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
