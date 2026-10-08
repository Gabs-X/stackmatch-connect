import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useId, useState } from "react";
import { enUS, ptBR } from "react-day-picker/locale";
import { BriefcaseBusiness, CheckCircle2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { JobDetails } from "@/components/job-details";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { maxApplicationMessage, type OpenJob } from "@/lib/jobs";
import { applyToJobFn, openJobsQuery } from "@/lib/jobs-api";
import type { Translations } from "@/lib/translations";

/**
 * The open jobs of a company that reached the developer, on the company's page, each with a way to
 * offer themselves for it once.
 */
export function OpenJobs({ accountId, companyId }: { accountId: string; companyId: string }) {
  const { t } = useI18n();
  const query = openJobsQuery(accountId, companyId);
  const { data, isPending, isError, refetch } = useQuery(query);
  const queryClient = useQueryClient();
  const [applying, setApplying] = useState<OpenJob | null>(null);

  return (
    <section aria-labelledby="open-jobs-title">
      <h2 id="open-jobs-title" className="text-xl font-bold">
        {t.openJobs.title}
      </h2>
      {isPending ? (
        <Skeleton className="mt-3 h-24 w-full rounded-lg" />
      ) : isError ? (
        <div role="alert" className="mt-3 text-sm">
          <p className="text-destructive">{t.openJobs.loadError}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
            <RotateCcw />
            {t.common.retry}
          </Button>
        </div>
      ) : !data?.jobs.length ? (
        <p className="mt-3 text-muted-foreground">{t.openJobs.empty}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{t.openJobs.sub}</p>
          <ul className="mt-4 space-y-3">
            {data.jobs.map((job) => (
              <OpenJobItem
                key={job.id}
                job={job}
                translations={data.translations}
                onApply={() => setApplying(job)}
              />
            ))}
          </ul>
        </>
      )}
      <ApplyDialog
        job={applying}
        translations={data?.translations}
        onClose={() => setApplying(null)}
        onApplied={(jobId, appliedAt) => {
          queryClient.setQueryData(query.queryKey, (current) =>
            current
              ? {
                  ...current,
                  jobs: current.jobs.map((job) => (job.id === jobId ? { ...job, appliedAt } : job)),
                }
              : current,
          );
        }}
      />
    </section>
  );
}

function OpenJobItem({
  job,
  translations,
  onApply,
}: {
  job: OpenJob;
  translations: Translations;
  onApply: () => void;
}) {
  const { t, tv, lang } = useI18n();
  return (
    <li className="rounded-lg border bg-card p-4">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <BriefcaseBusiness className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="break-words">{tv(job.title, translations)}</span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-primary group-open:hidden">
            {t.jobs.showDetails}
          </span>
          <span className="hidden shrink-0 text-xs font-semibold text-primary group-open:inline">
            {t.jobs.hideDetails}
          </span>
        </summary>
        <JobDetails job={job} translations={translations} className="mt-4" />
      </details>
      <div className="mt-3">
        {job.appliedAt ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-positive">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {t.openJobs.applied(
              format(new Date(job.appliedAt), t.interests.dateFormat, {
                locale: lang === "pt" ? ptBR : enUS,
              }),
            )}
          </p>
        ) : (
          <Button
            size="sm"
            aria-label={`${t.openJobs.apply}: ${tv(job.title, translations)}`}
            onClick={onApply}
          >
            <Send />
            {t.openJobs.apply}
          </Button>
        )}
      </div>
    </li>
  );
}

/** Asks for an optional message and offers the developer for the job; shared with the job board. */
export function ApplyDialog({
  job,
  translations,
  onClose,
  onApplied,
}: {
  job: OpenJob | null;
  translations: Translations | undefined;
  onClose: () => void;
  onApplied: (jobId: string, appliedAt: string) => void;
}) {
  const { t, tv } = useI18n();
  const id = useId();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setMessage("");
    setError("");
    onClose();
  };
  const send = async () => {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const result = await applyToJobFn({ data: { jobId: job.id, message } });
      if ("error" in result) {
        setError(t.openJobs.errors[result.error]);
        // Already sent from another tab: show it as sent.
        if (result.error === "already-applied") onApplied(job.id, new Date().toISOString());
        return;
      }
      onApplied(job.id, result.appliedAt);
      toast.success(t.openJobs.sent);
      close();
    } catch {
      setError(t.openJobs.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={job !== null} onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent>
        <DialogTitle>{job ? t.openJobs.dialogTitle(tv(job.title, translations)) : ""}</DialogTitle>
        <DialogDescription>{t.openJobs.dialogSub}</DialogDescription>
        <div>
          <Label htmlFor={`${id}-message`}>{t.openJobs.message}</Label>
          <Textarea
            id={`${id}-message`}
            className="mt-2 min-h-28"
            value={message}
            maxLength={maxApplicationMessage}
            placeholder={t.openJobs.messagePh}
            onChange={(event) => setMessage(event.target.value)}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {message.length}/{maxApplicationMessage}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              {t.openJobs.cancel}
            </Button>
          </DialogClose>
          <Button onClick={() => void send()} disabled={busy}>
            <Send />
            {t.openJobs.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
