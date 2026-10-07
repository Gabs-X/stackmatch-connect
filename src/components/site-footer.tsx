import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t">
      {/* Bottom padding keeps the links clear of the assistant button. */}
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pb-24 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-6 lg:px-8">
        <p>
          <span className="font-semibold text-foreground">StackMatch</span> · {t.footer.tagline}
        </p>
        <nav aria-label={t.footer.terms} className="flex flex-wrap gap-x-5 gap-y-2 sm:pr-20">
          <Link to="/support" className="hover:text-foreground hover:underline">
            {t.footer.support}
          </Link>
          <Link to="/terms" className="hover:text-foreground hover:underline">
            {t.footer.terms}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
