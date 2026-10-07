import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AuthLayout,
  FieldError,
  FormAlert,
  PasswordInput,
  PasswordRules,
} from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newPasswordSchema, passwordResetSchema, type NewPasswordInput } from "@/lib/auth";
import { requestPasswordResetFn, resetPasswordFn } from "@/lib/auth-api";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Recupere o acesso à sua conta StackMatch." },
    ],
  }),
  component: ForgotPasswordPage,
});

/**
 * Password recovery in two steps on one screen: the e-mail that gets a code, then the code with
 * the new password. The first step answers the same whether or not the e-mail has an account.
 */
function ForgotPasswordPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.auth.forgotTitle + " — Stack Match", t.auth.forgotSub);
  const [email, setEmail] = useState<string | null>(null);

  const backToLogin = (
    <Link
      to="/login"
      className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-4" />
      {t.auth.backToLogin}
    </Link>
  );

  return (
    <AuthLayout
      title={t.auth.forgotTitle}
      subtitle={email ? t.auth.resetSub(email) : t.auth.forgotSub}
      footer={backToLogin}
    >
      {email ? (
        <NewPasswordForm email={email} onOtherEmail={() => setEmail(null)} />
      ) : (
        <EmailForm onSent={setEmail} />
      )}
    </AuthLayout>
  );
}

function EmailForm({ onSent }: { onSent: (email: string) => void }) {
  const { t, lang } = useI18n();
  const emailId = useId();
  const [failed, setFailed] = useState(false);
  // Seconds the network must wait: it asked for too many code e-mails lately.
  const [wait, setWait] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: "" },
  });
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit(async ({ email }) => {
        setFailed(false);
        setWait(0);
        try {
          const result = await requestPasswordResetFn({ data: { email, language: lang } });
          if ("retryInSeconds" in result) setWait(result.retryInSeconds);
          else onSent(email.trim());
        } catch {
          setFailed(true);
        }
      })}
    >
      {failed && <FormAlert>{t.auth.errors["unknown"]}</FormAlert>}
      {wait > 0 && <FormAlert>{t.auth.tooManyEmails(wait)}</FormAlert>}
      <div>
        <Label htmlFor={emailId}>{t.auth.email}</Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          className="mt-2"
          placeholder={t.auth.emailPh}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${emailId}-error` : undefined}
          {...register("email")}
        />
        <FieldError id={`${emailId}-error`} message={message(errors.email?.message)} />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? t.auth.sending : t.auth.forgotSubmit}
      </Button>
    </form>
  );
}

function NewPasswordForm({ email, onOtherEmail }: { email: string; onOtherEmail: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const ids = { code: useId(), password: useId(), rules: useId() };
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { code: "", password: "" },
  });
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        try {
          const result = await resetPasswordFn({ data: { ...values, email } });
          if ("error" in result) {
            setError(result.error);
            return;
          }
          toast.success(t.auth.resetDone);
          await router.navigate({ to: "/login" });
        } catch {
          setError("unknown");
        }
      })}
    >
      {error && <FormAlert>{message(error)}</FormAlert>}
      <div>
        <Label htmlFor={ids.code}>{t.auth.code}</Label>
        <Input
          id={ids.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="mt-2 font-mono tracking-[0.4em]"
          placeholder="000000"
          aria-invalid={Boolean(errors.code)}
          aria-describedby={errors.code ? `${ids.code}-error` : undefined}
          {...register("code")}
        />
        <FieldError id={`${ids.code}-error`} message={message(errors.code?.message)} />
      </div>
      <div>
        <Label htmlFor={ids.password}>{t.auth.newPassword}</Label>
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
        <PasswordRules id={ids.rules} password={watch("password")} />
        <FieldError id={`${ids.password}-error`} message={message(errors.password?.message)} />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? t.auth.saving : t.auth.resetSubmit}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onOtherEmail}>
        {t.auth.otherEmail}
      </Button>
    </form>
  );
}
