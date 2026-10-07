import type { Lang } from "./i18n";

/**
 * Machine translations of what people wrote, keyed by the original text: each entry has the text
 * in both languages (the original stays as it is in its own language). Sent along with profiles
 * so the screen can show them in the chosen language.
 */
export type Translations = Record<string, { pt: string; en: string }>;

/** Whether some text shows in a language it wasn't written in. */
export const isTranslated = (translations: Translations | undefined, lang: Lang) =>
  Object.entries(translations ?? {}).some(([original, versions]) => versions[lang] !== original);
