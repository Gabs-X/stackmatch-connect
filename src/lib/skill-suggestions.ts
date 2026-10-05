const key = (name: string) => name.trim().toLowerCase();

/** The catalog's spelling of a skill ("react" -> "React"), or the name as typed when it's new. */
export function canonicalSkill(catalog: readonly string[], name: string) {
  return catalog.find((skill) => key(skill) === key(name)) ?? name.trim();
}

/** Whether the list already has this skill, in any case. */
export const hasSkill = (list: readonly string[], name: string) =>
  list.some((skill) => key(skill) === key(name));

/**
 * Catalog skills that contain what was typed, leaving out the ones already chosen. Skills that
 * start with it come first; otherwise the catalog's order (most used first) is kept.
 */
export function suggestSkills(
  catalog: readonly string[],
  typed: string,
  chosen: readonly string[],
  limit = 8,
) {
  const query = key(typed);
  if (!query) return [];
  const matches = catalog.filter((skill) => key(skill).includes(query) && !hasSkill(chosen, skill));
  const starts = matches.filter((skill) => key(skill).startsWith(query));
  const contains = matches.filter((skill) => !key(skill).startsWith(query));
  return [...starts, ...contains].slice(0, limit);
}
