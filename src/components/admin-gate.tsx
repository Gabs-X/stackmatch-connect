import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { fetchIsAdmin } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";

/** The server decides who is an admin (ADMIN_EMAILS); this only picks what to show. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const access = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => fetchIsAdmin(),
  });
  if (access.isPending)
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center px-4">
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t.access.checking}
        </p>
      </main>
    );
  if (!access.data)
    return (
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl place-items-center px-4 py-10">
        <div className="max-w-md rounded-xl border border-dashed bg-card p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
            <ShieldAlert aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-bold">{t.admin.deniedTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.admin.deniedSub}</p>
        </div>
      </main>
    );
  return children;
}
