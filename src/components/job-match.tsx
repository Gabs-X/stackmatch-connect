import { Check, Minus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { JobMatch } from "@/lib/job-match";
import { cn } from "@/lib/utils";

/**
 * Each criterion of the job and how much of it the profile meets, with the skills it has and
 * lacks. It compares requirements with what the profile says; it doesn't judge the developer.
 */
export function MatchBreakdown({ match, className }: { match: JobMatch; className?: string }) {
  const { t } = useI18n();
  const texts = t.jobs.match;
  return (
    <section aria-label={texts.title} className={cn("rounded-lg border bg-card p-5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-bold uppercase text-muted-foreground">{texts.title}</p>
        {match.score !== null && (
          <p className="font-display text-2xl font-extrabold text-primary">{match.score}%</p>
        )}
      </div>
      {match.criteria.length ? (
        <ul className="mt-4 space-y-3">
          {match.criteria.map((criterion) => {
            const Icon = criterion.met === 1 ? Check : criterion.met > 0 ? Minus : X;
            const skills = criterion.matched !== undefined && criterion.missing !== undefined;
            return (
              <li key={criterion.criterion} className="flex gap-2 text-sm">
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    criterion.met === 1
                      ? "text-positive"
                      : criterion.met > 0
                        ? "text-primary"
                        : "text-destructive",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p>
                    {texts.criteria[criterion.criterion]}
                    <span className="sr-only">
                      :{" "}
                      {criterion.met === 1
                        ? texts.met
                        : criterion.met > 0
                          ? texts.partly
                          : texts.notMet}
                    </span>
                    {skills && (
                      <span className="text-muted-foreground">
                        {" "}
                        ·{" "}
                        {texts.skillCount(
                          criterion.matched?.length ?? 0,
                          (criterion.matched?.length ?? 0) + (criterion.missing?.length ?? 0),
                        )}
                      </span>
                    )}
                  </p>
                  {skills && criterion.missing && criterion.missing.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {texts.missing}: {criterion.missing.join(", ")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{texts.nothing}</p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">{texts.note}</p>
    </section>
  );
}
