import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { companyActivityQuery } from "./api";
import { useApp } from "./app-context";
import type { AuthUser } from "./auth";
import { interestedCompanies } from "./profile-interests";

/**
 * Companies that reached a developer: what the API returns plus what companies did in this
 * browser. Companies reach the profile, and send their interest, under the account id.
 */
export function useInterestedCompanies(user: AuthUser) {
  const { hydrated, profileInterests, meetingRequests } = useApp();
  const { data, isPending, isError, refetch } = useQuery(companyActivityQuery(user.id, user.name));
  const companies = useMemo(
    () =>
      interestedCompanies(
        user.id,
        [...(data?.interests ?? []), ...profileInterests],
        [...(data?.meetings ?? []), ...meetingRequests],
      ),
    [user.id, data, profileInterests, meetingRequests],
  );
  return { companies, loading: !hydrated || (isPending && !isError), isError, refetch };
}
