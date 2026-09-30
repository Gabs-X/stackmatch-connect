import type React from "react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import {
  type Appointment,
  appointmentStorageKey,
  isSlotAvailable,
  readAppointments,
} from "./appointments";
export type { Appointment } from "./appointments";

type AppState = {
  saved: string[];
  interests: string[];
  addSaved: (id: string) => void;
  registerInterest: (id: string) => void;
  appointments: Appointment[];
  toggleSaved: (id: string) => void;
  scheduleAppointment: (appointment: Appointment) => "success" | "unavailable" | "storage-error";
};
// Keep a single context instance across hot reloads so provider/consumers never diverge.
const globalStore = globalThis as unknown as {
  __stackmatchAppContext?: React.Context<AppState | null>;
};
const AppContext = (globalStore.__stackmatchAppContext ??= createContext<AppState | null>(null));

export function AppProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const appointmentsRef = useRef<Appointment[]>([]);
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
      appointmentsRef.current = readAppointments();
      setAppointments(appointmentsRef.current);
    } catch {
      /* Keep the local list empty if storage cannot be read. */
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== appointmentStorageKey && event.key !== null) return;
      try {
        appointmentsRef.current = readAppointments();
        setAppointments(appointmentsRef.current);
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
  const scheduleAppointment: AppState["scheduleAppointment"] = (appointment) => {
    try {
      const current = readAppointments();
      if (
        !isSlotAvailable(current, appointment.developerId, appointment.date, appointment.time) ||
        !isSlotAvailable(
          appointmentsRef.current,
          appointment.developerId,
          appointment.date,
          appointment.time,
        )
      ) {
        appointmentsRef.current = current;
        setAppointments(current);
        return "unavailable";
      }
      const next = [...current, appointment];
      window.localStorage.setItem(appointmentStorageKey, JSON.stringify(next));
      appointmentsRef.current = next;
      setAppointments(next);
      return "success";
    } catch {
      return "storage-error";
    }
  };
  return (
    <AppContext.Provider
      value={{
        saved,
        interests,
        addSaved,
        registerInterest,
        appointments,
        toggleSaved,
        scheduleAppointment,
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
