import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Says the text was machine-translated, with a switch back to what the person wrote. */
export function TranslationNote({
  original,
  onToggle,
}: {
  original: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <Languages className="size-3.5" aria-hidden="true" />
      {original ? t.translation.showingOriginal : t.translation.machine}
      <button
        type="button"
        className="font-semibold text-primary underline-offset-2 hover:underline"
        onClick={onToggle}
      >
        {original ? t.translation.showTranslation : t.translation.showOriginal}
      </button>
    </p>
  );
}
