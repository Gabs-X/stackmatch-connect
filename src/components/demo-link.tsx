import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "");

/**
 * Link for fictional profiles: looks and behaves like an external link, but explains the address
 * in a toast instead of navigating, since these example URLs may belong to real people.
 * Swap for a plain <a target="_blank" rel="noopener noreferrer"> once profiles hold real data.
 */
export function DemoLink({
  url,
  label,
  icon: Icon,
  variant = "inline",
}: {
  url: string;
  label: string;
  icon: LucideIcon;
  variant?: "inline" | "block";
}) {
  const { t } = useI18n();
  const shown = displayUrl(url);
  const announce = () =>
    toast(t.profile.demoLinkTitle, { description: t.profile.demoLinkDesc(shown) });

  if (variant === "block")
    return (
      <Button
        type="button"
        variant="outline"
        className="h-auto w-full justify-start py-2"
        aria-label={t.profile.openLink(label, shown)}
        onClick={announce}
      >
        <Icon />
        <span className="flex min-w-0 flex-col items-start text-left">
          <span>{label}</span>
          <span className="w-full truncate text-xs font-normal text-muted-foreground">{shown}</span>
        </span>
        <ArrowUpRight className="ml-auto text-muted-foreground" />
      </Button>
    );

  return (
    <button
      type="button"
      aria-label={t.profile.openLink(label, shown)}
      title={shown}
      onClick={announce}
      className="flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
