import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { developersQuery } from "./api";
import type { Developer } from "./developers";
import { loadLocalProfile, localProfileStorageKey, localProfileToDeveloper } from "./local-profile";

/**
 * Catalog from the (mock) API plus the profile created in this browser, listed first so its
 * author sees it right away. The local profile is read after mount because storage only exists
 * in the browser.
 */
export function useDevelopers() {
  const { data, isPending, isError, refetch } = useQuery(developersQuery);
  const [local, setLocal] = useState<Developer | null>(null);

  useEffect(() => {
    const read = () => {
      const profile = loadLocalProfile();
      setLocal(profile ? localProfileToDeveloper(profile) : null);
    };
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === localProfileStorageKey) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const developers = useMemo(
    () => (data ? (local ? [local, ...data] : data) : undefined),
    [data, local],
  );

  return { developers, isPending, isError, refetch };
}
