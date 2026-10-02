import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { developersQuery } from "./api";
import { loadPublishedProfiles, profilesStorageKey } from "./local-profile";

const subscribe = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === profilesStorageKey) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
};
/** The stored text is a stable snapshot; parsing happens once per change, below. */
const readStored = () => window.localStorage.getItem(profilesStorageKey) ?? "";
/** Storage only exists in the browser: during server rendering the profiles are still unknown. */
const unknownOnServer = () => undefined;

/**
 * Catalog from the (mock) API plus the profiles developer accounts created in the app, listed
 * first so they're easy to find. Browser navigation reads them right away, so the list doesn't
 * flash a loading state on every visit; only the first, server-rendered load waits for storage.
 */
export function useDevelopers() {
  const { data, isPending, isError, refetch } = useQuery(developersQuery);
  const stored = useSyncExternalStore(subscribe, readStored, unknownOnServer);
  const profiles = useMemo(
    () => (stored === undefined ? undefined : loadPublishedProfiles()),
    [stored],
  );

  const developers = useMemo(
    () => (data && profiles ? [...profiles, ...data] : undefined),
    [data, profiles],
  );

  return { developers, isPending: isPending || !profiles, isError, refetch };
}
