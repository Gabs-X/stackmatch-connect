import { LayoutGroup, motion, MotionConfig, type Transition } from "framer-motion";
import {
  Briefcase,
  Clock3,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  MapPin,
  Wallet,
} from "lucide-react";
import { useId } from "react";
import { DeveloperCard } from "@/components/developer-card";
import { DeveloperPhoto } from "@/components/developer-photo";
import { ProjectCover } from "@/components/project-cover";
import { useI18n } from "@/lib/i18n";
import { localProfileToDeveloper, profileLink, type LocalProfile } from "@/lib/local-profile";

/** Frame and photo shared by the full profile and the Discover card, so one morphs into the other. */
const layoutId = "own-profile";
const morph: Transition = { type: "spring", stiffness: 210, damping: 28, mass: 0.9 };
/** Content that only exists in one view arrives after the frame has mostly settled. */
const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] as const },
});

/**
 * The developer's profile as companies will see it: the full profile as a large card, or the
 * Discover card. Switching views morphs the frame and photo between both sizes, then fades in the
 * content of the new view.
 */
export function ProfilePreview({
  profile,
  accountId,
  showCard,
}: {
  profile: LocalProfile;
  /** Owner of the profile; the card is identified by it, as in Discover. */
  accountId: string;
  showCard: boolean;
}) {
  const { t } = useI18n();
  const developer = {
    ...localProfileToDeveloper(profile, accountId),
    name: profile.name.trim() || t.create.yourName,
    role: profile.role.trim() || t.create.yourRole,
  };

  return (
    <MotionConfig reducedMotion="user" transition={morph}>
      <LayoutGroup id="profile-preview">
        {showCard ? (
          <CardView developer={developer} />
        ) : (
          <FullProfile profile={profile} developer={developer} />
        )}
      </LayoutGroup>
    </MotionConfig>
  );
}

type PreviewDeveloper = ReturnType<typeof localProfileToDeveloper>;

function CardView({ developer }: { developer: PreviewDeveloper }) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="mt-10 text-center">
      <motion.div {...reveal(0.15)}>
        <h2 id={titleId} className="text-xl font-bold">
          {t.create.cardPreviewTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t.create.cardPreviewSub}
        </p>
      </motion.div>
      {/* The same card companies swipe through in Discover. */}
      <div className="mx-auto mt-7 max-w-sm text-left">
        <DeveloperCard developer={developer} layoutId={layoutId} />
      </div>
    </section>
  );
}

function FullProfile({
  profile,
  developer,
}: {
  profile: LocalProfile;
  developer: PreviewDeveloper;
}) {
  const { t, tv, formatCurrency } = useI18n();
  const hasRate = Number.isFinite(developer.rate);
  const links = [
    { label: "GitHub", value: profile.github, icon: Github },
    { label: "LinkedIn", value: profile.linkedin, icon: Linkedin },
    { label: t.create.site, value: profile.website, icon: Globe },
  ].filter((link) => link.value.trim());

  return (
    <motion.article
      layoutId={layoutId}
      style={{ borderRadius: 20 }}
      className="mt-7 overflow-hidden border bg-card shadow-card"
    >
      <div className="grid md:grid-cols-[minmax(0,19rem)_1fr]">
        <motion.div
          layoutId={`${layoutId}-photo`}
          className="relative h-72 overflow-hidden bg-muted sm:h-80 md:h-auto md:min-h-[26rem]"
        >
          <DeveloperPhoto
            name={developer.name}
            image={developer.image}
            alt={`${t.card.photoOf} ${developer.name}`}
            className="absolute inset-0 h-full w-full"
          />
          {developer.availability && (
            <span className="availability-badge">
              <span className="status-dot" />
              {tv(developer.availability)}
            </span>
          )}
          <span className="own-profile-badge">{t.card.yourProfile}</span>
        </motion.div>

        <div className="min-w-0 p-6 sm:p-8 lg:p-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 break-words">
              <motion.h1
                {...reveal(0.05)}
                className="font-display text-3xl font-extrabold sm:text-4xl"
              >
                {developer.name}
              </motion.h1>
              <motion.p {...reveal(0.1)} className="mt-1.5 font-semibold text-primary">
                {developer.role}
              </motion.p>
            </div>
            {developer.seniority && (
              <motion.span {...reveal(0.1)} className="level-badge shrink-0">
                {tv(developer.seniority)}
              </motion.span>
            )}
          </div>

          <motion.div {...reveal(0.18)}>
            {(developer.location || developer.workMode || developer.experience || hasRate) && (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                {developer.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {developer.location}
                  </span>
                )}
                {developer.workMode && (
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="size-4" />
                    {tv(developer.workMode)}
                  </span>
                )}
                {developer.experience && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-4" />
                    {tv(developer.experience)}
                  </span>
                )}
                {hasRate && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                    <Wallet className="size-4" />
                    {formatCurrency(developer.rate)}/h
                  </span>
                )}
              </div>
            )}
            <p className="mt-6 max-w-2xl whitespace-pre-wrap leading-7 text-muted-foreground">
              {profile.bio.trim() || t.create.yourBio}
            </p>
          </motion.div>

          <motion.div {...reveal(0.26)} className="mt-8 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="section-kicker">{t.create.steps[1]}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {developer.skills.map((skill) => (
                  <span className="skill-chip" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </section>
            {links.length > 0 && (
              <section>
                <h2 className="section-kicker">{t.create.steps[3]}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {links.map(({ label, value, icon: Icon }) => {
                    const href = profileLink(value);
                    const content = (
                      <>
                        <Icon className="size-4" />
                        {label}
                      </>
                    );
                    const className =
                      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors";
                    return href ? (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={value}
                        className={`${className} hover:border-primary hover:text-primary`}
                      >
                        {content}
                      </a>
                    ) : (
                      <span key={label} title={value} className={className}>
                        {content}
                      </span>
                    );
                  })}
                </div>
              </section>
            )}
          </motion.div>
        </div>
      </div>

      <motion.section {...reveal(0.34)} className="border-t bg-muted/30 p-6 sm:p-8 lg:p-10">
        <h2 className="text-xl font-bold">{t.create.projects}</h2>
        {profile.projects.length ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {profile.projects.map((project) => {
              const repo = profileLink(project.github);
              const demo = profileLink(project.demo);
              return (
                <article
                  className="overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-card"
                  key={project.id}
                >
                  <ProjectCover
                    name={project.name}
                    image={project.image}
                    className="aspect-[16/10]"
                  />
                  <div className="p-5">
                    <h3 className="font-bold">{project.name}</h3>
                    {project.description && (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                    {project.tech.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {project.tech.map((tech) => (
                          <span className="skill-chip" key={tech}>
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                    {(repo || demo) && (
                      <div className="mt-5 flex gap-4 text-xs font-bold">
                        {repo && (
                          <a
                            href={repo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary"
                          >
                            <Github className="size-4" />
                            GitHub
                          </a>
                        )}
                        {demo && (
                          <a
                            href={demo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary"
                          >
                            <ExternalLink className="size-4" />
                            Demo
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t.create.addProjectsHint}</p>
        )}
      </motion.section>
    </motion.article>
  );
}
