import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Loader2, Mail, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FieldError, FormAlert, PasswordInput, PasswordRules } from "@/components/auth-layout";
import { RequireAccount } from "@/components/require-account";
import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  verifyEmailSchema,
  type AuthUser,
  type ChangeEmailInput,
  type ChangePasswordInput,
  type DeleteAccountInput,
  type VerifyEmailInput,
} from "@/lib/auth";
import {
  changePasswordFn,
  confirmEmailChangeFn,
  deleteAccountFn,
  requestEmailChangeFn,
} from "@/lib/account-api";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "E-mail, senha e exclusão da sua conta StackMatch." },
    ],
  }),
  component: () => (
    <RequireAccount>
      <AccountPage />
    </RequireAccount>
  ),
});

/** An error a settings form shows: a code from the server, or the sign-in lock with its wait. */
type FormError = { code: string; retryInSeconds?: number } | null;

function useErrorMessage() {
  const { t } = useI18n();
  return (error: FormError) => {
    if (!error) return undefined;
    if (error.code === "login-locked")
      return t.auth.loginLocked(Math.ceil((error.retryInSeconds ?? 60) / 60));
    return t.auth.errors[error.code] ?? t.auth.errors["unknown"];
  };
}

function AccountPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.account.title + " — Stack Match", t.account.sub);
  const { user } = useAuth();
  // RequireAccount only renders this page for a signed-in, confirmed account.
  if (!user) return null;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{t.account.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{t.account.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.account.sub}</p>
      <div className="mt-8 space-y-6">
        <EmailSection user={user} />
        <PasswordSection />
        <DeleteSection user={user} />
      </div>
    </main>
  );
}

function EmailSection({ user }: { user: AuthUser }) {
  const { t, lang } = useI18n();
  const { updateUser } = useAuth();
  const errorMessage = useErrorMessage();
  const ids = { email: useId(), password: useId(), code: useId() };
  // The new address, once a code was sent to it.
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<FormError>(null);
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);

  const request = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: "", password: "" },
  });
  const confirm = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: "" },
  });

  const onRequest = request.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await requestEmailChangeFn({ data: { ...values, language: lang } });
      if ("error" in result)
        setError({
          code: result.error,
          ...("retryInSeconds" in result ? { retryInSeconds: result.retryInSeconds } : {}),
        });
      else if ("retryInSeconds" in result) toast.error(t.account.waitCode(result.retryInSeconds));
      else setPending(values.email.trim().toLowerCase());
    } catch {
      setError({ code: "unknown" });
    }
  });

  const onConfirm = confirm.handleSubmit(async ({ code }) => {
    setError(null);
    try {
      const result = await confirmEmailChangeFn({ data: { code, language: lang } });
      if ("error" in result) {
        setError({ code: result.error });
        return;
      }
      updateUser(result.user);
      toast.success(t.account.emailChanged);
      setPending(null);
      request.reset();
      confirm.reset();
    } catch {
      setError({ code: "unknown" });
    }
  });

  return (
    <SettingsSection
      icon={<Mail className="size-4" />}
      title={t.account.emailSection}
      note={pending ? t.account.codeSent(pending) : t.account.emailCurrent(user.email)}
    >
      {error && <FormAlert>{errorMessage(error)}</FormAlert>}
      {pending ? (
        <form className="space-y-5" onSubmit={onConfirm} noValidate>
          <div>
            <Label htmlFor={ids.code}>{t.auth.code}</Label>
            <Input
              id={ids.code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="mt-2 max-w-48 font-mono tracking-[0.4em]"
              placeholder="000000"
              aria-invalid={Boolean(confirm.formState.errors.code)}
              {...confirm.register("code")}
            />
            <FieldError
              id={`${ids.code}-error`}
              message={message(confirm.formState.errors.code?.message)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={confirm.formState.isSubmitting}>
              {confirm.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {t.account.confirmEmail}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPending(null);
                setError(null);
              }}
            >
              {t.account.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={onRequest} noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor={ids.email}>{t.account.newEmail}</Label>
              <Input
                id={ids.email}
                type="email"
                autoComplete="email"
                className="mt-2"
                aria-invalid={Boolean(request.formState.errors.email)}
                {...request.register("email")}
              />
              <FieldError
                id={`${ids.email}-error`}
                message={message(request.formState.errors.email?.message)}
              />
            </div>
            <div>
              <Label htmlFor={ids.password}>{t.account.currentPassword}</Label>
              <div className="mt-2">
                <PasswordInput
                  id={ids.password}
                  autoComplete="current-password"
                  aria-invalid={Boolean(request.formState.errors.password)}
                  {...request.register("password")}
                />
              </div>
              <FieldError
                id={`${ids.password}-error`}
                message={message(request.formState.errors.password?.message)}
              />
            </div>
          </div>
          <Button type="submit" disabled={request.formState.isSubmitting}>
            {request.formState.isSubmitting && <Loader2 className="animate-spin" />}
            {t.account.sendCode}
          </Button>
        </form>
      )}
    </SettingsSection>
  );
}

function PasswordSection() {
  const { t } = useI18n();
  const errorMessage = useErrorMessage();
  const ids = { current: useId(), password: useId(), rules: useId() };
  const [error, setError] = useState<FormError>(null);
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await changePasswordFn({ data: values });
      if ("error" in result) {
        setError({
          code: result.error,
          ...("retryInSeconds" in result ? { retryInSeconds: result.retryInSeconds } : {}),
        });
        return;
      }
      toast.success(t.account.passwordChanged);
      reset();
    } catch {
      setError({ code: "unknown" });
    }
  });

  return (
    <SettingsSection
      icon={<KeyRound className="size-4" />}
      title={t.account.passwordSection}
      note={t.account.passwordNote}
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {error && <FormAlert>{errorMessage(error)}</FormAlert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor={ids.current}>{t.account.currentPassword}</Label>
            <div className="mt-2">
              <PasswordInput
                id={ids.current}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.currentPassword)}
                {...register("currentPassword")}
              />
            </div>
            <FieldError
              id={`${ids.current}-error`}
              message={message(errors.currentPassword?.message)}
            />
          </div>
          <div>
            <Label htmlFor={ids.password}>{t.account.newPassword}</Label>
            <div className="mt-2">
              <PasswordInput
                id={ids.password}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={ids.rules}
                {...register("password")}
              />
            </div>
            <PasswordRules id={ids.rules} password={watch("password")} />
            <FieldError id={`${ids.password}-error`} message={message(errors.password?.message)} />
          </div>
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? t.account.saving : t.account.savePassword}
        </Button>
      </form>
    </SettingsSection>
  );
}

function DeleteSection({ user }: { user: AuthUser }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const errorMessage = useErrorMessage();
  const ids = { password: useId(), confirm: useId() };
  const [error, setError] = useState<FormError>(null);
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "", confirm: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await deleteAccountFn({ data: values });
      if ("error" in result) {
        setError({
          code: result.error,
          ...("retryInSeconds" in result ? { retryInSeconds: result.retryInSeconds } : {}),
        });
        return;
      }
      // The server already ended the session; this updates the screens and goes home.
      await signOut();
      toast.success(t.account.deleted);
    } catch {
      setError({ code: "unknown" });
    }
  });

  return (
    <SettingsSection
      icon={<Trash2 className="size-4" />}
      title={t.account.deleteSection}
      note={user.accountType === "developer" ? t.account.deleteDeveloper : t.account.deleteCompany}
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {error && <FormAlert>{errorMessage(error)}</FormAlert>}
        <div className="max-w-sm">
          <Label htmlFor={ids.password}>{t.account.currentPassword}</Label>
          <div className="mt-2">
            <PasswordInput
              id={ids.password}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
          </div>
          <FieldError id={`${ids.password}-error`} message={message(errors.password?.message)} />
        </div>
        <div>
          <label htmlFor={ids.confirm} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              id={ids.confirm}
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--destructive)]"
              aria-invalid={Boolean(errors.confirm)}
              {...register("confirm")}
            />
            {t.account.deleteConfirm}
          </label>
          <FieldError id={`${ids.confirm}-error`} message={message(errors.confirm?.message)} />
        </div>
        <Button type="submit" variant="destructive" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? t.account.deleting : t.account.deleteButton}
        </Button>
      </form>
    </SettingsSection>
  );
}
