import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookmarkCheck,
  Check,
  Filter,
  Layers3,
  Search,
  Sparkles,
  Timer,
  UserRoundSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeveloperCard } from "@/components/developer-card";
import { developers } from "@/lib/developers";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      {
        name: "description",
        content: "Descubra profissionais de tecnologia por stack, experiência e disponibilidade.",
      },
      { property: "og:title", content: "Stack Match — Encontre o desenvolvedor certo" },
      {
        property: "og:description",
        content: "Talentos tech compatíveis com seu projeto, em poucos minutos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  const { t, tv } = useI18n();
  useLocalizedMeta(t.home.h1a + t.home.h1b + " — Stack Match", t.home.sub);

  const benefits = [
    [Timer, t.home.benefits[0]],
    [Filter, t.home.benefits[1]],
    [Layers3, t.home.benefits[2]],
    [Sparkles, t.home.benefits[3]],
  ] as const;
  const featuredDeveloper = developers.find((developer) => developer.id === "marina-costa");
  return (
    <main>
      <section className="hero-band">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.8fr] lg:px-8 lg:py-20">
          <div className="animate-fade-in">
            <span className="eyebrow">
              <span className="status-dot" /> {t.home.eyebrow}
            </span>
            <h1 className="mt-6 max-w-3xl font-display text-5xl font-extrabold leading-[1.05] sm:text-6xl">
              {t.home.h1a} <span className="text-primary">{t.home.h1b}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{t.home.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/discover">
                  {t.home.find} <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/create-profile">{t.home.createMine}</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm text-muted-foreground">
              {t.home.perks.map((x) => (
                <span className="flex items-center gap-1.5" key={x}>
                  <Check className="size-4 text-positive" />
                  {x}
                </span>
              ))}
            </div>
          </div>
          {featuredDeveloper && (
            <div className="relative mx-auto w-full max-w-md animate-scale-in">
              <div className="absolute -left-7 top-16 z-10 hidden rounded-lg border bg-card p-3 shadow-soft sm:block">
                <p className="text-xs text-muted-foreground">{t.profile.experience}</p>
                <p className="font-display text-2xl font-bold text-primary">
                  {tv(featuredDeveloper.experience)}
                </p>
              </div>
              <DeveloperCard developer={featuredDeveloper} />
              <div className="absolute -bottom-5 -right-5 z-10 rounded-lg border bg-card p-3 shadow-soft">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="status-dot" />
                  {tv(featuredDeveloper.availability)}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="border-y bg-card">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <span className="section-kicker">{t.home.howKicker}</span>
            <h2 className="section-title">{t.home.howTitle}</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {t.home.steps.map(({ title, description }, index) => {
              const Icon = [UserRoundSearch, Search, BookmarkCheck][index] ?? Search;
              const n = String(index + 1).padStart(2, "0");
              return (
                <div className="step-item" key={title}>
                  <div className="flex items-center justify-between">
                    <span className="feature-icon">
                      <Icon />
                    </span>
                    <span className="font-mono text-sm text-muted-foreground">{n}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <span className="section-kicker">{t.home.benefitsKicker}</span>
            <h2 className="section-title">
              {t.home.benefitsTitleA}
              <br />
              {t.home.benefitsTitleB}
            </h2>
            <p className="mt-5 text-muted-foreground">{t.home.benefitsSub}</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {benefits.map(([Icon, title]) => (
              <div className="bg-background p-7" key={title}>
                <Icon className="size-5 text-primary" />
                <h3 className="mt-5 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.home.benefitText}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="cta-band">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="font-display text-4xl font-extrabold">{t.home.ctaTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl opacity-75">{t.home.ctaSub}</p>
          <Button
            variant="secondary"
            size="lg"
            className="mt-8 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
            asChild
          >
            <Link to="/discover">
              {t.home.ctaBtn} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
