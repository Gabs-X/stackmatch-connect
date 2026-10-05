import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { companyActivityQuery } from "./api";
import { useApp } from "./app-context";
import type { AuthUser } from "./auth";
import { receivedInterestsQuery } from "./interests-api";
import { interestedCompanies } from "./profile-interests";

/**
 * Companies that reached a developer: interest marks from the server, the demo activity, and
 * meeting proposals sent from this browser. Companies reach the profile under the account id.
 */
export function useInterestedCompanies(user: AuthUser) {
  const { hydrated, meetingRequests } = useApp();
  const demo = useQuery(companyActivityQuery(user.id, user.name));
  const received = useQuery(receivedInterestsQuery(user.id));
  const companies = useMemo(
    () =>
      interestedCompanies(
        user.id,
        [...(demo.data?.interests ?? []), ...(received.data ?? [])],
        [...(demo.data?.meetings ?? []), ...meetingRequests],
      ),
    [user.id, demo.data, received.data, meetingRequests],
  );
  const isError = demo.isError || received.isError;
  return {
    companies,
    loading: !hydrated || ((demo.isPending || received.isPending) && !isError),
    isError,
    refetch: () => Promise.all([demo.refetch(), received.refetch()]),
  };
}
