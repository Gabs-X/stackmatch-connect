import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR, enUS } from "react-day-picker/locale";
import { Building2, ChevronRight, RotateCcw, Send, Undo2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { JobContext } from "@/components/job-details";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import {
  type ApplicationEvent,
  type ApplicationPage,
  type ApplicationView,
  type MyApplication,
} from "@/lib/jobs";
import { fetchMyApplications, myApplicationsQueryKey, withdrawApplicationFn } from "@/lib/jobs-api";
import type { Translations } from "@/lib/translations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/applications")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "As vagas para as quais você se ofereceu." },
      { property: "og:title", content: "Minhas candidaturas — Stack Match" },
    ],
  }),
  component: () => (
    <RequireAccount type="developer">
      <ApplicationsPage />
    </RequireAccount>
  ),
});

function ApplicationsPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.applications.title + " — Stack Match", t.applications.sub);
  const { user } = useAuth();
  // RequireAccount only renders this page for a signed-in developer.
  return user ? <ApplicationList accountId={user.id} /> : null;
}

const statusTone: Record<ApplicationView, string> = {
  submitted: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  hired: "bg-positive/10 text-positive",
  not_advanced: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
  withdrawn: "bg-muted text-muted-foreground",
  job_closed: "bg-muted text-muted-foreground",
};

function ApplicationList({ accountId }: { accountId: string }) {
  const { t } = useI18n();
  const applications = useInfiniteQuery({
    queryKey: [...myApplicationsQueryKey, accountId],
    queryFn: ({ pageParam }) =>
      fetchMyApplications({ data: pageParam ? { after: pageParam } : {} }),
    initialPageParam: "",
    getNextPageParam: (page) => page.next ?? undefined,
  });
  const pages = applications.data?.pages ?? [];
  const list = pages.flatMap((page) => page.applications);
  const translations = Object.assign({}, ...pages.map((page) => page.translations)) as Translations;
  const [withdrawing, setWithdrawing] = useState<MyApplication | null>(null);

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-20">
      <section className="stagger-item border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <span className="section-kicker">{t.applications.kicker}</span>
          <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            {t.applications.title}
          </h1>
          <p className="mt-2 text-muted-foreground">{t.applications.sub}</p>
        </div>
      </section>
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8">
        {applications.isPending ? (
          <div aria-busy="true" className="space-y-4">
            <span role="status" className="sr-only">
              {t.common.loading}
            </span>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : applications.isError && !list.length ? (
          <div role="alert" className="text-center">
            <p className="text-sm text-muted-foreground">{t.applications.loadError}</p>
            <Button className="mt-4" onClick={() => void applications.refetch()}>
              <RotateCcw />
              {t.common.retry}
            </Button>
          </div>
        ) : list.length ? (
          <>
            <ul className="space-y-4">
              {list.map((application, index) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  translations={translations}
                  index={index}
                  onWithdraw={() => setWithdrawing(application)}
                />
              ))}
            </ul>
            {applications.isFetchNextPageError && (
              <p role="alert" className="mt-6 text-center text-sm text-muted-foreground">
                {t.applications.loadError}
              </p>
            )}
            {applications.hasNextPage && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  disabled={applications.isFetchingNextPage}
                  onClick={() => void applications.fetchNextPage()}
                >
                  {applications.isFetchingNextPage ? t.common.loading : t.applications.loadMore}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
            <div>
              <h2 className="text-lg font-bold">{t.applications.empty}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.applications.emptySub}</p>
              <Button asChild className="mt-5">
                <Link to="/job-board">{t.applications.browse}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
      <WithdrawDialog
        application={withdrawing}
        translations={translations}
        accountId={accountId}
        onClose={() => setWithdrawing(null)}
      />
    </main>
  );
}

function ApplicationCard({
  application,
  translations,
  index,
  onWithdraw,
}: {
  application: MyApplication;
  translations: Translations;
  index: number;
  onWithdraw: () => void;
}) {
  const { t, tv, lang } = useI18n();
  const locale = lang === "pt" ? ptBR : enUS;
  const date = (iso: string) => format(new Date(iso), t.interests.dateFormat, { locale });
  const describe = (event: ApplicationEvent) =>
    event.kind === "outcome" && event.outcome
      ? t.applications.outcomes[event.outcome]
      : event.kind === "outcome"
        ? ""
        : t.applications.events[event.kind];
  const title = tv(application.job.title, translations);
  return (
    <li
      aria-label={title}
      className="stagger-item rounded-xl border bg-card p-5 shadow-sm"
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <Link
            to="/company/$id"
            params={{ id: application.companyId }}
            className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <Building2 className="size-4" aria-hidden="true" />
            {application.company}
            <span className="sr-only">: {t.applications.viewCompany}</span>
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <span
          className={cn("rounded-full px-3 py-1 text-xs font-bold", statusTone[application.status])}
        >
          {t.applications.statuses[application.status]}
        </span>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Send className="size-3.5" aria-hidden="true" />
        {t.applications.appliedOn(date(application.appliedAt))}
      </p>
      {application.message && (
        <blockquote className="mt-3 whitespace-pre-line break-words border-l-2 pl-3 text-sm text-muted-foreground">
          <span className="sr-only">{t.applications.yourMessage}: </span>
          {application.message}
        </blockquote>
      )}
      <JobContext job={application.job} translations={translations} className="mt-4" />
      {application.history.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase text-muted-foreground">
            {t.applications.history}
          </h3>
          <ol className="mt-2 space-y-1.5">
            {application.history.map((event, position) => (
              <li key={position} className="flex flex-wrap gap-x-2 text-sm">
                <span className="font-medium">{describe(event)}</span>
                <span className="text-muted-foreground">{date(event.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {/* Only while it waits on an open job (see withdrawApplication). */}
      {(application.status === "submitted" || application.status === "in_progress") && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onWithdraw}>
            <Undo2 />
            {t.applications.withdraw}
          </Button>
        </div>
      )}
    </li>
  );
}

function WithdrawDialog({
  application,
  translations,
  accountId,
  onClose,
}: {
  application: MyApplication | null;
  translations: Translations;
  accountId: string;
  onClose: () => void;
}) {
  const { t, tv } = useI18n();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const withdraw = async () => {
    if (!application) return;
    setBusy(true);
    try {
      const result = await withdrawApplicationFn({ data: { id: application.id } });
      if ("error" in result) toast.error(t.applications.withdrawErrors[result.error]);
      else {
        // Shown right away; the refresh brings the history.
        queryClient.setQueryData<InfiniteData<ApplicationPage>>(
          [...myApplicationsQueryKey, accountId],
          (current) =>
            current && {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                applications: page.applications.map((item) =>
                  item.id === application.id
                    ? { ...item, status: "withdrawn", withdrawnAt: new Date().toISOString() }
                    : item,
                ),
              })),
            },
        );
        toast.success(t.applications.withdrawnToast);
      }
      onClose();
    } catch {
      toast.error(t.applications.withdrawErrors.generic);
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: myApplicationsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["open-jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["job-board"] });
    }
  };
  return (
    <Dialog open={application !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogTitle>{t.applications.withdrawTitle}</DialogTitle>
        <DialogDescription>
          {application
            ? t.applications.withdrawSub(
                tv(application.job.title, translations),
                application.company,
              )
            : ""}
        </DialogDescription>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              {t.applications.cancel}
            </Button>
          </DialogClose>
          <Button variant="destructive" disabled={busy} onClick={() => void withdraw()}>
            {t.applications.withdrawConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
