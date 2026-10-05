import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
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
import type { CSSProperties } from "react";
import { MeetingProposal } from "@/components/meeting-proposal";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { myProfileQuery } from "@/lib/profile-api";
import { useInterestedCompanies } from "@/lib/use-interested-companies";

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

function InterestsList({ user }: { user: AuthUser }) {
  const { t, lang } = useI18n();
  const locale = lang === "pt" ? ptBR : enUS;
  // Assume a profile until the server says otherwise, so the notice never flashes.
  const { data: profile } = useQuery(myProfileQuery(user.id));
  const hasProfile = profile !== null;
  const { companies, loading, isError, refetch } = useInterestedCompanies(user);

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{t.interests.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{t.interests.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.interests.sub}</p>

      {!hasProfile && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 p-4 text-sm">
          <p>{t.interests.noProfile}</p>
          <Button asChild size="sm">
            <Link to="/create-profile">{t.interests.createProfile}</Link>
          </Button>
        </div>
      )}

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
        <div className="mt-12 grid min-h-60 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
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
        <>
          <p className="mt-8 text-sm font-medium text-muted-foreground">
            {t.interests.count(companies.length)}
          </p>
          <ul className="mt-3 space-y-4">
            {companies.map((item, index) => {
              const meeting = item.meeting;
              const subject = encodeURIComponent(t.interests.replySubject(item.company));
              return (
                <li
                  key={item.companyId}
                  className="stagger-item rounded-xl border bg-card p-5 shadow-sm"
                  style={{ "--stagger-index": index } as CSSProperties}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-5" aria-hidden="true" />
                      </span>
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
                      <span className="level-badge flex items-center gap-1">
                        {meeting ? (
                          <CalendarDays className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Heart className="size-3.5" aria-hidden="true" />
                        )}
                        {meeting ? t.interests.meeting : t.interests.interest}
                      </span>
                      <time dateTime={item.at} className="text-xs text-muted-foreground">
                        {format(new Date(item.at), t.interests.dateTimeFormat, { locale })}
                      </time>
                    </div>
                  </div>
                  {meeting && <MeetingProposal meeting={meeting} className="mt-4" />}
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
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="mt-12 grid min-h-60 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
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
    </main>
  );
}
