import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AuthLayout, FieldError, FormAlert } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { landingFor, verifyEmailSchema, type VerifyEmailInput } from "@/lib/auth";
import { resendVerificationFn, verifyEmailFn } from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Confirme o e-mail da sua conta StackMatch." },
    ],
  }),
  component: VerifyEmailPage,
});

/** Same as the server's: a code was sent at sign-up or sign-in, so wait before another. */
const resendCooldownSeconds = 60;

/**
 * Where a new account, or one signing in before confirming, enters the code it got by e-mail.
 * Until then, the server refuses everything else the account tries.
 */
function VerifyEmailPage() {
  const { t, lang } = useI18n();
  useLocalizedMeta(t.auth.verifyTitle + " — Stack Match", t.auth.verifyTitle);
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const { user, ready, signOut, updateUser } = useAuth();
  const codeId = useId();
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(resendCooldownSeconds);
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { code: "" },
  });
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);

  // Nobody to confirm: sign in first. Already confirmed: on to where the account was going.
  useEffect(() => {
    if (!ready) return;
    if (!user)
      void router.navigate({ to: "/login", search: { redirect: "/verify-email" }, replace: true });
    else if (user.emailVerified)
      void router.navigate({ href: landingFor(user, redirect), replace: true });
  }, [ready, user, redirect, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    try {
      const result = await verifyEmailFn({ data: { code } });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      updateUser(result.user);
      toast.success(t.auth.verified);
      await router.navigate({ href: landingFor(result.user, redirect) });
    } catch {
      setError("unknown");
    }
  });

  const resend = async () => {
    setError(null);
    setResending(true);
    try {
      const result = await resendVerificationFn({ data: { language: lang } });
      if ("retryInSeconds" in result) setCooldown(result.retryInSeconds);
      else {
        toast.success(t.auth.resent);
        setCooldown(resendCooldownSeconds);
      }
    } catch {
      setError("unknown");
    } finally {
      setResending(false);
    }
  };

  if (!ready || !user || user.emailVerified)
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t.common.loading}
        </p>
      </main>
    );

  const footer = (
    <p>
      {t.auth.notYou}{" "}
      <button
        type="button"
        className="font-semibold text-primary underline-offset-4 hover:underline"
        onClick={() => void signOut()}
      >
        {t.auth.signOut}
      </button>
    </p>
  );

  return (
    <AuthLayout title={t.auth.verifyTitle} subtitle={t.auth.verifySub(user.email)} footer={footer}>
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        {error && <FormAlert>{message(error)}</FormAlert>}
        <div>
          <Label htmlFor={codeId}>{t.auth.code}</Label>
          <Input
            id={codeId}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className="mt-2 font-mono tracking-[0.4em]"
            placeholder="000000"
            aria-invalid={Boolean(errors.code)}
            aria-describedby={`${codeId}-hint${errors.code ? ` ${codeId}-error` : ""}`}
            {...register("code")}
          />
          <p id={`${codeId}-hint`} className="mt-2 text-xs text-muted-foreground">
            {t.auth.codeHint}
          </p>
          <FieldError id={`${codeId}-error`} message={message(errors.code?.message)} />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? t.auth.verifying : t.auth.verifySubmit}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={cooldown > 0 || resending}
          onClick={() => void resend()}
        >
          {resending && <Loader2 className="animate-spin" />}
          {cooldown > 0 ? t.auth.resendIn(cooldown) : t.auth.resend}
        </Button>
      </form>
    </AuthLayout>
  );
}
