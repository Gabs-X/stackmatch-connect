import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR, enUS } from "react-day-picker/locale";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Globe,
  Heart,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { DemoLink } from "@/components/demo-link";
import { MeetingProposal } from "@/components/meeting-proposal";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { companyProfileQuery } from "@/lib/company-api";
import type { AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { profileLink } from "@/lib/local-profile";
import { useInterestedCompanies } from "@/lib/use-interested-companies";

export const Route = createFileRoute("/company/$id")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Empresa interessada no seu perfil." },
      { property: "og:title", content: "Empresa interessada — Stack Match" },
    ],
  }),
  component: () => (
    <RequireAccount type="developer">
      <CompanyPage />
    </RequireAccount>
  ),
});

function CompanyPage() {
  const { user } = useAuth();
  // RequireAccount only renders this page for a signed-in developer.
  return user ? <CompanyDetails user={user} /> : null;
}

/** A company the developer can see: only those that reached them, through Interested companies. */
function CompanyDetails({ user }: { user: AuthUser }) {
  const { t, tv, lang } = useI18n();
  const locale = lang === "pt" ? ptBR : enUS;
  const { id } = Route.useParams();
  const { companies, loading, isError, refetch } = useInterestedCompanies(user);
  const company = companies.find((item) => item.companyId === id);
  const profile = useQuery({ ...companyProfileQuery(id), enabled: company !== undefined });
  useLocalizedMeta(
    `${company?.company ?? t.company.kicker} — Stack Match`,
    profile.data?.about ? tv(profile.data.about) : t.interests.sub,
  );

  const back = (
    <Link
      to="/interests"
      className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {t.company.back}
    </Link>
  );

  if (loading || (company && profile.isPending))
    return (
      <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {back}
        <div className="mt-8 space-y-4" aria-busy="true">
          <span role="status" className="sr-only">
            {t.common.loading}
          </span>
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </main>
    );

  if (!company)
    return (
      <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {back}
        <div className="mt-8 grid min-h-60 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
          {isError ? (
            <div role="alert">
              <h1 className="text-xl font-bold">{t.discover.loadError}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t.discover.loadErrorSub}</p>
              <Button className="mt-5" onClick={() => void refetch()}>
                <RotateCcw />
                {t.common.retry}
              </Button>
            </div>
          ) : (
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
                <Building2 aria-hidden="true" />
              </span>
              <h1 className="mt-5 text-xl font-bold">{t.company.notFoundTitle}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t.company.notFoundSub}</p>
            </div>
          )}
        </div>
      </main>
    );

  // Without a public profile (the company never filled it in), show what the contact signed.
  const details = profile.data;
  const website = profileLink(details?.website ?? "");
  const meeting = company.meeting;
  const subject = encodeURIComponent(t.interests.replySubject(company.company));
  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {back}
      <section className="stagger-item mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-8" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="section-kicker">{t.company.kicker}</span>
            <h1 className="mt-1 break-words font-display text-3xl font-extrabold">
              {company.company}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {details?.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {details.location}
                </span>
              )}
              {website && (
                <DemoLink
                  url={website}
                  label={t.company.website}
                  icon={Globe}
                  real={!details?.demo}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="stagger-item stagger-1 mt-8 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold">{t.company.about}</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-muted-foreground">
              {details?.about ? tv(details.about) : t.company.noAbout}
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold">{t.company.activity}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="level-badge flex items-center gap-1">
                {meeting ? (
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                ) : (
                  <Heart className="size-3.5" aria-hidden="true" />
                )}
                {meeting ? t.interests.meeting : t.interests.interest}
              </span>
              <time dateTime={company.at} className="text-muted-foreground">
                {format(new Date(company.at), t.interests.dateTimeFormat, { locale })}
              </time>
            </div>
            {meeting && <MeetingProposal meeting={meeting} className="mt-4" />}
          </section>
        </div>
        <aside>
          <div className="rounded-xl border bg-card p-5 md:sticky md:top-24">
            <p className="text-xs font-bold uppercase text-muted-foreground">{t.company.contact}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex min-w-0 items-start gap-2">
                <UserRound
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{company.contactName}</span>
                  {details?.contactRole && (
                    <span className="block text-muted-foreground">{tv(details.contactRole)}</span>
                  )}
                </span>
              </li>
              <li className="flex min-w-0 items-center gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate" title={company.email}>
                  {company.email}
                </span>
              </li>
              {details?.phone && (
                <li className="flex min-w-0 items-center gap-2">
                  <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">{t.company.phone}:</span>
                  <span className="truncate">{details.phone}</span>
                </li>
              )}
            </ul>
            <Button asChild className="mt-5 w-full">
              <a href={`mailto:${company.email}?subject=${subject}`}>
                <Mail />
                {t.interests.reply}
              </a>
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}
