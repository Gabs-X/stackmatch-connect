import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Globe,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useEffect, useId, type ComponentProps, type ReactNode } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { FieldError } from "@/components/auth-layout";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { companySettingsKey, saveCompanySettings } from "@/lib/api";
import { formatCnpj, type AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import {
  companySettingsSchema,
  type CompanySettings,
  type CompanySettingsInput,
} from "@/lib/company-settings";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { profileLink } from "@/lib/local-profile";
import { useCompanySettings } from "@/lib/use-company-settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/company-settings")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Dados da sua empresa no StackMatch." },
      { property: "og:title", content: "Dados da empresa — Stack Match" },
    ],
  }),
  component: () => (
    <RequireAccount type="company">
      <CompanySettingsPage />
    </RequireAccount>
  ),
});

function CompanySettingsPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.companySettings.title + " — Stack Match", t.companySettings.sub);
  const { user } = useAuth();
  const settings = useCompanySettings();
  // RequireAccount only renders this page for a signed-in company.
  return user && settings ? <SettingsForm user={user} settings={settings} /> : null;
}

function SettingsForm({ user, settings }: { user: AuthUser; settings: CompanySettings }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CompanySettingsInput, unknown, CompanySettings>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: settings,
  });
  // Follow the saved settings when they change elsewhere (another tab, or the first load).
  useEffect(() => reset(settings), [settings, reset]);
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);
  const values = watch();

  const onSubmit = handleSubmit(async (input) => {
    try {
      const saved = await saveCompanySettings(user.id, input);
      queryClient.setQueryData(companySettingsKey(user.id), saved);
      reset(saved);
      toast.success(t.companySettings.saved);
    } catch {
      toast.error(t.companySettings.saveError);
    }
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{t.companySettings.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{t.companySettings.title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t.companySettings.sub}</p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form className="space-y-6" onSubmit={onSubmit} noValidate>
          <Section
            icon={<Lock className="size-4" />}
            title={t.companySettings.registration}
            note={t.companySettings.registrationNote}
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReadOnly label={t.companySettings.companyName} value={user.company} />
              <ReadOnly
                label={t.companySettings.cnpj}
                value={user.cnpj ? formatCnpj(user.cnpj) : t.companySettings.notInformed}
              />
              <ReadOnly
                label={t.companySettings.loginEmail}
                value={user.email}
                className="sm:col-span-2"
              />
            </dl>
          </Section>

          <Section icon={<Building2 className="size-4" />} title={t.companySettings.company}>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label={t.companySettings.website + " " + t.companySettings.optional}
                placeholder={t.companySettings.websitePh}
                registration={register("website")}
                error={message(errors.website?.message)}
                inputMode="url"
              />
              <TextField
                label={t.companySettings.location + " " + t.companySettings.optional}
                placeholder={t.companySettings.locationPh}
                registration={register("location")}
                error={message(errors.location?.message)}
              />
            </div>
            <AboutField
              label={t.companySettings.about + " " + t.companySettings.optional}
              placeholder={t.companySettings.aboutPh}
              registration={register("about")}
              error={message(errors.about?.message)}
              count={t.companySettings.aboutCount(values.about?.length ?? 0)}
            />
          </Section>

          <Section
            icon={<UserRound className="size-4" />}
            title={t.companySettings.contact}
            note={t.companySettings.contactNote}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label={t.companySettings.contactName}
                placeholder={t.companySettings.contactNamePh}
                registration={register("contactName")}
                error={message(errors.contactName?.message)}
                autoComplete="name"
              />
              <TextField
                label={t.companySettings.contactRole}
                placeholder={t.companySettings.contactRolePh}
                registration={register("contactRole")}
                error={message(errors.contactRole?.message)}
                autoComplete="organization-title"
              />
              <TextField
                label={t.companySettings.contactEmail}
                placeholder={t.companySettings.contactEmailPh}
                registration={register("contactEmail")}
                error={message(errors.contactEmail?.message)}
                type="email"
                autoComplete="email"
              />
              <TextField
                label={t.companySettings.phone}
                placeholder={t.companySettings.phonePh}
                registration={register("phone")}
                error={message(errors.phone?.message)}
                type="tel"
                autoComplete="tel"
              />
            </div>
          </Section>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!isDirty || isSubmitting}
              onClick={() => reset(settings)}
            >
              <RotateCcw />
              {t.companySettings.discard}
            </Button>
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? t.companySettings.saving : t.companySettings.save}
            </Button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold">{t.companySettings.preview}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t.companySettings.previewNote}</p>
          <Preview company={user.company} values={values} />
        </aside>
      </div>
    </main>
  );
}

function Section({
  icon,
  title,
  note,
  children,
}: {
  icon: ReactNode;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 id={id} className="flex items-center gap-2 font-bold">
        <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        {title}
      </h2>
      {note && <p className="mt-1.5 text-sm text-muted-foreground">{note}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function ReadOnly({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-lg bg-muted/60 px-3.5 py-3", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-semibold" title={value}>
        {value}
      </dd>
    </div>
  );
}

function TextField({
  label,
  registration,
  error,
  ...input
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
} & Omit<ComponentProps<typeof Input>, "id">) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-2"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
        {...registration}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function AboutField({
  label,
  placeholder,
  registration,
  error,
  count,
}: {
  label: string;
  placeholder: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  count: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <Textarea
        id={id}
        rows={4}
        className="mt-2"
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Mirrors the company card developers see in Interested companies. */
function Preview({ company, values }: { company: string; values: CompanySettingsInput }) {
  const { t } = useI18n();
  const website = profileLink(values.website ?? "");
  const details = [
    values.location && { icon: MapPin, text: values.location },
    website && {
      icon: Globe,
      text: website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
    },
    values.contactEmail && { icon: Mail, text: values.contactEmail },
    values.phone && { icon: Phone, text: values.phone },
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];
  return (
    <div className="mt-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{company}</p>
          <p className="flex items-start gap-1.5 break-words text-sm text-muted-foreground">
            <UserRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t.interests.contact(
              [values.contactName, values.contactRole].filter(Boolean).join(" · ") || "—",
            )}
          </p>
        </div>
      </div>
      {values.about && (
        <p className="mt-4 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
          {values.about}
        </p>
      )}
      {details.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {details.map(({ icon: Icon, text }) => (
            <li key={text} className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
