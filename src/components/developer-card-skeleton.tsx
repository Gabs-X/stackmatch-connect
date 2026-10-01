import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors DeveloperCard's box sizes so content swaps in without layout shift. */
export function DeveloperCardSkeleton({
  compact = false,
  showProfile = compact,
}: {
  compact?: boolean;
  showProfile?: boolean;
}) {
  return (
    <div className={compact ? "talent-card" : "developer-card"} aria-hidden="true">
      <Skeleton
        className={
          compact
            ? "h-52 rounded-none"
            : showProfile
              ? "h-44 rounded-none sm:h-72"
              : "h-64 rounded-none sm:h-72"
        }
      />
      <div className={compact ? "p-5" : showProfile ? "p-4 sm:p-6" : "p-6"}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className={compact ? "h-6 w-2/3" : "h-7 w-3/5"} />
            <Skeleton className="h-4 w-2/5" />
          </div>
          {!compact && <Skeleton className="h-6 w-16 rounded-full" />}
        </div>
        {compact && (
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-14" />
          </div>
        )}
        <div className="mt-4 flex gap-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-16" />
          {!compact && <Skeleton className="h-3.5 w-14" />}
        </div>
        {compact && <Skeleton className="mt-3 h-5 w-36" />}
        {!compact && (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          {Array.from({ length: compact ? 3 : 5 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-14" />
          ))}
        </div>
        {showProfile && <Skeleton className={compact ? "mt-5 h-9 w-full" : "mt-5 h-11 w-full"} />}
      </div>
    </div>
  );
}
