import type { Developer } from "./developers";

export type DiscoverAction = "pass" | "save" | "interest";

export type HistoryEntry = {
  id: string;
  name: string;
  /** Card position before the action, restored on undo. */
  index: number;
  addedSaved: boolean;
  addedInterest: boolean;
};

/**
 * Records only what the action added, so undo never removes a profile that was already saved
 * or marked as interesting before this decision.
 */
export function createHistoryEntry(
  developer: Pick<Developer, "id" | "name">,
  action: DiscoverAction,
  index: number,
  saved: readonly string[],
  interests: readonly string[],
): HistoryEntry {
  return {
    id: developer.id,
    name: developer.name,
    index,
    addedSaved: action !== "pass" && !saved.includes(developer.id),
    addedInterest: action === "interest" && !interests.includes(developer.id),
  };
}

/** Only the latest decision can be undone, so an old toast can't undo a newer one. */
export function canUndo(entry: HistoryEntry | undefined, history: readonly HistoryEntry[]) {
  return entry !== undefined && history.at(-1) === entry;
}
