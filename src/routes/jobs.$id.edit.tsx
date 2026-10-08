import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { JobForm } from "@/components/job-form";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import type { Job, JobInput } from "@/lib/jobs";
import { jobQuery, jobsQueryKey, updateJobFn } from "@/lib/jobs-api";

export const Route = createFileRoute("/jobs/$id/edit")({
  head: () => ({ meta: [{ title: "Stack Match" }] }),
  component: () => (
    <RequireAccount type="company">
      <EditJobPage />
    </RequireAccount>
  ),
});

/** The fields the form edits, without the job's id, status and dates. */
const formFields = ({ id: _id, status: _status, createdAt: _c, updatedAt: _u, ...job }: Job) =>
  job satisfies JobInput;

function EditJobPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  useLocalizedMeta(t.jobs.editTitle + " — Stack Match", t.jobs.newSub);
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: job, isError, refetch } = useQuery(jobQuery(user?.id ?? "", id));
  const back = (
    <Link
      to="/jobs/$id"
      params={{ id }}
      className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {t.jobs.backToJob}
    </Link>
  );
  if (!job)
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 text-center">
        {job === null || isError ? (
          <div role="alert">
            <p className="text-sm text-muted-foreground">
              {job === null ? t.jobs.notFound : t.jobs.loadError}
            </p>
            <Button className="mt-4" onClick={() => void refetch()}>
              {t.common.retry}
            </Button>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {t.common.loading}
          </p>
        )}
      </main>
    );
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {back}
      <h1 className="mt-4 font-display text-3xl font-extrabold">{t.jobs.editTitle}</h1>
      <p className="mt-2 text-muted-foreground">{job.title}</p>
      <div className="mt-8">
        <JobForm
          initial={formFields(job)}
          submitLabel={t.jobs.form.save}
          onCancel={() => void navigate({ to: "/jobs/$id", params: { id } })}
          onSubmit={async (input) => {
            try {
              const saved = await updateJobFn({ data: { id, job: input } });
              if (!saved) throw new Error("Unknown job.");
              await queryClient.invalidateQueries({ queryKey: jobsQueryKey });
              toast.success(t.jobs.saved);
              await navigate({ to: "/jobs/$id", params: { id } });
            } catch {
              toast.error(t.jobs.saveError);
            }
          }}
        />
      </div>
    </main>
  );
}
