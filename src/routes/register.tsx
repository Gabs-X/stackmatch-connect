import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AlertCircle, BriefcaseBusiness, Check, Code2, Loader2, X } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AuthLayout, FieldError, PasswordInput, PasswordRules } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthError,
  formatCnpj,
  landingFor,
  signUpSchema,
  type AccountType,
  type SignUpInput,
} from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): { type?: AccountType; redirect?: string } => ({
    ...(search["type"] === "developer" || search["type"] === "company"
      ? { type: search["type"] }
      : {}),
    ...(typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Crie sua conta StackMatch como empresa ou desenvolvedor." },
      { property: "og:title", content: "Criar conta — Stack Match" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.auth.registerTitle + " — Stack Match", t.auth.registerSub);
  const { type, redirect } = Route.useSearch();
  const router = useRouter();
  const { signUp } = useAuth();
  const [error, setError] = useState<{ code: string; retryInSeconds: number } | null>(null);
  const ids = {
    name: useId(),
    company: useId(),
    cnpj: useId(),
    jobTitle: useId(),
    email: useId(),
    password: useId(),
    rules: useId(),
    terms: useId(),
  };
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      accountType: type ?? "company",
      name: "",
      company: "",
      cnpj: "",
      jobTitle: "",
      email: "",
      password: "",
      acceptTerms: false,
    },
  });
  const accountType = watch("accountType");
  const password = watch("password");
  const isCompany = accountType === "company";
  const cnpjField = register("cnpj");
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const created = await signUp(values);
      toast.success(t.auth.accountCreated, {
        description: t.auth.welcome(created.name.split(" ")[0] ?? created.name),
      });
      await router.navigate({ href: landingFor(created, redirect) });
    } catch (caught) {
      setError(
        caught instanceof AuthError
          ? { code: caught.code, retryInSeconds: caught.retryInSeconds }
          : { code: "unknown", retryInSeconds: 0 },
      );
    }
  });

  const accountOptions = [
    {
      value: "company" as const,
      icon: BriefcaseBusiness,
      title: t.auth.accountCompany,
      sub: t.auth.accountCompanySub,
    },
    {
      value: "developer" as const,
      icon: Code2,
      title: t.auth.accountDeveloper,
      sub: t.auth.accountDeveloperSub,
    },
  ];

  return (
    <AuthLayout
      title={t.auth.registerTitle}
      subtitle={t.auth.registerSub}
      footer={
        <>
          {t.auth.haveAccount}{" "}
          <Link
            to="/login"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t.auth.signIn}
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/30 bg-danger-soft px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            {error.code === "too-many-emails"
              ? t.auth.tooManyEmails(error.retryInSeconds)
              : message(error.code)}
          </p>
        )}

        <fieldset>
          <legend className="text-sm font-medium">{t.auth.accountTypeLabel}</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {accountOptions.map(({ value, icon: Icon, title, sub }) => (
              <label
                key={value}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  accountType === value
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/50 hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  value={value}
                  checked={accountType === value}
                  onChange={() =>
                    setValue("accountType", value, {
                      shouldValidate: Boolean(errors.company || errors.jobTitle),
                    })
                  }
                  className="sr-only"
                />
                <Icon
                  className={cn(
                    "size-5",
                    accountType === value ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className="mt-1 text-sm font-semibold">{title}</span>
                <span className="text-xs text-muted-foreground">{sub}</span>
                {accountType === value && (
                  <Check
                    className="absolute right-3 top-3 size-4 text-primary"
                    aria-hidden="true"
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor={ids.name}>{t.auth.name}</Label>
          <Input
            id={ids.name}
            autoComplete="name"
            className="mt-2"
            placeholder={t.auth.namePh}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${ids.name}-error` : undefined}
            {...register("name")}
          />
          <FieldError id={`${ids.name}-error`} message={message(errors.name?.message)} />
        </div>

        {isCompany && (
          <div>
            <Label htmlFor={ids.company}>{t.auth.companyName}</Label>
            <Input
              id={ids.company}
              autoComplete="organization"
              className="mt-2"
              placeholder={t.auth.companyNamePh}
              aria-invalid={Boolean(errors.company)}
              aria-describedby={errors.company ? `${ids.company}-error` : undefined}
              {...register("company")}
            />
            <FieldError id={`${ids.company}-error`} message={message(errors.company?.message)} />
          </div>
        )}

        {isCompany && (
          <div>
            <Label htmlFor={ids.cnpj}>{t.auth.cnpj}</Label>
            <Input
              id={ids.cnpj}
              inputMode="numeric"
              maxLength={18}
              className="mt-2"
              placeholder={t.auth.cnpjPh}
              aria-invalid={Boolean(errors.cnpj)}
              aria-describedby={errors.cnpj ? `${ids.cnpj}-error` : undefined}
              {...cnpjField}
              onChange={(event) => {
                event.target.value = formatCnpj(event.target.value);
                void cnpjField.onChange(event);
              }}
            />
            <FieldError id={`${ids.cnpj}-error`} message={message(errors.cnpj?.message)} />
          </div>
        )}

        <div>
          <Label htmlFor={ids.jobTitle}>
            {isCompany ? t.auth.companyJobTitle : t.auth.devJobTitle}
          </Label>
          <Input
            id={ids.jobTitle}
            autoComplete="organization-title"
            className="mt-2"
            placeholder={isCompany ? t.auth.companyJobTitlePh : t.auth.devJobTitlePh}
            aria-invalid={Boolean(errors.jobTitle)}
            aria-describedby={errors.jobTitle ? `${ids.jobTitle}-error` : undefined}
            {...register("jobTitle")}
          />
          <FieldError id={`${ids.jobTitle}-error`} message={message(errors.jobTitle?.message)} />
        </div>

        <div>
          <Label htmlFor={ids.email}>{t.auth.email}</Label>
          <Input
            id={ids.email}
            type="email"
            autoComplete="email"
            className="mt-2"
            placeholder={t.auth.emailPh}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${ids.email}-error` : undefined}
            {...register("email")}
          />
          <FieldError id={`${ids.email}-error`} message={message(errors.email?.message)} />
        </div>

        <div>
          <Label htmlFor={ids.password}>{t.auth.password}</Label>
          <div className="mt-2">
            <PasswordInput
              id={ids.password}
              autoComplete="new-password"
              placeholder={t.auth.newPasswordPh}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={`${ids.rules}${errors.password ? ` ${ids.password}-error` : ""}`}
              {...register("password")}
            />
          </div>
          <PasswordRules id={ids.rules} password={password} />
          <FieldError id={`${ids.password}-error`} message={message(errors.password?.message)} />
        </div>

        <div>
          <label htmlFor={ids.terms} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              id={ids.terms}
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
              aria-invalid={Boolean(errors.acceptTerms)}
              aria-describedby={errors.acceptTerms ? `${ids.terms}-error` : undefined}
              {...register("acceptTerms")}
            />
            <span>
              {t.auth.acceptTermsBefore}
              {/* A new tab keeps what was typed in the form. */}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener"
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t.auth.acceptTermsLink}
              </Link>
              .
            </span>
          </label>
          <FieldError id={`${ids.terms}-error`} message={message(errors.acceptTerms?.message)} />
        </div>

        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? t.auth.registering : t.auth.registerSubmit}
        </Button>
      </form>
    </AuthLayout>
  );
}
