import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR, enUS } from "react-day-picker/locale";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Heart,
  Mail,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import { JobContext } from "@/components/job-details";
import { MeetingControls } from "@/components/meeting-controls";
import { MeetingProposal } from "@/components/meeting-proposal";
import { ProjectCover } from "@/components/project-cover";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { myProfileQuery } from "@/lib/profile-api";
import { useInterestedCompanies } from "@/lib/use-interested-companies";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interests")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Empresas que se interessaram pelo seu perfil." },
      { property: "og:title", content: "Empresas interessadas — Stack Match" },
    ],
  }),
  component: () => (
    <RequireAccount type="developer">
      <InterestsPage />
    </RequireAccount>
  ),
});

function InterestsPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.interests.title + " — Stack Match", t.interests.sub);
  const { user } = useAuth();
  // RequireAccount only renders this page for a signed-in developer.
  return user ? <InterestsList user={user} /> : null;
}

type Filter = "all" | "meetings" | "interests";

function InterestsList({ user }: { user: AuthUser }) {
  const { t, lang } = useI18n();
  const locale = lang === "pt" ? ptBR : enUS;
  // Assume a profile until the server says otherwise, so the notice never flashes.
  const { data: profile } = useQuery(myProfileQuery(user.id));
  const hasProfile = profile !== null;
  const { companies, loading, isError, refetch } = useInterestedCompanies(user);
  const [filter, setFilter] = useState<Filter>("all");
  const meetings = companies.filter((item) => item.meeting).length;
  const filters = [
    { id: "all", label: t.interests.filterAll, count: companies.length, icon: Building2 },
    { id: "meetings", label: t.interests.filterMeetings, count: meetings, icon: CalendarDays },
    {
      id: "interests",
      label: t.interests.filterInterests,
      count: companies.length - meetings,
      icon: Heart,
    },
  ] as const;
  const shown = companies.filter((item) =>
    filter === "all" ? true : filter === "meetings" ? item.meeting : !item.meeting,
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-20">
      <section className="stagger-item border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="section-kicker">{t.interests.kicker}</span>
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            {t.interests.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{t.interests.sub}</p>

          {!hasProfile && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 p-4 text-sm">
              <p>{t.interests.noProfile}</p>
              <Button asChild size="sm">
                <Link to="/create-profile">{t.interests.createProfile}</Link>
              </Button>
            </div>
          )}

          {!loading && companies.length > 0 && (
            // Each summary also filters the list below.
            <div
              role="group"
              aria-label={t.interests.filterLabel}
              className="mt-7 grid grid-cols-3 gap-2 sm:gap-3"
            >
              {filters.map(({ id, label, count, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  // Nothing to list in an empty group.
                  disabled={count === 0}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-50 sm:p-4",
                    filter === id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "bg-background hover:border-primary/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[0.7rem] font-semibold leading-tight sm:text-xs",
                      filter === id ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {label}
                  </span>
                  <span className="font-display text-2xl font-extrabold sm:text-3xl">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="mt-8 space-y-4" aria-busy="true">
            <span role="status" className="sr-only">
              {t.common.loading}
            </span>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : isError && companies.length === 0 ? (
          <div className="mt-10 grid min-h-60 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
            <div role="alert">
              <h2 className="text-xl font-bold">{t.discover.loadError}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.discover.loadErrorSub}</p>
              <Button className="mt-5" onClick={() => void refetch()}>
                <RotateCcw />
                {t.common.retry}
              </Button>
            </div>
          </div>
        ) : companies.length ? (
          <ul className="mt-8 space-y-4">
            {shown.map((item, index) => {
              const meeting = item.meeting;
              const subject = encodeURIComponent(t.interests.replySubject(item.company));
              const at = new Date(item.at);
              return (
                <li
                  key={item.companyId}
                  className={cn(
                    "stagger-item overflow-hidden rounded-xl border bg-card shadow-sm",
                    meeting && "border-primary/30",
                  )}
                  style={{ "--stagger-index": index } as CSSProperties}
                >
                  {/* Proposals carry a time and a message, so they stand out from a plain mark. */}
                  {meeting && <div className="h-1 bg-primary" aria-hidden="true" />}
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProjectCover
                          name={item.company}
                          label={initials(item.company)}
                          image=""
                          size="sm"
                          className="size-11 shrink-0 rounded-lg"
                        />
                        <div className="min-w-0">
                          <h2 className="truncate font-display text-lg font-bold">
                            <Link
                              to="/company/$id"
                              params={{ id: item.companyId }}
                              className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {item.company}
                            </Link>
                          </h2>
                          <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                            <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                            {t.interests.contact(item.contactName)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-end">
                        <span
                          className={cn(
                            "level-badge flex items-center gap-1",
                            meeting && "bg-primary text-primary-foreground",
                          )}
                        >
                          {meeting ? (
                            <CalendarDays className="size-3.5" aria-hidden="true" />
                          ) : (
                            <Heart className="size-3.5" aria-hidden="true" />
                          )}
                          {meeting ? t.interests.meeting : t.interests.interest}
                        </span>
                        <time
                          dateTime={item.at}
                          title={format(at, t.interests.dateTimeFormat, { locale })}
                          className="text-xs text-muted-foreground"
                        >
                          {formatDistanceToNowStrict(at, { addSuffix: true, locale })}
                        </time>
                      </div>
                    </div>
                    {item.job && (
                      <JobContext
                        job={item.job.snapshot}
                        translations={item.job.translations}
                        className="mt-4"
                      />
                    )}
                    {meeting && (
                      <div className="mt-4">
                        <MeetingProposal meeting={meeting} />
                        <MeetingControls meeting={meeting} side="developer" />
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link to="/company/$id" params={{ id: item.companyId }}>
                          {t.interests.viewCompany}
                          <ChevronRight />
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={`mailto:${item.email}?subject=${subject}`}>
                          <Mail />
                          {t.interests.reply}
                        </a>
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-10 grid min-h-60 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
                <Heart aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-bold">{t.interests.emptyTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.interests.emptySub}</p>
              {hasProfile && (
                <Button asChild className="mt-5">
                  <Link to="/create-profile">{t.interests.editProfile}</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/** Up to two letters of the company's name, for its avatar. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : name.trim().slice(0, 2);
  return letters.toUpperCase() || "··";
}
