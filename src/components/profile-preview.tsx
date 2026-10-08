import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useId, type ReactNode } from "react";
import { DeveloperCard } from "@/components/developer-card";
import { DeveloperProfileView } from "@/components/developer-profile";
import { useI18n } from "@/lib/i18n";
import { localProfileToDeveloper, type LocalProfile } from "@/lib/local-profile";
import { myTranslationsQuery } from "@/lib/profile-api";
import type { Translations } from "@/lib/translations";

/**
 * Switching views: the current one fades out quickly, then the new one fades in rising a little.
 * Both layouts differ too much for a morph between them to read well.
 */
const swap = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: "easeIn" as const } },
};

/**
 * The developer's profile as companies will see it: the full profile, laid out like
 * /developer/$id, or the Discover card.
 */
export function ProfilePreview({
  profile,
  accountId,
  showCard,
  back,
  actions,
  status,
}: {
  profile: LocalProfile;
  /** Owner of the profile; the card is identified by it, as in Discover. */
  accountId: string;
  showCard: boolean;
  /** Back to the form. */
  back: ReactNode;
  /** Switch views and the like, beside the name (or above the card). */
  actions: ReactNode;
  /** Shown under the way back, e.g. that the profile was saved. */
  status?: ReactNode;
}) {
  const { t } = useI18n();
  // Translations made when the profile was last saved: texts typed since then show as written.
  const { data: saved = {} } = useQuery(myTranslationsQuery(accountId));
  const texts = [
    profile.role,
    profile.bio,
    ...profile.projects.map((project) => project.description),
  ];
  const translations: Translations = Object.fromEntries(
    texts.flatMap((text) => {
      const entry = saved[text.trim()];
      return entry
        ? [
            [text, entry],
            [text.trim(), entry],
          ]
        : [];
    }),
  );
  // Only worth saying once translation is working for this profile.
  const pending =
    Object.keys(saved).length > 0 && texts.some((text) => text.trim() && !saved[text.trim()]);
  const developer = {
    ...localProfileToDeveloper(profile, accountId),
    name: profile.name.trim() || t.create.yourName,
    role: profile.role.trim() || t.create.yourRole,
    bio: profile.bio.trim() || t.create.yourBio,
    translations,
  };

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {showCard ? (
          <motion.div key="card" {...swap}>
            <div className="border-b bg-card">
              <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {back}
                  <div className="flex flex-wrap gap-2">{actions}</div>
                </div>
                {status}
              </div>
            </div>
            <CardView developer={developer} />
          </motion.div>
        ) : (
          <motion.div key="full" {...swap}>
            <DeveloperProfileView
              developer={developer}
              noProjects={t.create.addProjectsHint}
              top={
                <>
                  {back}
                  {status}
                </>
              }
              actions={actions}
              note={
                pending && (
                  <p className="mt-1 text-xs text-muted-foreground">{t.translation.pending}</p>
                )
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

type PreviewDeveloper = ReturnType<typeof localProfileToDeveloper> & { translations: Translations };

function CardView({ developer }: { developer: PreviewDeveloper }) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6 lg:px-8"
    >
      <h2 id={titleId} className="text-xl font-bold">
        {t.create.cardPreviewTitle}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {t.create.cardPreviewSub}
      </p>
      {/* The same card companies swipe through in Discover. */}
      <div className="mx-auto mt-7 max-w-sm text-left">
        <DeveloperCard developer={developer} />
      </div>
    </section>
  );
}
