import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { developersQuery } from "./api";
import { publishedProfilesQuery } from "./profile-api";

/**
 * Catalog from the (mock) API plus the profiles developer accounts published in the app, listed
 * first so they're easy to find.
 */
export function useDevelopers({ enabled = true }: { enabled?: boolean } = {}) {
  const catalog = useQuery({ ...developersQuery, enabled });
  const published = useQuery({ ...publishedProfilesQuery, enabled });

  const developers = useMemo(
    () => (catalog.data && published.data ? [...published.data, ...catalog.data] : undefined),
    [catalog.data, published.data],
  );

  return {
    developers,
    isPending: catalog.isPending || published.isPending,
    isError: catalog.isError || published.isError,
    refetch: () => Promise.all([catalog.refetch(), published.refetch()]),
  };
}
