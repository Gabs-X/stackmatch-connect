import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { developersQuery } from "./api";
import type { Developer } from "./developers";
import { loadPublishedProfiles, profilesStorageKey } from "./local-profile";

/**
 * Catalog from the (mock) API plus the profiles developer accounts created in the app, listed
 * first so they're easy to find. Those are read after mount because storage only exists in the
 * browser.
 */
export function useDevelopers() {
  const { data, isPending, isError, refetch } = useQuery(developersQuery);
  // Undefined until storage is read, so the list never shows up first without these profiles.
  const [profiles, setProfiles] = useState<Developer[]>();

  useEffect(() => {
    const read = () => setProfiles(loadPublishedProfiles());
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === profilesStorageKey) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const developers = useMemo(
    () => (data && profiles ? [...profiles, ...data] : undefined),
    [data, profiles],
  );

  return { developers, isPending: isPending || !profiles, isError, refetch };
}
