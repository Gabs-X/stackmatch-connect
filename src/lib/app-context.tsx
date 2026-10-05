import type React from "react";
import { useAuth } from "./auth-context";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { fetchMyInterests, markInterestFn, removeInterestFn } from "./interests-api";
import {
  type MeetingRequest,
  meetingRequestStorageKey,
  readMeetingRequests,
} from "./meeting-requests";
import { fetchSavedTalents, removeSavedTalentFn, saveTalentFn } from "./saved-talents-api";
export type { MeetingRequest } from "./meeting-requests";

type AppState = {
  /** False until the lists have been loaded; lists should show loading, not empty, before. */
  hydrated: boolean;
  saved: string[];
  /** Developers the signed-in company marked as interesting; they see the company that did it. */
  interests: string[];
  addSaved: (id: string) => void;
  registerInterest: (id: string) => void;
  removeSaved: (id: string) => void;
  removeInterest: (id: string) => void;
  /** Meeting proposals sent from this browser, kept so a company remembers whom it contacted. */
  meetingRequests: MeetingRequest[];
  toggleSaved: (id: string) => void;
  recordMeetingRequest: (request: MeetingRequest) => void;
};
// Keep a single context instance across hot reloads so provider/consumers never diverge.
const globalStore = globalThis as unknown as {
  __stackmatchAppContext?: React.Context<AppState | null>;
};
const AppContext = (globalStore.__stackmatchAppContext ??= createContext<AppState | null>(null));

type ListName = "saved" | "interests";

/** Each hiring account's shortlist and interest marks, kept on the server. */
const lists = {
  saved: { fetch: fetchSavedTalents, add: saveTalentFn, remove: removeSavedTalentFn },
  interests: { fetch: fetchMyInterests, add: markInterestFn, remove: removeInterestFn },
} satisfies Record<ListName, unknown>;

/**
 * Before lists moved to the server, the browser kept them under these keys. They are dropped
 * rather than handed to whoever signs in next.
 */
const legacyListKeys = /^stackmatch-(saved|interests)(:|$)|^stackmatch-profile-interests$/;

const loadList = (list: ListName) =>
  lists[list].fetch().catch((error: unknown) => {
    console.error(error);
    return [];
  });

type AccountLists = { owner: string | null; saved: string[]; interests: string[] };

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  // Only hiring accounts save talents and mark interest; other sessions get empty lists.
  const owner = user?.accountType === "company" ? user.id : null;
  // Tagged with their owner, so a previous account's lists never show after switching accounts.
  const [accountLists, setAccountLists] = useState<AccountLists | null>(null);
  const current = accountLists?.owner === owner ? accountLists : null;
  const saved = current?.saved ?? [];
  const interests = current?.interests ?? [];
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([]);
  const [recordsRead, setRecordsRead] = useState(false);
  const pending = useRef<Record<ListName, Promise<unknown>>>({
    saved: Promise.resolve(),
    interests: Promise.resolve(),
  });
  const hydrated = recordsRead && current !== null;
  useEffect(() => {
    if (!ready) return;
    try {
      for (const key of Object.keys(window.localStorage))
        if (legacyListKeys.test(key)) window.localStorage.removeItem(key);
    } catch {
      /* Storage unavailable; nothing to clean up. */
    }
    if (!owner) {
      setAccountLists({ owner, saved: [], interests: [] });
      return;
    }
    let active = true;
    void Promise.all([loadList("saved"), loadList("interests")]).then(([saved, interests]) => {
      if (active) setAccountLists({ owner, saved, interests });
    });
    return () => {
      active = false;
    };
  }, [ready, owner]);
  /** Applies `update` to one of the signed-in account's lists. */
  const updateList = (list: ListName, update: (ids: string[]) => string[]) =>
    setAccountLists((state) => {
      if (!state || state.owner !== owner) return state;
      const next = update(state[list]);
      return next === state[list] ? state : { ...state, [list]: next };
    });
  useEffect(() => {
    try {
      setMeetingRequests(readMeetingRequests());
    } catch {
      /* Keep the local list empty if storage cannot be read. */
    }
    setRecordsRead(true);
    const sync = (event: StorageEvent) => {
      try {
        if (event.key === meetingRequestStorageKey || event.key === null)
          setMeetingRequests(readMeetingRequests());
      } catch {
        /* Preserve current state. */
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const add = (id: string) => (ids: string[]) => (ids.includes(id) ? ids : [...ids, id]);
  const remove = (id: string) => (ids: string[]) =>
    ids.includes(id) ? ids.filter((item) => item !== id) : ids;
  /**
   * Shows the change right away and sends it to the server. If the server refuses, the list goes
   * back to what the server has.
   */
  const setInList = (list: ListName, id: string, keep: boolean) => {
    updateList(list, keep ? add(id) : remove(id));
    // One request at a time per list, so an undo right after an action reaches the server last.
    pending.current[list] = pending.current[list]
      .then(() => (keep ? lists[list].add({ data: id }) : lists[list].remove({ data: id })))
      .catch(async (error: unknown) => {
        console.error(error);
        const stored = await lists[list].fetch().catch(() => null);
        if (stored) updateList(list, () => stored);
      });
  };
  const addSaved = (id: string) => setInList("saved", id, true);
  const registerInterest = (id: string) => setInList("interests", id, true);
  const removeSaved = (id: string) => setInList("saved", id, false);
  const removeInterest = (id: string) => setInList("interests", id, false);
  const toggleSaved = (id: string) => setInList("saved", id, !saved.includes(id));
  const recordMeetingRequest = (request: MeetingRequest) => {
    let next = [...meetingRequests, request];
    try {
      // Re-read so proposals sent from another tab aren't overwritten.
      next = [...readMeetingRequests(), request];
      window.localStorage.setItem(meetingRequestStorageKey, JSON.stringify(next));
    } catch {
      /* The proposal was already sent; keep the record for this session only. */
    }
    setMeetingRequests(next);
  };
  return (
    <AppContext.Provider
      value={{
        hydrated,
        saved,
        interests,
        addSaved,
        registerInterest,
        removeSaved,
        removeInterest,
        meetingRequests,
        toggleSaved,
        recordMeetingRequest,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp precisa estar dentro de AppProvider");
  return value;
}
