import { useI18n } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, Briefcase, Clock3, MapPin } from "lucide-react";
import type { Developer } from "@/lib/developers";
import { DeveloperPhoto } from "@/components/developer-photo";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function DeveloperCard({
  developer,
  compact = false,
  showProfile = compact,
  layoutId,
}: {
  developer: Developer;
  compact?: boolean;
  showProfile?: boolean;
  /**
   * Shares the frame and photo with another element using the same id (`<id>`, `<id>-photo`),
   * so switching between them morphs one into the other; the text fades in once it settles.
   */
  layoutId?: string;
}) {
  const { t, tv, formatCurrency } = useI18n();
  const { user } = useAuth();
  // The profile saved in this browser belongs to its developer account, not to a company using
  // the same browser: for companies it is just another candidate.
  const own = developer.isLocal && user?.accountType === "developer";
  // Spread, not passed as undefined: motion props reject an explicit undefined layoutId.
  const shared = (part?: string) =>
    layoutId ? { layoutId: part ? `${layoutId}-${part}` : layoutId } : {};

  return (
    <motion.article
      {...shared()}
      // Set inline so the corner radius stays round while the shared layout animation scales it.
      {...(layoutId ? { style: { borderRadius: 12.8 } } : {})}
      className={compact ? "talent-card" : "developer-card"}
    >
      <motion.div
        {...shared("photo")}
        className={
          compact
            ? "relative h-52 overflow-hidden bg-muted"
            : showProfile
              ? "relative h-44 overflow-hidden bg-muted sm:h-72"
              : "relative h-64 overflow-hidden bg-muted sm:h-72"
        }
      >
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
      </motion.div>
      <motion.div
        {...(layoutId
          ? {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.3, delay: 0.25 },
            }
          : {})}
        className={compact ? "p-5" : showProfile ? "p-4 sm:p-6" : "p-6"}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 break-words">
            <h2 className={compact ? "text-lg font-bold" : "text-2xl font-bold"}>
              {developer.name}
            </h2>
            <p className="mt-0.5 text-sm font-medium text-primary">{developer.role}</p>
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
        {compact && Number.isFinite(developer.rate) && (
          <p className="mt-3 text-sm font-semibold">
            <span className="text-xs font-normal text-muted-foreground">{t.profile.rate}: </span>
            {formatCurrency(developer.rate)}
            <span className="text-xs font-normal text-muted-foreground">/h</span>
          </p>
        )}
        {!compact && developer.bio && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {tv(developer.bio)}
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
                onPointerDown={(event) => event.stopPropagation()}
              >
                {t.card.viewProfile} <ArrowUpRight />
              </Link>
            )}
          </Button>
        )}
      </motion.div>
    </motion.article>
  );
}
