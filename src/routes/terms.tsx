import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useI18n, useLocalizedMeta } from "@/lib/i18n";
import { legal, type LegalSection } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de uso e privacidade — Stack Match" },
      {
        name: "description",
        content: "As regras para usar o StackMatch e como os seus dados são tratados.",
      },
    ],
  }),
  component: TermsPage,
});

function Section({ section }: { section: LegalSection }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
      <h3 id={`${section.id}-title`} className="font-bold">
        {section.title}
      </h3>
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mt-2 leading-7 text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {section.items && (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-7 text-muted-foreground">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TermsPage() {
  const { lang } = useI18n();
  const text = legal[lang];
  useLocalizedMeta(text.title + " — Stack Match", text.sub);
  const parts = [
    { id: "terms", title: text.termsTitle, sections: text.terms },
    { id: "privacy", title: text.privacyTitle, sections: text.privacy },
  ];
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <span className="section-kicker">{text.kicker}</span>
      <h1 className="mt-1 font-display text-3xl font-extrabold">{text.title}</h1>
      <p className="mt-2 text-muted-foreground">{text.sub}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text.updated}</p>

      <nav aria-label={text.contents} className="mt-8 rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-bold uppercase text-muted-foreground">{text.contents}</p>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {parts.map((part) => (
            <li key={part.id}>
              <a className="font-semibold text-primary hover:underline" href={`#${part.id}`}>
                {part.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {parts.map((part) => (
        <section
          key={part.id}
          id={part.id}
          aria-labelledby={`${part.id}-heading`}
          className="mt-10 scroll-mt-24"
        >
          <h2 id={`${part.id}-heading`} className="font-display text-2xl font-extrabold">
            {part.title}
          </h2>
          <div className="mt-5 space-y-6">
            {part.sections.map((section) => (
              <Section key={section.id} section={section} />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-12 flex flex-wrap items-center gap-2 border-t pt-6 text-sm text-muted-foreground">
        {text.contact}
        <Link
          to="/support"
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          {text.contactLink}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </main>
  );
}
