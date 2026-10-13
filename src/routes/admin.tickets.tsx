import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Mail, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/admin-gate";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { fetchAdminTickets, setTicketStatusFn } from "@/lib/admin-api";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { ticketFilters, type AdminTicket, type TicketFilter } from "@/lib/support";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/tickets")({
  head: () => ({
    meta: [{ title: "Tickets de suporte — Stack Match" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireAccount>
      <AdminGate>
        <TicketsAdmin />
      </AdminGate>
    </RequireAccount>
  ),
});

function TicketsAdmin() {
  const { t } = useI18n();
  useLocalizedMeta(t.admin.title + " — Stack Match", t.admin.sub);
  const [filter, setFilter] = useState<TicketFilter>("open");
  const list = useQuery({
    queryKey: ["admin-tickets", filter],
    queryFn: () => fetchAdminTickets({ data: filter }),
  });
  const counts = list.data?.counts;
  const countFor = (option: TicketFilter) =>
    counts ? (option === "all" ? counts.open + counts.closed : counts[option]) : undefined;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{t.admin.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{t.admin.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.admin.sub}</p>

      <div role="group" aria-label={t.admin.filtersLabel} className="mt-8 flex flex-wrap gap-2">
        {ticketFilters.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            className={cn("filter-chip", filter === option && "filter-chip-active")}
            onClick={() => setFilter(option)}
          >
            {t.admin.filters[option]}
            {countFor(option) !== undefined && (
              <span className="ml-1.5 text-xs opacity-70">{countFor(option)}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {list.isPending ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t.common.loading}
          </p>
        ) : list.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {t.admin.loadError}
          </p>
        ) : list.data.tickets.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t.admin.empty[filter]}
          </p>
        ) : (
          <ul className="space-y-4">
            {list.data.tickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard ticket={ticket} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function TicketCard({ ticket }: { ticket: AdminTicket }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const date = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
  const update = useMutation({
    mutationFn: (status: "open" | "closed") =>
      setTicketStatusFn({ data: { id: ticket.id, status } }),
    onSuccess: (notified, status) => {
      if (notified === "failed") toast.warning(t.admin.closedNotifyFailed(ticket.id));
      else if (notified === "sent") toast.success(t.admin.closedNotified(ticket.id, ticket.email));
      else
        toast.success(
          status === "closed" ? t.admin.closedToast(ticket.id) : t.admin.reopenedToast(ticket.id),
        );
      void queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: () => toast.error(t.admin.error),
  });
  const closed = ticket.status === "closed";
  const titleId = `ticket-${ticket.id}-title`;
  const replySubject = `Re: [Ticket #${ticket.id}] ${ticket.subject}`;

  return (
    <article aria-labelledby={titleId} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="font-mono text-sm text-muted-foreground">#{ticket.id}</span>
        <h2 id={titleId} className="min-w-0 flex-1 font-bold">
          {ticket.subject}
        </h2>
        <span
          className={cn(
            "level-badge px-2 py-0.5 text-[0.65rem]",
            closed && "bg-muted text-muted-foreground",
          )}
        >
          {t.support.status[ticket.status]}
        </span>
      </header>
      <p className="mt-1 text-xs text-muted-foreground">
        {t.support.categories[ticket.category]} ·{" "}
        {t.support.openedOn(date.format(new Date(ticket.createdAt)))}
      </p>
      <p className="mt-3 text-sm">
        <span className="font-semibold">{ticket.name}</span>{" "}
        <span className="text-muted-foreground">
          &lt;{ticket.email}&gt; ·{" "}
          {ticket.accountType ? t.admin.accountTypes[ticket.accountType] : t.admin.visitor}
        </span>
      </p>
      <p className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted px-4 py-3 text-sm leading-6">
        {ticket.message}
      </p>

      {ticket.conversation && ticket.conversation.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-primary">
            {t.admin.conversation(ticket.conversation.length)}
          </summary>
          <ol className="mt-3 space-y-2 border-l-2 pl-4">
            {ticket.conversation.map((message, index) => (
              <li key={index} className="whitespace-pre-wrap break-words leading-6">
                <span className="font-semibold">
                  {message.role === "user" ? t.admin.person : "Ada"}:
                </span>{" "}
                {message.content}
              </li>
            ))}
          </ol>
        </details>
      )}

      {closed && ticket.closedAt && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t.admin.closedBy(ticket.closedBy ?? "—", date.format(new Date(ticket.closedAt)))}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`mailto:${ticket.email}?subject=${encodeURIComponent(replySubject)}`}>
            <Mail />
            {t.admin.reply}
          </a>
        </Button>
        <Button
          size="sm"
          variant={closed ? "ghost" : "default"}
          disabled={update.isPending}
          onClick={() => update.mutate(closed ? "open" : "closed")}
        >
          {update.isPending ? (
            <Loader2 className="animate-spin" />
          ) : closed ? (
            <RotateCcw />
          ) : (
            <CheckCircle2 />
          )}
          {closed ? t.admin.reopen : t.admin.close}
        </Button>
      </div>
    </article>
  );
}
