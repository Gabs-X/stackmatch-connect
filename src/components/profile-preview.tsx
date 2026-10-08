import { LayoutGroup, motion, MotionConfig, type Transition } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useId, type ReactNode } from "react";
import { DeveloperCard } from "@/components/developer-card";
import { DeveloperProfileView } from "@/components/developer-profile";
import { useI18n } from "@/lib/i18n";
import { localProfileToDeveloper, type LocalProfile } from "@/lib/local-profile";
import { myTranslationsQuery } from "@/lib/profile-api";
import type { Translations } from "@/lib/translations";

/** Photo shared by the full profile and the Discover card, so one morphs into the other. */
const layoutId = "own-profile";
// No bounce: a long, decelerating curve reads as one smooth resize instead of a springy jump.
const morph: Transition = { duration: 0.6, ease: [0.32, 0.72, 0, 1] };
/** Content that only exists in one view fades in as the frame settles. */
const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: 0.3 + delay, ease: [0.16, 1, 0.3, 1] as const },
});

/**
 * The developer's profile as companies will see it: the full profile, laid out like
 * /developer/$id, or the Discover card. Switching views morphs the photo between both, then fades
 * in the content of the new view.
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
    <MotionConfig reducedMotion="user" transition={morph}>
      <LayoutGroup id="profile-preview">
        {showCard ? (
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {back}
              <div className="flex flex-wrap gap-2">{actions}</div>
            </div>
            {status}
            <CardView developer={developer} />
          </div>
        ) : (
          <DeveloperProfileView
            developer={developer}
            photoLayoutId={`${layoutId}-photo`}
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
        )}
      </LayoutGroup>
    </MotionConfig>
  );
}

type PreviewDeveloper = ReturnType<typeof localProfileToDeveloper> & { translations: Translations };

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
