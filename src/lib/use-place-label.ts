import { useI18n } from "./i18n";

/** A place of the Discover filter as shown: "PE" -> "PE (todo o estado)"; a city stays as it is. */
export function usePlaceLabel() {
  const { t } = useI18n();
  return (place: string) => (place.includes(",") ? place : t.filters.wholeState(place));
}
