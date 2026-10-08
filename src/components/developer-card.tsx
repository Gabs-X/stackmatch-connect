import { useI18n } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Briefcase, Clock3, MapPin } from "lucide-react";
import type { Developer } from "@/lib/developers";
import { DeveloperPhoto } from "@/components/developer-photo";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function DeveloperCard({
  developer,
  compact = false,
  showProfile = compact,
  jobId,
  match,
}: {
  developer: Developer;
  compact?: boolean;
  showProfile?: boolean;
  /** The job the company is looking at it for; the profile page then acts inside it. */
  jobId?: string | undefined;
  /** How much of that job the profile meets, 0 to 100 (see src/lib/job-match.ts). */
  match?: number | null | undefined;
}) {
  const { t, tv } = useI18n();
  const { user } = useAuth();
  // Profiles created in the app are identified by their owner's account id.
  const own = developer.id === user?.id;

  return (
    <article className={compact ? "talent-card" : "developer-card"}>
      <div
        className={
          compact
            ? "relative h-52 overflow-hidden bg-muted"
            : showProfile
              ? "relative h-44 overflow-hidden bg-muted sm:h-72"
              : "relative h-64 overflow-hidden bg-muted sm:h-72"
        }
      >
        <div className="absolute inset-0">
          <DeveloperPhoto
            name={developer.name}
            image={developer.image}
            alt={`${t.card.photoOf} ${developer.name}`}
            className="h-full w-full"
            lazy
          />
          {developer.availability && (
            <span className="availability-badge">
              <span className="status-dot" />
              {tv(developer.availability)}
            </span>
          )}
          {own && <span className="own-profile-badge">{t.card.yourProfile}</span>}
          {match !== undefined && match !== null && (
            <span className="match-badge">{t.jobs.match.score(match)}</span>
          )}
        </div>
      </div>
      <div className={compact ? "p-5" : showProfile ? "p-4 sm:p-6" : "p-6"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 break-words">
            <h2 className={compact ? "text-lg font-bold" : "text-2xl font-bold"}>
              {developer.name}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-primary">
              {tv(developer.role, developer.translations)}
            </p>
          </div>
          {!compact && developer.seniority && (
            <span className="level-badge shrink-0">{tv(developer.seniority)}</span>
          )}
        </div>
        {compact && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {developer.seniority && <span className="level-badge">{tv(developer.seniority)}</span>}
            {developer.experience && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                {tv(developer.experience)}
              </span>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {developer.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {developer.location}
            </span>
          )}
          {developer.workMode && (
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="size-3.5" />
              {tv(developer.workMode)}
            </span>
          )}
          {!compact && developer.experience && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {tv(developer.experience)}
            </span>
          )}
        </div>
        {!compact && developer.bio && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {tv(developer.bio, developer.translations)}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {developer.skills.slice(0, compact ? 3 : 5).map((skill) => (
            <span className="skill-chip" key={skill}>
              {skill}
            </span>
          ))}
        </div>
        {showProfile && (
          <Button
            asChild
            variant="outline"
            className={compact ? "mt-5 w-full" : "mt-5 min-h-11 w-full"}
          >
            {own ? (
              <Link to="/create-profile" onPointerDown={(event) => event.stopPropagation()}>
                {t.card.viewProfile} <ArrowUpRight />
              </Link>
            ) : (
              <Link
                to="/developer/$id"
                params={{ id: developer.id }}
                search={jobId ? { job: jobId } : {}}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {t.card.viewProfile} <ArrowUpRight />
              </Link>
            )}
          </Button>
        )}
      </div>
    </article>
  );
}
