import { Briefcase, Clock3, MapPin, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import type { JobInput } from "@/lib/jobs";
import { useCompensationLabel } from "@/lib/use-compensation-label";
import type { Translations } from "@/lib/translations";
import { cn } from "@/lib/utils";

/**
 * What a job asks for, as the company wrote it: options, place, pay and stack. Options left empty
 * show as "any". Used on the job page and wherever developers see the job.
 */
export function JobDetails({
  job,
  translations,
  className,
  showDescription = true,
}: {
  job: JobInput;
  translations?: Translations | undefined;
  className?: string;
  showDescription?: boolean;
}) {
  const { t, tv } = useI18n();
  const compensation = useCompensationLabel()(job);
  const list = (values: readonly string[]) =>
    values.length ? values.map((value) => tv(value)).join(", ") : t.jobs.any;
  return (
    <div className={cn("space-y-5", className)}>
      {showDescription && job.description && (
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {tv(job.description, translations)}
        </p>
      )}
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Item icon={<Briefcase className="size-4" />} label={t.jobs.form.seniority}>
          {list(job.seniority)}
        </Item>
        <Item icon={<MapPin className="size-4" />} label={t.jobs.form.workModes}>
          {list(job.workModes)}
          {job.location ? ` · ${job.location}` : ""}
        </Item>
        <Item icon={<Briefcase className="size-4" />} label={t.jobs.form.hiringTypes}>
          {list(job.hiringTypes)}
        </Item>
        <Item icon={<Clock3 className="size-4" />} label={t.jobs.form.availability}>
          {list(job.availability)}
        </Item>
        {compensation && (
          <Item icon={<Wallet className="size-4" />} label={t.jobs.form.compensation}>
            {compensation}
          </Item>
        )}
      </dl>
      {(job.requiredSkills.length > 0 || job.desiredSkills.length > 0) && (
        <div className="space-y-3">
          {job.requiredSkills.length > 0 && (
            <SkillRow label={t.jobs.form.requiredSkills} skills={job.requiredSkills} strong />
          )}
          {job.desiredSkills.length > 0 && (
            <SkillRow label={t.jobs.form.desiredSkills} skills={job.desiredSkills} />
          )}
        </div>
      )}
    </div>
  );
}

function Item({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}

function SkillRow({
  label,
  skills,
  strong,
}: {
  label: string;
  skills: string[];
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <li key={skill} className={cn("skill-chip", strong && "border-primary/40 text-primary")}>
            {skill}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The job a company reached a developer about: its title, and the details on demand. What the
 * developer sees is the job as it was then.
 */
export function JobContext({
  job,
  translations,
  className,
}: {
  job: JobInput;
  translations?: Translations | undefined;
  className?: string;
}) {
  const { t, tv } = useI18n();
  return (
    <details className={cn("group rounded-lg border bg-muted/40 p-4", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">{t.jobs.aboutJob}</span>
          <span className="font-semibold">{tv(job.title, translations)}</span>
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
  );
}
