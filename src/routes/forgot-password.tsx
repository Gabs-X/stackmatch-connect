import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { AuthLayout, FieldError } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordResetSchema, requestPasswordReset } from "@/lib/auth";
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

function ForgotPasswordPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.auth.forgotTitle + " — Stack Match", t.auth.forgotSub);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailId = useId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { email: "" },
  });
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);

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
    <AuthLayout title={t.auth.forgotTitle} subtitle={t.auth.forgotSub} footer={backToLogin}>
      {sentTo ? (
        <div role="status" className="rounded-lg border bg-card p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-positive-soft text-positive">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-bold">{t.auth.forgotDoneTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.auth.forgotDone(sentTo)}</p>
          <p className="mt-3 text-xs text-muted-foreground">{t.auth.forgotDemo}</p>
        </div>
      ) : (
        <form
          className="space-y-5"
          noValidate
          onSubmit={handleSubmit(async ({ email }) => {
            await requestPasswordReset(email);
            setSentTo(email.trim());
          })}
        >
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
      )}
    </AuthLayout>
  );
}
