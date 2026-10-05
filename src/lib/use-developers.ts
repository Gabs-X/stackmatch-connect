import { useQuery } from "@tanstack/react-query";
import { publishedProfilesQuery } from "./profile-api";

/** Every developer profile published on StackMatch. */
export function useDevelopers({ enabled = true }: { enabled?: boolean } = {}) {
  const { data, isPending, isError, refetch } = useQuery({ ...publishedProfilesQuery, enabled });
  return { developers: data, isPending, isError, refetch };
}
