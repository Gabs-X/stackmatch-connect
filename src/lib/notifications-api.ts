import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  listNotifications,
  loadPreferences,
  markNotificationsRead,
  savePreferences,
  unreadCount,
} from "@/server/outbox";
import { database, requireConfirmedAccount } from "@/server/session";
import { preferencesSchema } from "./notifications";

/**
 * The account's notification center and preferences (see src/server/outbox.ts). Each call names
 * the account the screen shows; the server refuses it when the session is now another's.
 */
const accountId = z.string().min(1).max(200);
const notificationId = z.string().min(1).max(200);

export const fetchNotifications = createServerFn({ method: "GET" })
  .validator(z.object({ accountId, after: notificationId.optional() }))
  .handler(async ({ data }) =>
    listNotifications(
      await database(),
      (await requireConfirmedAccount(data.accountId)).id,
      data.after,
    ),
  );

export const fetchUnreadCount = createServerFn({ method: "GET" })
  .validator(z.object({ accountId }))
  .handler(async ({ data }) =>
    unreadCount(await database(), (await requireConfirmedAccount(data.accountId)).id),
  );

/** Marks these notifications of the account as read, or all of them; others' are left alone. */
export const markNotificationsReadFn = createServerFn({ method: "POST" })
  .validator(
    z.object({ accountId, ids: z.union([z.array(notificationId).max(100), z.literal("all")]) }),
  )
  .handler(async ({ data }) => {
    const user = await requireConfirmedAccount(data.accountId);
    await markNotificationsRead(await database(), user.id, data.ids);
    return { ok: true as const };
  });

export const fetchPreferences = createServerFn({ method: "GET" })
  .validator(z.object({ accountId }))
  .handler(async ({ data }) =>
    loadPreferences(await database(), (await requireConfirmedAccount(data.accountId)).id),
  );

/** Changes the language, the e-mails turned off, or both. */
export const savePreferencesFn = createServerFn({ method: "POST" })
  .validator(preferencesSchema.partial().extend({ accountId }))
  .handler(async ({ data: { accountId: id, ...preferences } }) =>
    savePreferences(await database(), (await requireConfirmedAccount(id)).id, preferences),
  );

export const notificationsKey = (accountId: string) => ["notifications", accountId] as const;

export const notificationsQuery = (accountId: string) =>
  infiniteQueryOptions({
    queryKey: [...notificationsKey(accountId), "list"],
    queryFn: ({ pageParam }) =>
      fetchNotifications({ data: { accountId, ...(pageParam ? { after: pageParam } : {}) } }),
    initialPageParam: "",
    getNextPageParam: (page) => page.next ?? undefined,
  });

/** Checked every minute, and when the window gets focus again. */
export const unreadCountQuery = (accountId: string) =>
  queryOptions({
    queryKey: [...notificationsKey(accountId), "unread"],
    queryFn: () => fetchUnreadCount({ data: { accountId } }),
    refetchInterval: 60_000,
  });

export const preferencesQuery = (accountId: string) =>
  queryOptions({
    queryKey: ["preferences", accountId],
    queryFn: () => fetchPreferences({ data: { accountId } }),
  });
