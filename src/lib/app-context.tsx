import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AppState = { saved: string[]; toggleSaved: (id: string) => void };
const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    const stored = window.localStorage.getItem("stackmatch-saved");
    if (stored) setSaved(JSON.parse(stored) as string[]);
  }, []);
  const toggleSaved = (id: string) => setSaved((current) => {
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    window.localStorage.setItem("stackmatch-saved", JSON.stringify(next));
    return next;
  });
  return <AppContext.Provider value={{ saved, toggleSaved }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp precisa estar dentro de AppProvider");
  return value;
}