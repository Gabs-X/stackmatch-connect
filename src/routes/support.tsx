import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, Inbox, LifeBuoy, Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { FieldError, FormAlert } from "@/components/auth-layout";
import { SettingsSection } from "@/components/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import {
  ticketCategories,
  ticketSchema,
  type TicketInput,
  type TicketSummary,
} from "@/lib/support";
import { createTicketFn, fetchMyTickets } from "@/lib/support-api";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Suporte — Stack Match" },
      { name: "description", content: "Abra um ticket para falar com a equipe do StackMatch." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.support.title + " — Stack Match", t.support.sub);
  const { user, ready } = useAuth();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{t.support.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{t.support.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.support.sub}</p>
      <div className="mt-8 space-y-6">
        {/* Wait for the session so the form knows whether to ask for name and e-mail. */}
        {ready && <TicketForm key={user?.id ?? "visitor"} />}
        {user && <MyTickets userId={user.id} />}
      </div>
    </main>
  );
}

function TicketForm() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ids = {
    category: useId(),
    subject: useId(),
    message: useId(),
    name: useId(),
    email: useId(),
    attach: useId(),
  };
  const [sent, setSent] = useState<TicketSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const message = (code?: string) =>
    code ? (t.support.errors[code] ?? t.support.errors["unknown"]) : undefined;

  const form = useForm<TicketInput>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      category: "question",
      subject: "",
      message: "",
      // A signed-in account answers at its own address; the server uses it whatever is sent.
      name: user?.name ?? "",
      email: user?.email ?? "",
      attachConversation: true,
      language: lang,
    },
  });
  const { errors, isSubmitting } = form.formState;
  useEffect(() => form.setValue("language", lang), [form, lang]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await createTicketFn({ data: values });
      if ("error" in result) {
        setError(t.support.limited(Math.max(1, Math.ceil(result.retryInSeconds / 60))));
        return;
      }
      setSent(result.ticket);
      form.reset({ ...form.getValues(), subject: "", message: "" });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch {
      setError(t.support.errors["unknown"] ?? null);
    }
  });

  if (sent)
    return (
      <SettingsSection
        icon={<CheckCircle2 className="size-4" />}
        title={t.support.sentTitle(sent.id)}
        note={user?.emailVerified ? t.support.sentBody : t.support.sentBodyVisitor}
      >
        <div role="status" className="sr-only">
          {t.support.sentTitle(sent.id)}
        </div>
        <Button variant="outline" onClick={() => setSent(null)}>
          {t.support.another}
        </Button>
      </SettingsSection>
    );

  const field = (id: string, key: keyof typeof errors) => ({
    id,
    "aria-invalid": Boolean(errors[key]) || undefined,
    "aria-describedby": errors[key] ? `${id}-error` : undefined,
  });

  return (
    <SettingsSection
      icon={<LifeBuoy className="size-4" />}
      title={t.support.formTitle}
      note={t.support.formNote}
    >
      {error && <FormAlert>{error}</FormAlert>}
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <div>
          <Label htmlFor={ids.category}>{t.support.category}</Label>
          <div className="relative mt-2">
            <select
              {...field(ids.category, "category")}
              className="h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-transparent pl-3 pr-9 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
              {...form.register("category")}
            >
              {ticketCategories.map((category) => (
                <option key={category} value={category}>
                  {t.support.categories[category]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </div>

        {user ? (
          <p className="text-sm text-muted-foreground">{t.support.signedInAs(user.email)}</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor={ids.name}>{t.support.name}</Label>
              <Input
                {...field(ids.name, "name")}
                className="mt-2"
                autoComplete="name"
                {...form.register("name")}
              />
              <FieldError id={`${ids.name}-error`} message={message(errors.name?.message)} />
            </div>
            <div>
              <Label htmlFor={ids.email}>{t.support.email}</Label>
              <Input
                {...field(ids.email, "email")}
                className="mt-2"
                type="email"
                autoComplete="email"
                {...form.register("email")}
              />
              <FieldError id={`${ids.email}-error`} message={message(errors.email?.message)} />
            </div>
          </div>
        )}

        <div>
          <Label htmlFor={ids.subject}>{t.support.subject}</Label>
          <Input
            {...field(ids.subject, "subject")}
            className="mt-2"
            maxLength={120}
            placeholder={t.support.subjectPh}
            {...form.register("subject")}
          />
          <FieldError id={`${ids.subject}-error`} message={message(errors.subject?.message)} />
        </div>

        <div>
          <Label htmlFor={ids.message}>{t.support.message}</Label>
          <Textarea
            {...field(ids.message, "message")}
            className="mt-2 min-h-36"
            maxLength={4000}
            placeholder={t.support.messagePh}
            {...form.register("message")}
          />
          <FieldError id={`${ids.message}-error`} message={message(errors.message?.message)} />
        </div>

        {user && (
          <label htmlFor={ids.attach} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              id={ids.attach}
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
              {...form.register("attachConversation")}
            />
            <span>
              {t.support.attach}
              <span className="block text-xs text-muted-foreground">{t.support.attachHint}</span>
            </span>
          </label>
        )}

        <p className="text-xs text-muted-foreground">
          {t.support.privacy}{" "}
          <Link to="/terms" hash="privacy" className="font-semibold text-primary hover:underline">
            {t.support.privacyLink}
          </Link>
          .
        </p>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? t.support.sending : t.support.submit}
        </Button>
      </form>
    </SettingsSection>
  );
}

function MyTickets({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const tickets = useQuery({ queryKey: ["tickets", userId], queryFn: () => fetchMyTickets() });
  const date = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
  return (
    <SettingsSection icon={<Inbox className="size-4" />} title={t.support.myTickets}>
      {tickets.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : !tickets.data?.length ? (
        <p className="text-sm text-muted-foreground">{t.support.noTickets}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {tickets.data.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <span className="font-mono text-xs text-muted-foreground">#{ticket.id}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{ticket.subject}</span>
              <span className="level-badge px-2 py-0.5 text-[0.65rem]">
                {t.support.status[ticket.status]}
              </span>
              <span className="w-full text-xs text-muted-foreground">
                {t.support.categories[ticket.category]} ·{" "}
                {t.support.openedOn(date.format(new Date(ticket.createdAt)))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}
