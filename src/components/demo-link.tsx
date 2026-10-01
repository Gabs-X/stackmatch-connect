import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/**
 * Profile link. With `real`, it opens the address in a new tab. Otherwise it belongs to a
 * fictional profile: it looks like a link but explains the address in a toast instead of
 * navigating, since example URLs may belong to real people.
 */
export function DemoLink({
  url,
  label,
  icon: Icon,
  variant = "inline",
  real = false,
}: {
  url: string;
  label: string;
  icon: LucideIcon;
  variant?: "inline" | "block";
  real?: boolean;
}) {
  const { t } = useI18n();
  const shown = displayUrl(url);
  const announce = () =>
    toast(t.profile.demoLinkTitle, { description: t.profile.demoLinkDesc(shown) });
  const ariaLabel = real ? t.profile.openRealLink(label, shown) : t.profile.openLink(label, shown);

  if (variant === "block") {
    const content = (
      <>
        <Icon />
        <span className="flex min-w-0 flex-col items-start text-left">
          <span>{label}</span>
          <span className="w-full truncate text-xs font-normal text-muted-foreground">{shown}</span>
        </span>
        <ArrowUpRight className="ml-auto text-muted-foreground" />
      </>
    );
    return real ? (
      <Button asChild variant="outline" className="h-auto w-full justify-start py-2">
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
          {content}
        </a>
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        className="h-auto w-full justify-start py-2"
        aria-label={ariaLabel}
        onClick={announce}
      >
        {content}
      </Button>
    );
  }

  const inlineClass =
    "flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return real ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      title={shown}
      className={inlineClass}
    >
      <Icon className="size-4" />
      {label}
    </a>
  ) : (
    <button
      type="button"
      aria-label={ariaLabel}
      title={shown}
      onClick={announce}
      className={inlineClass}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
