import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useApp } from "./app-context";
import { profilesByIdQuery } from "./profile-api";

/**
 * The company's saved profiles that still exist, in the order they were published, and how many
 * there are. While a change to the saved list loads, the last answer stays, narrowed to the list.
 */
export function useSavedDevelopers({ enabled = true }: { enabled?: boolean } = {}) {
  const { saved } = useApp();
  const { data, isPending, isError, refetch } = useQuery({
    ...profilesByIdQuery(saved),
    enabled,
    placeholderData: keepPreviousData,
  });
  // Ids asked for but not found: profiles deleted since they were saved.
  const missing = data?.ids.filter(
    (id) => !data.developers.some((developer) => developer.id === id),
  );
  return {
    developers: data?.developers.filter((developer) => saved.includes(developer.id)),
    count: missing ? saved.filter((id) => !missing.includes(id)).length : 0,
    isPending,
    isError,
    refetch,
  };
}
