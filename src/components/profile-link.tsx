import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** A link someone added to their profile or company details, opened in a new tab. */
export function ProfileLink({
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
  const ariaLabel = t.profile.openRealLink(label, shown);

  if (variant === "block")
    return (
      <Button asChild variant="outline" className="h-auto w-full justify-start py-2">
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
          <Icon />
          <span className="flex min-w-0 flex-col items-start text-left">
            <span>{label}</span>
            <span className="w-full truncate text-xs font-normal text-muted-foreground">
              {shown}
            </span>
          </span>
          <ArrowUpRight className="ml-auto text-muted-foreground" />
        </a>
      </Button>
    );

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      title={shown}
      className="flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-4" />
      {label}
    </a>
  );
}
