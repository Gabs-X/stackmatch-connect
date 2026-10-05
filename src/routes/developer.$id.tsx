import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, Bookmark, Check, ExternalLink, Github, Linkedin, MapPin } from "lucide-react";
import { toast } from "sonner";
import { DemoLink } from "@/components/demo-link";
import { DeveloperPhoto } from "@/components/developer-photo";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { Button } from "@/components/ui/button";
import { developers, type Developer } from "@/lib/developers";
import { loadPublishedProfiles } from "@/lib/local-profile";
import { useApp } from "@/lib/app-context";

export const Route = createFileRoute("/developer/$id")({
  // Other ids may be profiles created by developer accounts, which live in the browser for now,
  // so their pages look them up on the client.
  loader: ({ params }) => developers.find((d) => d.id === params.id) ?? null,
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
  return d ? <CatalogDeveloperPage d={d} /> : <LocalDeveloperPage />;
}

function CatalogDeveloperPage({ d }: { d: Developer }) {
  const { t, tv, formatCurrency } = useI18n();
  useLocalizedMeta(d.name + " — Stack Match", tv(d.bio));
  const { saved, toggleSaved } = useApp();
  const isSaved = saved.includes(d.id);
  // Profiles created in the app may leave out what the form doesn't collect (rate, experience).
  const place = [d.location, tv(d.workMode)].filter(Boolean).join(" · ");
  const real = d.links.verified === true;
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
                          <DemoLink url={p.links.github} label="GitHub" icon={Github} real={real} />
                        )}
                        {p.links.demo && (
                          <DemoLink
                            url={p.links.demo}
                            label="Demo"
                            icon={ExternalLink}
                            real={real}
                          />
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
                <DemoLink
                  url={d.links.github}
                  label="GitHub"
                  icon={Github}
                  variant="block"
                  real={real}
                />
              )}
              {d.links.linkedin && (
                <DemoLink
                  url={d.links.linkedin}
                  label="LinkedIn"
                  icon={Linkedin}
                  variant="block"
                  real={real}
                />
              )}
              {d.links.website ? (
                <DemoLink
                  url={d.links.website}
                  label={t.profile.portfolioLink}
                  icon={ExternalLink}
                  variant="block"
                  real={real}
                />
              ) : (
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href="#portfolio">
                    <ExternalLink />
                    {t.profile.portfolioLink}
                  </a>
                </Button>
              )}
              {!real && <p className="pt-1 text-xs text-muted-foreground">{t.profile.demoNote}</p>}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/** A profile a developer account created in the app, shown like any other profile. */
function LocalDeveloperPage() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  // Undefined while reading storage, null when no account has this profile.
  const [developer, setDeveloper] = useState<Developer | null>();
  useEffect(
    () => setDeveloper(loadPublishedProfiles().find((profile) => profile.id === id) ?? null),
    [id],
  );
  if (developer === undefined)
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <p role="status" className="text-sm text-muted-foreground">
          {t.common.loading}
        </p>
      </main>
    );
  if (developer === null)
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
  return <CatalogDeveloperPage d={developer} />;
}
