import { useId, type ReactNode } from "react";

/** A titled card grouping related fields on a settings page. */
export function SettingsSection({
  icon,
  title,
  note,
  children,
}: {
  icon: ReactNode;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
      <h2 id={id} className="flex items-center gap-2 font-bold">
        <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        {title}
      </h2>
      {note && <p className="mt-1.5 text-sm text-muted-foreground">{note}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}
