import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { CheckCheck, RotateCcw, Settings } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { RequireAccount } from "@/components/require-account";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import type { AppNotification } from "@/lib/notifications";
import {
  markNotificationsReadFn,
  notificationsKey,
  notificationsQuery,
  unreadCountQuery,
} from "@/lib/notifications-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Stack Match" },
      { name: "description", content: "Suas notificações no StackMatch." },
      { property: "og:title", content: "Notificações — Stack Match" },
    ],
  }),
  component: () => (
    <RequireAccount>
      <NotificationsPage />
    </RequireAccount>
  ),
});

function NotificationsPage() {
  const { t } = useI18n();
  useLocalizedMeta(t.notifications.title + " — Stack Match", t.notifications.sub);
  const { user } = useAuth();
  // RequireAccount only renders this page for a signed-in, confirmed account.
  return user ? <NotificationList accountId={user.id} /> : null;
}

function NotificationList({ accountId }: { accountId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const list = useInfiniteQuery(notificationsQuery(accountId));
  const { data: unread = 0 } = useQuery(unreadCountQuery(accountId));
  const [marking, setMarking] = useState(false);
  // A notification created between two pages could come twice; it shows once.
  const seen = new Set<string>();
  const notifications = (list.data?.pages ?? [])
    .flatMap((page) => page.notifications)
    .filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)));

  const markRead = async (ids: string[] | "all") => {
    await markNotificationsReadFn({ data: { accountId, ids } });
    await queryClient.invalidateQueries({ queryKey: notificationsKey(accountId) });
  };
  const markAll = async () => {
    setMarking(true);
    try {
      await markRead("all");
    } catch {
      toast.error(t.notifications.markError);
    } finally {
      setMarking(false);
    }
  };
  /** Opens the page it's about; marking it read doesn't hold the way there. */
  const open = (item: AppNotification) => {
    if (!item.readAt) void markRead([item.id]).catch(() => undefined);
    void router.navigate({ href: item.data.path });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-20">
      <section className="stagger-item border-b bg-card">
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-4 px-4 py-10 sm:px-6 lg:px-8">
          <div>
            <span className="section-kicker">{t.notifications.kicker}</span>
            <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
              {t.notifications.title}
            </h1>
            <p className="mt-2 text-muted-foreground">{t.notifications.sub}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost">
              <Link to="/account" hash="preferences">
                <Settings />
                {t.notifications.preferences}
              </Link>
            </Button>
            <Button variant="outline" disabled={!unread || marking} onClick={() => void markAll()}>
              <CheckCheck />
              {t.notifications.markAll}
            </Button>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 lg:px-8">
        {list.isPending ? (
          <div aria-busy="true" className="space-y-3">
            <span role="status" className="sr-only">
              {t.common.loading}
            </span>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : list.isError && !notifications.length ? (
          <div role="alert" className="text-center">
            <p className="text-sm text-muted-foreground">{t.notifications.loadError}</p>
            <Button className="mt-4" onClick={() => void list.refetch()}>
              <RotateCcw />
              {t.common.retry}
            </Button>
          </div>
        ) : notifications.length ? (
          <>
            <ul className="space-y-3">
              {notifications.map((item, index) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  index={index}
                  onOpen={() => open(item)}
                />
              ))}
            </ul>
            {list.isFetchNextPageError && (
              <p role="alert" className="mt-6 text-center text-sm text-muted-foreground">
                {t.notifications.loadError}
              </p>
            )}
            {list.hasNextPage && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  disabled={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                >
                  {list.isFetchingNextPage ? t.common.loading : t.notifications.loadMore}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-card p-8 text-center">
            <div>
              <h2 className="text-lg font-bold">{t.notifications.empty}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.notifications.emptySub}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/** What the notification says, in the screen's language. */
function useDescribe() {
  const { t, lang } = useI18n();
  const locale = lang === "pt" ? ptBR : enUS;
  return ({ kind, data }: AppNotification) => {
    const text = t.notifications.text;
    // Noon keeps the day the same in any time zone.
    const when =
      data.date && data.time
        ? t.notifications.callAt(
            format(new Date(`${data.date}T12:00:00`), t.schedule.dateFormat, { locale }),
            data.time,
          )
        : "";
    const line =
      kind === "application_update"
        ? t.notifications.updates[data.update ?? "closed"](data.actor)
        : kind === "interest" || kind === "application_received" || kind === "application_withdrawn"
          ? text[kind](data.actor)
          : text[kind](data.actor, when);
    return data.job ? line + t.notifications.about(data.job) : line;
  };
}

function NotificationItem({
  item,
  index,
  onOpen,
}: {
  item: AppNotification;
  index: number;
  onOpen: () => void;
}) {
  const { t, lang } = useI18n();
  const describe = useDescribe();
  const unread = !item.readAt;
  return (
    <li
      className="stagger-item"
      style={{ "--stagger-index": Math.min(index, 10) } as CSSProperties}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          unread && "border-primary/40",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            unread ? "bg-primary" : "bg-transparent",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", unread && "font-semibold")}>{describe(item)}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {format(new Date(item.createdAt), t.notifications.dateFormat, {
              locale: lang === "pt" ? ptBR : enUS,
            })}
            {unread && <span className="sr-only"> · {t.notifications.unread}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}
