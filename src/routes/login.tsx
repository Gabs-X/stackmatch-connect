import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AlertCircle, FlaskConical, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AuthLayout, FieldError, PasswordInput } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthError,
  demoAccounts,
  demoPassword,
  homeFor,
  safeRedirect,
  signInSchema,
  type SignInInput,
} from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Entre na sua conta StackMatch." },
      { property: "og:title", content: "Entrar — Stack Match" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.auth.loginTitle + " — Stack Match", t.auth.loginSub);
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const { user, signIn, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ids = { email: useId(), password: useId() };
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const message = (code?: string) => (code ? (t.auth.errors[code] ?? code) : undefined);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const signedIn = await signIn(values);
      toast.success(t.auth.welcome(signedIn.name.split(" ")[0] ?? signedIn.name));
      await router.navigate({ href: safeRedirect(redirect, homeFor(signedIn)) });
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.code : "unknown");
    }
  });

  return (
    <AuthLayout
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSub}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link
            to="/register"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t.auth.createAccount}
          </Link>
        </>
      }
    >
      {user ? (
        <div className="space-y-4 rounded-lg border bg-card p-5">
          <p>{t.auth.alreadySignedIn(user.name)}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void router.navigate({ href: homeFor(user) })}>
              {t.auth.continue}
            </Button>
            <Button variant="outline" onClick={signOut}>
              {t.auth.menu.signOut}
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={onSubmit} noValidate>
          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-danger-soft px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              {message(error)}
            </p>
          )}
          <div>
            <Label htmlFor={ids.email}>{t.auth.loginId}</Label>
            <Input
              id={ids.email}
              type="text"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="username"
              className="mt-2"
              placeholder={t.auth.loginIdPh}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${ids.email}-error` : undefined}
              {...register("email")}
            />
            <FieldError id={`${ids.email}-error`} message={message(errors.email?.message)} />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={ids.password}>{t.auth.password}</Label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                {t.auth.forgot}
              </Link>
            </div>
            <div className="mt-2">
              <PasswordInput
                id={ids.password}
                autoComplete="current-password"
                placeholder={t.auth.passwordPh}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? `${ids.password}-error` : undefined}
                {...register("password")}
              />
            </div>
            <FieldError id={`${ids.password}-error`} message={message(errors.password?.message)} />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? t.auth.loggingIn : t.auth.loginSubmit}
          </Button>
          <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <FlaskConical className="size-4 text-primary" aria-hidden="true" />
              {t.auth.demoTitle}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {demoAccounts.map((account) => {
                const who =
                  account.accountType === "developer" ? t.auth.demoDeveloper : t.auth.demoCompany;
                return (
                  <Button
                    key={account.id}
                    type="button"
                    variant="outline"
                    className="h-auto flex-col items-start gap-0.5 py-2 text-left"
                    aria-label={t.auth.demoFill(who)}
                    onClick={() => {
                      setError(null);
                      setValue("email", account.username, { shouldValidate: true });
                      setValue("password", demoPassword, { shouldValidate: true });
                    }}
                  >
                    <span className="text-xs text-muted-foreground">{who}</span>
                    <span className="font-mono text-sm">{account.username}</span>
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t.auth.demoHint(demoPassword)}</p>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
