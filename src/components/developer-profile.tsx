import { motion } from "framer-motion";
import { Check, ExternalLink, Github, Linkedin, MapPin } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { DeveloperPhoto } from "@/components/developer-photo";
import { ProfileLink } from "@/components/profile-link";
import { TranslationNote } from "@/components/translation-note";
import { Button } from "@/components/ui/button";
import type { Developer } from "@/lib/developers";
import { useI18n } from "@/lib/i18n";
import { isTranslated } from "@/lib/translations";

/**
 * A developer's full profile: the header with photo, name and role, then about, skills,
 * experience and projects beside a column with availability, rate and links. Companies see it at
 * /developer/$id, and developers preview their own in My profile.
 */
export function DeveloperProfileView({
  developer: d,
  top,
  actions,
  photoLayoutId,
  noProjects,
  note,
}: {
  developer: Developer;
  /** Above the header: the way back, plus anything the page says first. */
  top: ReactNode;
  /** Buttons beside the name. */
  actions?: ReactNode;
  /** Lets the photo morph from the Discover card in the preview. */
  photoLayoutId?: string;
  /** Shown when there are no projects. */
  noProjects: string;
  /** Under the bio, e.g. that some text isn't translated yet. */
  note?: ReactNode;
}) {
  const { t, tv, lang, formatCurrency } = useI18n();
  // What the developer wrote, machine-translated into the screen's language unless asked not to.
  const [original, setOriginal] = useState(false);
  const text = (value: string) => (original ? value : tv(value, d.translations));
  // Rate and experience are optional in the profile form.
  const place = [d.location, tv(d.workMode)].filter(Boolean).join(" · ");
  const photo = (
    <DeveloperPhoto
      name={d.name}
      image={d.image}
      alt={d.name}
      fallbackSize="lg"
      className="size-36 shrink-0 overflow-hidden rounded-xl bg-muted shadow-soft"
    />
  );
  return (
    <>
      <section className="stagger-item border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {top}
          <div className="mt-8 flex flex-col gap-7 sm:flex-row sm:items-center">
            {photoLayoutId ? (
              <motion.div layoutId={photoLayoutId} className="w-fit shrink-0 rounded-xl">
                {photo}
              </motion.div>
            ) : (
              photo
            )}
            <div className="min-w-0 flex-1 break-words">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl font-extrabold">{d.name}</h1>
                {d.seniority && <span className="level-badge">{tv(d.seniority)}</span>}
              </div>
              <p className="mt-2 text-lg font-semibold text-primary">{text(d.role)}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {place && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {place}
                  </span>
                )}
                {d.availability && (
                  <span className="flex items-center gap-1.5 text-positive">
                    <span className="status-dot" />
                    {tv(d.availability)}
                  </span>
                )}
              </div>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </div>
      </section>
      <div className="stagger-item stagger-1 mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <div className="min-w-0 space-y-12">
          <section>
            <h2 className="text-xl font-bold">{t.profile.about}</h2>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap break-words leading-7 text-muted-foreground">
              {text(d.bio)}
            </p>
            {isTranslated(d.translations, lang) && (
              <TranslationNote original={original} onToggle={() => setOriginal(!original)} />
            )}
            {note}
          </section>
          {d.skills.length > 0 && (
            <section>
              <h2 className="text-xl font-bold">{t.profile.skills}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {d.skills.map((s) => (
                  <span className="skill-chip px-3 py-2" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}
          {d.experience && (
            <section>
              <h2 className="text-xl font-bold">{t.profile.experience}</h2>
              <div className="mt-5 border-l-2 border-primary pl-5">
                <p className="font-bold">
                  {[text(d.role), tv(d.seniority)].filter(Boolean).join(" · ")}
                </p>
                <p className="text-sm text-primary">{tv(d.experience)}</p>
              </div>
            </section>
          )}
          <section id="portfolio" className="scroll-mt-24">
            <div>
              <span className="section-kicker">{t.profile.portfolioLink}</span>
              <h2 className="section-title">{t.profile.featured}</h2>
            </div>
            {d.projects.length === 0 && (
              <p className="mt-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                {noProjects}
              </p>
            )}
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {d.projects.map((p, index) => (
                <article
                  className="stagger-item overflow-hidden rounded-lg border bg-card"
                  style={{ "--stagger-index": index } as CSSProperties}
                  key={`${index}-${p.name}`}
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="aspect-[16/10] w-full object-cover"
                    />
                  ) : (
                    <div className={`grid aspect-[16/10] place-items-center ${p.color}`}>
                      <span className="font-display text-4xl font-extrabold text-white">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="break-words font-bold">{p.name}</h3>
                    {p.description && (
                      <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
                        {text(p.description)}
                      </p>
                    )}
                    {p.tech.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {p.tech.map((tech) => (
                          <span className="skill-chip" key={tech}>
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                    {(p.links.github || p.links.demo) && (
                      <div className="mt-5 flex gap-4 text-xs font-bold">
                        {p.links.github && (
                          <ProfileLink url={p.links.github} label="GitHub" icon={Github} />
                        )}
                        {p.links.demo && (
                          <ProfileLink url={p.links.demo} label="Demo" icon={ExternalLink} />
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
        <aside>
          <div className="sticky top-24 rounded-lg border bg-card p-6">
            <p className="text-xs font-bold uppercase text-muted-foreground">
              {t.profile.availability}
            </p>
            <p className="mt-2 flex items-center gap-2 font-bold text-positive">
              <Check className="size-4" />
              {d.availability ? tv(d.availability) : "—"}
            </p>
            {Number.isFinite(d.rate) && (
              <>
                <div className="my-5 border-t" />
                <p className="text-xs text-muted-foreground">{t.profile.rate}</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {formatCurrency(d.rate)}
                  <span className="text-sm font-normal text-muted-foreground">/h</span>
                </p>
              </>
            )}
            <div className="my-5 border-t" />
            <p className="text-xs font-bold uppercase text-muted-foreground">{t.profile.links}</p>
            <div className="mt-3 space-y-2">
              {d.links.github && (
                <ProfileLink url={d.links.github} label="GitHub" icon={Github} variant="block" />
              )}
              {d.links.linkedin && (
                <ProfileLink
                  url={d.links.linkedin}
                  label="LinkedIn"
                  icon={Linkedin}
                  variant="block"
                />
              )}
              {d.links.website ? (
                <ProfileLink
                  url={d.links.website}
                  label={t.profile.portfolioLink}
                  icon={ExternalLink}
                  variant="block"
                />
              ) : (
                <Button asChild variant="outline" className="w-full justify-start">
                  <a href="#portfolio">
                    <ExternalLink />
                    {t.profile.portfolioLink}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
