import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import {
  type MeetingRequest,
  meetingRequestStorageKey,
  readMeetingRequests,
} from "./meeting-requests";
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
};
// Keep a single context instance across hot reloads so provider/consumers never diverge.
const globalStore = globalThis as unknown as {
  __stackmatchAppContext?: React.Context<AppState | null>;
};
const AppContext = (globalStore.__stackmatchAppContext ??= createContext<AppState | null>(null));

export function AppProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [meetingRequests, setMeetingRequests] = useState<MeetingRequest[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const value: unknown = JSON.parse(
        window.localStorage.getItem("stackmatch-interests") ?? "[]",
      );
      if (Array.isArray(value))
        setInterests(value.filter((id): id is string => typeof id === "string"));
    } catch {
      /* Keep session state if storage is unavailable. */
    }
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem("stackmatch-saved") ?? "[]");
      if (Array.isArray(value))
        setSaved(value.filter((id): id is string => typeof id === "string"));
    } catch {
      /* Keep session state if storage is unavailable or corrupted. */
    }
    try {
      setMeetingRequests(readMeetingRequests());
    } catch {
      /* Keep the local list empty if storage cannot be read. */
    }
    setHydrated(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== meetingRequestStorageKey && event.key !== null) return;
      try {
        setMeetingRequests(readMeetingRequests());
      } catch {
        /* Preserve current state. */
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const addSaved = (id: string) =>
    setSaved((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        window.localStorage.setItem("stackmatch-saved", JSON.stringify(next));
      } catch {
        /* Keep session state. */
      }
      return next;
    });
  const registerInterest = (id: string) =>
    setInterests((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        window.localStorage.setItem("stackmatch-interests", JSON.stringify(next));
      } catch {
        /* Keep session state. */
      }
      return next;
    });
  const removeSaved = (id: string) =>
    setSaved((current) => {
      if (!current.includes(id)) return current;
      const next = current.filter((item) => item !== id);
      try {
        window.localStorage.setItem("stackmatch-saved", JSON.stringify(next));
      } catch {
        /* Keep session state. */
      }
      return next;
    });
  const removeInterest = (id: string) =>
    setInterests((current) => {
      if (!current.includes(id)) return current;
      const next = current.filter((item) => item !== id);
      try {
        window.localStorage.setItem("stackmatch-interests", JSON.stringify(next));
      } catch {
        /* Keep session state. */
      }
      return next;
    });
  const toggleSaved = (id: string) =>
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        window.localStorage.setItem("stackmatch-saved", JSON.stringify(next));
      } catch {
        /* Keep session state. */
      }
      return next;
    });
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
