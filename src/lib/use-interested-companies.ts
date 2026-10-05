import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { companyActivityQuery } from "./api";
import type { AuthUser } from "./auth";
import { receivedInterestsQuery } from "./interests-api";
import { receivedMeetingRequestsQuery } from "./meetings-api";
import { interestedCompanies } from "./profile-interests";

/**
 * Companies that reached a developer, by interest mark or proposal: what the server has, plus the
 * demo activity. Companies reach the profile under the account id.
 */
export function useInterestedCompanies(user: AuthUser) {
  const queries = [
    useQuery(companyActivityQuery(user.id, user.name)),
    useQuery(receivedInterestsQuery(user.id)),
    useQuery(receivedMeetingRequestsQuery(user.id)),
  ] as const;
  const [demo, interests, meetings] = queries;
  const companies = useMemo(
    () =>
      interestedCompanies(
        user.id,
        [...(demo.data?.interests ?? []), ...(interests.data ?? [])],
        [...(demo.data?.meetings ?? []), ...(meetings.data ?? [])],
      ),
    [user.id, demo.data, interests.data, meetings.data],
  );
  const isError = queries.some((query) => query.isError);
  return {
    companies,
    loading: !isError && queries.some((query) => query.isPending),
    isError,
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
