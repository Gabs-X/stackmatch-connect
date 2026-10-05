import type React from "react";
import { demoDeveloperId } from "./auth";
import { useAuth } from "./auth-context";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  type MeetingRequest,
  meetingRequestStorageKey,
  readMeetingRequests,
} from "./meeting-requests";
import {
  type ProfileInterest,
  type ProfileInterestInput,
  profileInterestStorageKey,
  readProfileInterests,
} from "./profile-interests";
import { fetchSavedTalents, removeSavedTalentFn, saveTalentFn } from "./saved-talents-api";
export type { MeetingRequest } from "./meeting-requests";

type AppState = {
  /** False until browser storage has been read; lists should show loading, not empty, before. */
  hydrated: boolean;
  saved: string[];
  interests: string[];
  addSaved: (id: string) => void;
  registerInterest: (id: string) => void;
  removeSaved: (id: string) => void;
  removeInterest: (id: string) => void;
  /** Meeting proposals sent from this browser, kept so a company remembers whom it contacted. */
  meetingRequests: MeetingRequest[];
  toggleSaved: (id: string) => void;
  recordMeetingRequest: (request: MeetingRequest) => void;
  /** Which company marked which profile as interesting, so developers see who it was. */
  profileInterests: ProfileInterest[];
  /** Returns false when this company had already marked the profile. */
  recordProfileInterest: (input: ProfileInterestInput) => boolean;
  removeProfileInterest: (developerId: string, companyId: string) => void;
};
// Keep a single context instance across hot reloads so provider/consumers never diverge.
const globalStore = globalThis as unknown as {
  __stackmatchAppContext?: React.Context<AppState | null>;
};
const AppContext = (globalStore.__stackmatchAppContext ??= createContext<AppState | null>(null));

/** Gabriel's profile moved from the fictional catalog to the demo developer account. */
const renamedIds: Record<string, string> = { "gabriel-botelho": demoDeveloperId };

/** Keeps the stored ids that are strings, under their current names and without duplicates. */
function upgradeIds(value: unknown[]) {
  const ids = value.filter((id): id is string => typeof id === "string");
  return [...new Set(ids.map((id) => renamedIds[id] ?? id))];
}

type ListName = "saved" | "interests";

/**
 * Each hiring account has its own shortlist, kept on the server, and interest marks, kept in this
 * browser for now.
 */
const interestsKey = (accountId: string) => `stackmatch-interests:${accountId}`;

/**
 * Before lists belonged to accounts, every company in the browser shared these keys. Nothing
 * records whose they were, so they are dropped rather than handed to whoever signs in next.
 */
const legacyListKeys = ["stackmatch-saved", "stackmatch-interests"];

function readInterests(accountId: string) {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(interestsKey(accountId)) ?? "[]");
    return Array.isArray(value) ? upgradeIds(value) : [];
  } catch {
    return [];
  }
}

type AccountLists = { owner: string | null; saved: string[]; interests: string[] };

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  // Only hiring accounts save talents and mark interest; other sessions get empty lists.
  const owner = user?.accountType === "company" ? user.id : null;
  // Tagged with their owner, so a previous account's lists never show after switching accounts.
  const [lists, setLists] = useState<AccountLists | null>(null);
  const current = lists?.owner === owner ? lists : null;
  const saved = current?.saved ?? [];
  const interests = current?.interests ?? [];
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([]);
  const [profileInterests, setProfileInterests] = useState<ProfileInterest[]>([]);
  const [recordsRead, setRecordsRead] = useState(false);
  const hydrated = recordsRead && current !== null;
  useEffect(() => {
    if (!ready) return;
    try {
      for (const key of legacyListKeys) window.localStorage.removeItem(key);
    } catch {
      /* Storage unavailable; nothing to clean up. */
    }
    if (!owner) {
      setLists({ owner, saved: [], interests: [] });
      return;
    }
    let active = true;
    const interests = readInterests(owner);
    fetchSavedTalents()
      .catch((error: unknown) => {
        console.error(error);
        return [];
      })
      .then((saved) => {
        if (active) setLists({ owner, saved, interests });
      });
    return () => {
      active = false;
    };
  }, [ready, owner]);
  /** Applies `update` to one of the signed-in account's lists and stores the result. */
  const updateList = (list: ListName, update: (ids: string[]) => string[]) =>
    setLists((state) => {
      if (!state || state.owner !== owner) return state;
      const next = update(state[list]);
      if (next === state[list]) return state;
      try {
        if (owner && list === "interests")
          window.localStorage.setItem(interestsKey(owner), JSON.stringify(next));
      } catch {
        /* Keep session state. */
      }
      return { ...state, [list]: next };
    });
  useEffect(() => {
    try {
      setMeetingRequests(readMeetingRequests());
    } catch {
      /* Keep the local list empty if storage cannot be read. */
    }
    try {
      setProfileInterests(readProfileInterests());
    } catch {
      /* Keep the local list empty if storage cannot be read. */
    }
    setRecordsRead(true);
    const sync = (event: StorageEvent) => {
      try {
        if (event.key === meetingRequestStorageKey || event.key === null)
          setMeetingRequests(readMeetingRequests());
        if (event.key === profileInterestStorageKey || event.key === null)
          setProfileInterests(readProfileInterests());
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
   * Shows the change right away and sends it to the server. If the server refuses, the shortlist
   * goes back to what the server has.
   */
  const setSaved = (id: string, keep: boolean) => {
    updateList("saved", keep ? add(id) : remove(id));
    const request = keep ? saveTalentFn({ data: id }) : removeSavedTalentFn({ data: id });
    request.catch(async (error: unknown) => {
      console.error(error);
      const saved = await fetchSavedTalents().catch(() => null);
      if (saved) updateList("saved", () => saved);
    });
  };
  const addSaved = (id: string) => setSaved(id, true);
  const registerInterest = (id: string) => updateList("interests", add(id));
  const removeSaved = (id: string) => setSaved(id, false);
  const removeInterest = (id: string) => updateList("interests", remove(id));
  const toggleSaved = (id: string) => setSaved(id, !saved.includes(id));
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
  const writeProfileInterests = (update: (current: ProfileInterest[]) => ProfileInterest[]) => {
    let next = update(profileInterests);
    try {
      // Re-read so marks made in another tab aren't overwritten.
      next = update(readProfileInterests());
      window.localStorage.setItem(profileInterestStorageKey, JSON.stringify(next));
    } catch {
      /* Keep session state. */
    }
    setProfileInterests(next);
  };
  const recordProfileInterest = (input: ProfileInterestInput) => {
    const exists = (items: ProfileInterest[]) =>
      items.some(
        (item) => item.developerId === input.developerId && item.companyId === input.companyId,
      );
    if (exists(profileInterests)) return false;
    writeProfileInterests((current) =>
      exists(current)
        ? current
        : [
            ...current,
            { ...input, id: `${input.developerId}-${Date.now()}`, at: new Date().toISOString() },
          ],
    );
    return true;
  };
  const removeProfileInterest = (developerId: string, companyId: string) =>
    writeProfileInterests((current) =>
      current.filter((item) => item.developerId !== developerId || item.companyId !== companyId),
    );
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
        profileInterests,
        recordProfileInterest,
        removeProfileInterest,
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
