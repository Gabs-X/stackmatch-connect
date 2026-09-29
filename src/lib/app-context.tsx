import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Appointment = {
  id: string;
  developerId: string;
  developerName: string;
  date: string;
  time: string;
  company: string;
  email: string;
  message: string;
};

type AppState = {
  saved: string[];
  appointments: Appointment[];
  toggleSaved: (id: string) => void;
  scheduleAppointment: (appointment: Appointment) => void;
};
// Keep a single context instance across hot reloads so provider/consumers never diverge.
const globalStore = globalThis as unknown as { __stackmatchAppContext?: React.Context<AppState | null> };
const AppContext = (globalStore.__stackmatchAppContext ??= createContext<AppState | null>(null));

export function AppProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  useEffect(() => {
    const stored = window.localStorage.getItem("stackmatch-saved");
    if (stored) setSaved(JSON.parse(stored) as string[]);
    const storedAppointments = window.localStorage.getItem("stackmatch-appointments");
    if (storedAppointments) setAppointments(JSON.parse(storedAppointments) as Appointment[]);
  }, []);
  const toggleSaved = (id: string) => setSaved((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    window.localStorage.setItem("stackmatch-saved", JSON.stringify(next));
    return next;
  });
  const scheduleAppointment = (appointment: Appointment) => setAppointments((current) => {
    const next = [...current.filter((item) => item.id !== appointment.id), appointment];
    window.localStorage.setItem("stackmatch-appointments", JSON.stringify(next));
    return next;
  });
  return <AppContext.Provider value={{ saved, appointments, toggleSaved, scheduleAppointment }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp precisa estar dentro de AppProvider");
  return value;
}