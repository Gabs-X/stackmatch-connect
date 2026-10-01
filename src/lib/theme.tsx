import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const storageKey = "stackmatch-theme";
const darkQuery = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the first paint so a dark preference never flashes the light theme.
 * Keep it dependency-free and in sync with applyTheme below.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${storageKey}");var d=p==="dark"||(p!=="light"&&window.matchMedia("${darkQuery}").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

type ThemeState = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};
// Keep a single context instance across hot reloads so provider/consumers never diverge.
const store = globalThis as unknown as { __stackmatchTheme?: React.Context<ThemeState | null> };
const ThemeContext = (store.__stackmatchTheme ??= createContext<ThemeState | null>(null));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  // The head script already themed the page; wait for the stored preference before touching it.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferenceState(readPreference());
    const media = window.matchMedia(darkQuery);
    setSystemDark(media.matches);
    setReady(true);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    if (ready) applyTheme(resolved);
  }, [ready, resolved]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === "system") window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, next);
    } catch {
      /* Theme switching still works without persistence. */
    }
  };

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
