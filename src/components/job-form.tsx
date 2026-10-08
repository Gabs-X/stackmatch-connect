import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, Code2, Loader2, MapPin, Megaphone, Wallet, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { FieldError } from "@/components/auth-layout";
import { LocationField } from "@/components/location-field";
import { SettingsSection } from "@/components/settings-section";
import { SkillCombobox } from "@/components/skill-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  availabilityOptions,
  hiringOptions,
  seniorityOptions,
  workModeOptions,
} from "@/lib/developers";
import { useI18n } from "@/lib/i18n";
import { compensationPeriods, jobInputSchema, type JobInput } from "@/lib/jobs";
import { skillCatalogQuery } from "@/lib/profile-api";

type ErrorField = "title" | "location" | "compensationMax";

/**
 * Creates or edits a job: what it is, the stack, the options it accepts and the pay. Every field
 * but the title is optional; an empty option group accepts any value.
 */
export function JobForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: JobInput;
  submitLabel: string;
  /** Resolves once saved; the form stays as it is when it rejects. */
  onSubmit: (job: JobInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [job, setJob] = useState<JobInput>(initial);
  const [errors, setErrors] = useState<Partial<Record<ErrorField, string>>>({});
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const listedId = useId();
  const update = <K extends keyof JobInput>(key: K, value: JobInput[K]) => {
    setJob((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = jobInputSchema.safeParse(job);
    if (!parsed.success) {
      const found: Partial<Record<ErrorField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "title" || field === "location" || field === "compensationMax")
          found[field] ??= t.jobs.errors[field];
      }
      setErrors(found);
      (document.getElementById(titleId) as HTMLInputElement | null)?.form
        ?.querySelector<HTMLElement>("[aria-invalid]")
        ?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(parsed.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={(event) => void submit(event)} noValidate>
      <SettingsSection icon={<BriefcaseBusiness className="size-4" />} title={t.jobs.form.about}>
        <div>
          <Label htmlFor={titleId}>
            {t.jobs.form.title}
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          </Label>
          <Input
            id={titleId}
            className="mt-2"
            placeholder={t.jobs.form.titlePh}
            value={job.title}
            maxLength={120}
            onChange={(event) => update("title", event.target.value)}
            aria-required="true"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${titleId}-error` : undefined}
          />
          <FieldError id={`${titleId}-error`} message={errors.title} />
        </div>
        <div>
          <Label htmlFor={descriptionId}>{t.jobs.form.description}</Label>
          <Textarea
            id={descriptionId}
            className="mt-2 min-h-32"
            placeholder={t.jobs.form.descriptionPh}
            value={job.description}
            maxLength={4000}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<Code2 className="size-4" />}
        title={t.jobs.form.stack}
        note={t.jobs.form.stackNote}
      >
        <SkillList
          label={t.jobs.form.requiredSkills}
          chosen={job.requiredSkills}
          others={job.desiredSkills}
          onChange={(skills) => update("requiredSkills", skills)}
        />
        <SkillList
          label={t.jobs.form.desiredSkills}
          chosen={job.desiredSkills}
          others={job.requiredSkills}
          onChange={(skills) => update("desiredSkills", skills)}
        />
      </SettingsSection>

      <SettingsSection
        icon={<MapPin className="size-4" />}
        title={t.jobs.form.profile}
        note={t.jobs.form.profileNote}
      >
        <OptionGroup
          label={t.jobs.form.seniority}
          options={seniorityOptions}
          chosen={job.seniority}
          onChange={(value) => update("seniority", value)}
        />
        <OptionGroup
          label={t.jobs.form.workModes}
          options={workModeOptions}
          chosen={job.workModes}
          onChange={(value) => update("workModes", value)}
        />
        <OptionGroup
          label={t.jobs.form.hiringTypes}
          options={hiringOptions}
          chosen={job.hiringTypes}
          onChange={(value) => update("hiringTypes", value)}
        />
        <OptionGroup
          label={t.jobs.form.availability}
          options={availabilityOptions}
          chosen={job.availability}
          onChange={(value) => update("availability", value)}
        />
        <LocationField
          value={job.location}
          onChange={(value) => update("location", value)}
          error={errors.location}
          required={false}
          label={t.jobs.form.location}
          hint={t.jobs.form.locationHint}
        />
        {job.location && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mt-3"
            onClick={() => update("location", "")}
          >
            <X />
            {t.jobs.form.clearLocation}
          </Button>
        )}
      </SettingsSection>

      <SettingsSection
        icon={<Wallet className="size-4" />}
        title={t.jobs.form.compensation}
        note={t.jobs.form.compensationNote}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <AmountField
            label={t.jobs.form.compensationMin}
            value={job.compensationMin}
            onChange={(value) => update("compensationMin", value)}
          />
          <AmountField
            label={t.jobs.form.compensationMax}
            value={job.compensationMax}
            onChange={(value) => update("compensationMax", value)}
            error={errors.compensationMax}
          />
          <PeriodField
            value={job.compensationPeriod}
            onChange={(value) => update("compensationPeriod", value)}
          />
        </div>
      </SettingsSection>

      <SettingsSection icon={<Megaphone className="size-4" />} title={t.jobs.form.visibility}>
        <div className="flex items-start gap-3">
          <input
            id={listedId}
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={job.listed}
            onChange={(event) => update("listed", event.target.checked)}
            aria-describedby={`${listedId}-hint`}
          />
          <div>
            <Label htmlFor={listedId}>{t.jobs.form.listed}</Label>
            <p id={`${listedId}-hint`} className="mt-1 text-xs text-muted-foreground">
              {t.jobs.form.listedHint}
            </p>
          </div>
        </div>
      </SettingsSection>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t.jobs.form.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Skills chosen from the catalog (or typed), shown as chips that remove themselves. */
function SkillList({
  label,
  chosen,
  others,
  onChange,
}: {
  label: string;
  chosen: string[];
  /** The other list's skills, which this one doesn't offer again. */
  others: string[];
  onChange: (skills: string[]) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const { data: catalog = [] } = useQuery(skillCatalogQuery);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <SkillCombobox
        id={id}
        catalog={catalog}
        chosen={[...chosen, ...others]}
        onAdd={(skill) => onChange([...chosen, skill])}
        placeholder={t.create.skillPh}
      />
      {chosen.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chosen.map((skill) => (
            <button
              type="button"
              className="skill-chip flex items-center gap-1"
              key={skill}
              aria-label={`${t.filters.remove}: ${skill}`}
              onClick={() => onChange(chosen.filter((item) => item !== skill))}
            >
              {skill}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Options the job accepts; none chosen means any. */
function OptionGroup<T extends string>({
  label,
  options,
  chosen,
  onChange,
}: {
  label: string;
  options: readonly T[];
  chosen: T[];
  onChange: (chosen: T[]) => void;
}) {
  const { t, tv } = useI18n();
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <p className="mt-1 text-xs text-muted-foreground">{t.jobs.form.anyHint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = chosen.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              className={selected ? "filter-chip filter-chip-active" : "filter-chip"}
              onClick={() =>
                onChange(selected ? chosen.filter((item) => item !== option) : [...chosen, option])
              }
            >
              {tv(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** A whole number of reais, or null when blank; only digits are kept. */
function AmountField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-2"
        inputMode="numeric"
        placeholder="R$"
        value={value?.toString() ?? ""}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 7);
          onChange(digits ? Number(digits) : null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function PeriodField({
  value,
  onChange,
}: {
  value: JobInput["compensationPeriod"];
  onChange: (value: JobInput["compensationPeriod"]) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{t.jobs.form.period}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as JobInput["compensationPeriod"])}
        className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {compensationPeriods.map((period) => (
          <option key={period} value={period}>
            {t.jobs.periods[period]}
          </option>
        ))}
      </select>
    </div>
  );
}
