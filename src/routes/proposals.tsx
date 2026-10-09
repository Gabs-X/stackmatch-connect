import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useState, type CSSProperties } from "react";
import { enUS, ptBR } from "react-day-picker/locale";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  ChevronRight,
  Clock,
  RotateCcw,
  X,
} from "lucide-react";
import { JobContext } from "@/components/job-details";
import { MeetingControls } from "@/components/meeting-controls";
import { MeetingProposal } from "@/components/meeting-proposal";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { isMeetingExpired, type MeetingRequest } from "@/lib/meeting-requests";
import { sentMeetingRequestsQuery } from "@/lib/meetings-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proposals")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "As propostas de conversa que sua empresa enviou." },
      { property: "og:title", content: "Propostas enviadas — Stack Match" },
    ],
  }),
  component: () => (
    <RequireAccount type="company">
      <ProposalsPage />
    </RequireAccount>
  ),
});

function ProposalsPage() {
  const { t } = useI18n();
  useLocalizedMeta(`${t.proposals.title} — Stack Match`, t.proposals.sub);
  const { user } = useAuth();
  // RequireAccount only renders this page for a signed-in company.
  return user ? <ProposalList user={user} /> : null;
}

/** A proposal's status as the company sees it: waiting ones expire once their time comes. */
type Status = "pending" | "accepted" | "declined" | "canceled" | "expired";
type Filter = "all" | Status;

const statusOf = (meeting: MeetingRequest): Status =>
  isMeetingExpired(meeting) ? "expired" : meeting.status;

const statusIcons = {
  pending: Clock,
  accepted: CalendarCheck,
  declined: CalendarX,
  canceled: X,
  expired: CalendarClock,
};

function ProposalList({ user }: { user: AuthUser }) {
  const { t } = useI18n();
  const { data, isPending, isError, refetch } = useQuery(sentMeetingRequestsQuery(user.id));
  const [filter, setFilter] = useState<Filter>("all");
  const proposals = (data ?? [])
    .map((meeting) => ({ meeting, status: statusOf(meeting) }))
    .sort((a, b) => b.meeting.sentAt.localeCompare(a.meeting.sentAt));
  const count = (status: Status) => proposals.filter((item) => item.status === status).length;
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: t.proposals.filters.all, count: proposals.length },
    ...(["pending", "accepted", "declined", "canceled", "expired"] as const).map((id) => ({
      id,
      label: t.proposals.filters[id],
      count: count(id),
    })),
  ];
  // Back to every proposal when the chosen group empties (a waiting one expired, say).
  const active = filters.find((item) => item.id === filter)?.count ? filter : "all";
  const shown = proposals.filter((item) => active === "all" || item.status === active);

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-20">
      <section className="stagger-item border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="section-kicker">{t.proposals.kicker}</span>
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            {t.proposals.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{t.proposals.sub}</p>
          {proposals.length > 0 && (
            <div
              role="group"
              aria-label={t.proposals.filterLabel}
              className="mt-6 flex flex-wrap gap-2"
            >
              {filters.map(({ id, label, count: total }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active === id}
                  disabled={total === 0}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "filter-chip disabled:pointer-events-none disabled:opacity-50",
                    active === id && "filter-chip-active",
                  )}
                >
                  {label} · {total}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {isPending ? (
          <div className="mt-8 space-y-4" aria-busy="true">
            <span role="status" className="sr-only">
              {t.common.loading}
            </span>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="mt-10 rounded-xl border border-dashed bg-card p-8 text-center"
          >
            <p className="font-semibold">{t.proposals.loadError}</p>
            <Button className="mt-4" onClick={() => void refetch()}>
              <RotateCcw />
              {t.common.retry}
            </Button>
          </div>
        ) : proposals.length ? (
          <ul className="mt-8 space-y-4">
            {shown.map(({ meeting, status }, index) => (
              <ProposalItem key={meeting.id} meeting={meeting} status={status} index={index} />
            ))}
          </ul>
        ) : (
          <div className="mt-10 grid min-h-60 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
                <CalendarDays aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-bold">{t.proposals.emptyTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.proposals.emptySub}</p>
              <Button asChild className="mt-5">
                <Link to="/discover">{t.proposals.goDiscover}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ProposalItem({
  meeting,
  status,
  index,
}: {
  meeting: MeetingRequest;
  status: Status;
  index: number;
}) {
  const { t, lang } = useI18n();
  const locale = lang === "pt" ? ptBR : enUS;
  const Icon = statusIcons[status];
  const sentAt = new Date(meeting.sentAt);
  return (
    <li
      className="stagger-item rounded-xl border bg-card p-5 shadow-sm"
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <article aria-label={meeting.developerName}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold">
              <Link
                to="/developer/$id"
                params={{ id: meeting.developerId }}
                className="rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {meeting.developerName}
              </Link>
            </h2>
            <p className="text-xs text-muted-foreground">
              <time
                dateTime={meeting.sentAt}
                title={format(sentAt, t.interests.dateTimeFormat, { locale })}
              >
                {t.proposals.sent(formatDistanceToNowStrict(sentAt, { addSuffix: true, locale }))}
              </time>
              {meeting.respondedAt &&
                ` · ${t.proposals.answered(format(new Date(meeting.respondedAt), t.interests.dateTimeFormat, { locale }))}`}
            </p>
          </div>
          <span
            className={cn(
              "level-badge flex shrink-0 items-center gap-1",
              status === "accepted" && "bg-positive-soft text-positive",
              status === "pending" && "bg-primary text-primary-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {status === "pending" && meeting.proposedBy === "developer"
              ? t.proposals.status.yourTurn
              : t.proposals.status[status]}
          </span>
        </div>
        {meeting.job && (
          <JobContext job={meeting.job} translations={meeting.jobTranslations} className="mt-4" />
        )}
        <MeetingProposal meeting={meeting} className="mt-4" />
        <MeetingControls meeting={meeting} side="company" />
        <div className="mt-4">
          <Button asChild size="sm" variant="outline">
            <Link to="/developer/$id" params={{ id: meeting.developerId }}>
              {t.proposals.viewProfile}
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </article>
    </li>
  );
}
