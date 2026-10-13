import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin-gate";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dismissReportFn,
  fetchAdminReports,
  fetchSuspendedAccounts,
  liftSuspensionFn,
  suspendAccountFn,
} from "@/lib/admin-api";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import type { AdminReport, SuspendedAccount } from "@/lib/moderation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [{ title: "Denúncias — Stack Match" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAccount>
      <AdminGate>
        <ReportsAdmin />
      </AdminGate>
    </RequireAccount>
  ),
});

const filters = ["open", "all"] as const;

/** Reloads both lists after a decision: a suspension closes reports and adds an account. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-suspended"] }),
    ]);
}

function ReportsAdmin() {
  const { t } = useI18n();
  useLocalizedMeta(t.moderation.adminTitle + " — Stack Match", t.moderation.adminSub);
  const [filter, setFilter] = useState<(typeof filters)[number]>("open");
  const list = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: () => fetchAdminReports({ data: filter }),
  });
  const suspended = useQuery({
    queryKey: ["admin-suspended"],
    queryFn: () => fetchSuspendedAccounts(),
  });
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{t.admin.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{t.moderation.adminTitle}</h1>
      <p className="mt-2 text-muted-foreground">{t.moderation.adminSub}</p>

      <div role="group" aria-label={t.moderation.filtersLabel} className="mt-8 flex gap-2">
        {filters.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            className={cn("filter-chip", filter === option && "filter-chip-active")}
            onClick={() => setFilter(option)}
          >
            {t.moderation.filters[option]}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {list.isPending ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t.common.loading}
          </p>
        ) : list.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t.moderation.loadError}
          </p>
        ) : list.data.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t.moderation.empty}
          </p>
        ) : (
          <ul className="space-y-4">
            {list.data.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mt-12 text-xl font-bold">{t.moderation.suspendedTitle}</h2>
      <div className="mt-4">
        {suspended.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-label={t.common.loading} />
        ) : suspended.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t.moderation.loadError}
          </p>
        ) : suspended.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.moderation.suspendedEmpty}</p>
        ) : (
          <ul className="space-y-4">
            {suspended.data.map((account) => (
              <li key={account.id}>
                <SuspendedCard account={account} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function useDate() {
  const { lang } = useI18n();
  return (iso: string) =>
    format(new Date(iso), lang === "pt" ? "dd/MM/yyyy HH:mm" : "MM/dd/yyyy h:mm a", {
      locale: lang === "pt" ? ptBR : enUS,
    });
}

/** The reason an admin writes for a decision, then the buttons that take it. */
function Decision({
  label,
  children,
}: {
  label: string;
  children: (note: string, clear: () => void) => React.ReactNode;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  return (
    <div className="mt-4 space-y-2 border-t pt-4">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">{children(note.trim(), () => setNote(""))}</div>
    </div>
  );
}

function ReportCard({ report }: { report: AdminReport }) {
  const { t } = useI18n();
  const date = useDate();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const act = async (run: () => Promise<boolean | { ok: true } | { error: string }>) => {
    setBusy(true);
    try {
      const result = await run();
      if (result === false || (typeof result === "object" && "error" in result)) {
        const code = typeof result === "object" && "error" in result ? result.error : "";
        toast.error(
          code === "already-suspended"
            ? t.moderation.alreadySuspended
            : code === "admin-account"
              ? t.moderation.adminAccount
              : t.moderation.actionError,
        );
      } else toast.success(t.moderation.done);
      await refresh();
    } catch {
      toast.error(t.moderation.actionError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article
      aria-label={`${t.moderation.targets[report.targetType]}: ${report.targetLabel}`}
      className="rounded-xl border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t.moderation.targets[report.targetType]} · {t.moderation.reasons[report.reason]}
          </p>
          <h3 className="mt-1 break-words font-bold">{report.targetLabel}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.moderation.owner}:{" "}
            {report.account
              ? `${report.account.name} (${report.account.email})`
              : t.moderation.deleted}
            {report.account?.suspended && (
              <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                {t.moderation.suspendedBadge}
              </span>
            )}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
          {t.moderation.statuses[report.status]}
        </span>
      </div>
      {report.details && (
        <p className="mt-3 whitespace-pre-line border-l-2 pl-3 text-sm">{report.details}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {report.reporter
          ? t.moderation.reportedBy(report.reporter.name, report.reporter.email)
          : ""}
        {report.reporter ? " · " : ""}
        {date(report.createdAt)}
      </p>
      {report.reviewedBy && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t.moderation.reviewed(report.reviewedBy, report.reviewNote)}
        </p>
      )}
      {report.status === "open" && (
        <Decision label={t.moderation.note}>
          {(note, clear) => (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !note}
                onClick={() =>
                  void act(() => dismissReportFn({ data: { id: report.id, note } })).then(clear)
                }
              >
                {t.moderation.dismiss}
              </Button>
              {report.account && !report.account.suspended && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy || !note}
                  onClick={() =>
                    void act(() =>
                      suspendAccountFn({
                        data: {
                          accountId: report.account?.id ?? "",
                          reason: note,
                          reportId: report.id,
                        },
                      }),
                    ).then(clear)
                  }
                >
                  {t.moderation.suspend}
                </Button>
              )}
            </>
          )}
        </Decision>
      )}
    </article>
  );
}

function SuspendedCard({ account }: { account: SuspendedAccount }) {
  const { t } = useI18n();
  const date = useDate();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  return (
    <article
      aria-label={account.name}
      className="rounded-xl border border-destructive/30 bg-card p-5 shadow-sm"
    >
      <h3 className="font-bold">{account.name}</h3>
      <p className="text-sm text-muted-foreground">
        {account.email} · {t.moderation[account.accountType]}
      </p>
      <h4 className="mt-3 text-sm font-semibold">{t.moderation.history}</h4>
      <ol className="mt-1 space-y-1 text-sm">
        {account.history.map((event) => (
          <li key={`${event.at}-${event.action}`}>
            {date(event.at)} · {t.moderation.historyActions[event.action]} · {event.by}:{" "}
            {event.reason}
          </li>
        ))}
      </ol>
      <Decision label={t.moderation.note}>
        {(note, clear) => (
          <Button
            size="sm"
            disabled={busy || !note}
            onClick={() => {
              setBusy(true);
              void liftSuspensionFn({ data: { accountId: account.id, reason: note } })
                .then((lifted) => {
                  if (lifted) toast.success(t.moderation.done);
                  else toast.error(t.moderation.actionError);
                  clear();
                  return refresh();
                })
                .catch(() => toast.error(t.moderation.actionError))
                .finally(() => setBusy(false));
            }}
          >
            {t.moderation.lift}
          </Button>
        )}
      </Decision>
    </article>
  );
}
