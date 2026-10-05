import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { AuthUser } from "./auth";
import { receivedInterestsQuery } from "./interests-api";
import { receivedMeetingRequestsQuery } from "./meetings-api";
import { interestedCompanies } from "./profile-interests";

/** Companies that reached a developer, by interest mark or meeting proposal. */
export function useInterestedCompanies(user: AuthUser) {
  const queries = [
    useQuery(receivedInterestsQuery(user.id)),
    useQuery(receivedMeetingRequestsQuery(user.id)),
  ] as const;
  const [interests, meetings] = queries;
  const companies = useMemo(
    () => interestedCompanies(user.id, interests.data ?? [], meetings.data ?? []),
    [user.id, interests.data, meetings.data],
  );
  const isError = queries.some((query) => query.isError);
  return {
    companies,
    loading: !isError && queries.some((query) => query.isPending),
    isError,
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
