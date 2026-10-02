import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { developersQuery } from "./api";
import type { Developer } from "./developers";
import {
  loadPublishedProfile,
  localProfileStorageKey,
  localProfileToDeveloper,
} from "./local-profile";

/**
 * Catalog from the (mock) API plus the developer profile published in this browser, listed first so
 * its author sees it right away. The local profile is read after mount because storage only exists
 * in the browser.
 */
export function useDevelopers() {
  const { data, isPending, isError, refetch } = useQuery(developersQuery);
  // Undefined until storage is read, so the list never shows up first without this profile.
  const [local, setLocal] = useState<Developer>();

  useEffect(() => {
    const read = () => {
      setLocal(localProfileToDeveloper(loadPublishedProfile()));
    };
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === localProfileStorageKey) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const developers = useMemo(() => (data && local ? [local, ...data] : undefined), [data, local]);

  return { developers, isPending: isPending || !local, isError, refetch };
}
