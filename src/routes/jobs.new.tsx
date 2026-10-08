import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { JobForm } from "@/components/job-form";
import { RequireAccount } from "@/components/require-account";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { emptyJob, maxJobsPerCompany } from "@/lib/jobs";
import { createJobFn, jobsQueryKey } from "@/lib/jobs-api";

export const Route = createFileRoute("/jobs/new")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Crie uma vaga ou escopo de contratação." },
    ],
  }),
  component: () => (
    <RequireAccount type="company">
      <NewJobPage />
    </RequireAccount>
  ),
});

function NewJobPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.jobs.newTitle + " — Stack Match", t.jobs.newSub);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <BackToJobs />
      <h1 className="mt-4 font-display text-3xl font-extrabold">{t.jobs.newTitle}</h1>
      <p className="mt-2 text-muted-foreground">{t.jobs.newSub}</p>
      <div className="mt-8">
        <JobForm
          initial={emptyJob}
          submitLabel={t.jobs.form.create}
          onCancel={() => void navigate({ to: "/jobs" })}
          onSubmit={async (job) => {
            try {
              const result = await createJobFn({ data: job });
              if ("error" in result) {
                toast.error(t.jobs.limit(maxJobsPerCompany));
                return;
              }
              await queryClient.invalidateQueries({ queryKey: jobsQueryKey });
              toast.success(t.jobs.created);
              await navigate({ to: "/jobs/$id", params: { id: result.job.id } });
            } catch {
              toast.error(t.jobs.saveError);
            }
          }}
        />
      </div>
    </main>
  );
}

function BackToJobs() {
  const { t } = useI18n();
  return (
    <Link
      to="/jobs"
      className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {t.jobs.backToJobs}
    </Link>
  );
}
