import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR, enUS } from "react-day-picker/locale";
import { Building2, CalendarDays, Heart, Mail, RotateCcw, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { companyActivityQuery } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { loadAccountProfile, profilesStorageKey } from "@/lib/local-profile";
import { interestedCompanies } from "@/lib/profile-interests";

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
  const { hydrated, profileInterests, meetingRequests } = useApp();
  // Companies reach this developer's profile, and send their interest, under the account id.
  const [hasProfile, setHasProfile] = useState(true);
  useEffect(() => {
    const read = () => setHasProfile(loadAccountProfile(user.id) !== null);
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === profilesStorageKey) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user.id]);
  const { data, isPending, isError, refetch } = useQuery(companyActivityQuery(user.id, user.name));
  const companies = useMemo(
    () =>
      interestedCompanies(
        user.id,
        [...(data?.interests ?? []), ...profileInterests],
        [...(data?.meetings ?? []), ...meetingRequests],
      ),
    [user.id, data, profileInterests, meetingRequests],
  );
  const loading = !hydrated || (isPending && !isError);

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
                        <h2 className="truncate font-display text-lg font-bold">{item.company}</h2>
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
                  {meeting && (
                    <div className="mt-4 rounded-lg bg-muted/60 p-4 text-sm">
                      <p className="font-medium">
                        {t.interests.proposedFor(
                          `${format(new Date(`${meeting.date}T12:00:00`), t.interests.dateFormat, { locale })}, ${t.interests.at} ${meeting.time}`,
                        )}
                      </p>
                      {meeting.message && (
                        <p className="mt-2 whitespace-pre-line text-muted-foreground">
                          {meeting.message}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-4">
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
