import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  loadSession,
  saveSession,
  sessionStorageKey,
  signIn as apiSignIn,
  signUp as apiSignUp,
  type AuthSession,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from "./auth";

type AuthState = {
  user: AuthUser | null;
  /** False until the stored session has been read; avoids flashing logged-out UI. */
  ready: boolean;
  signIn: (input: SignInInput) => Promise<AuthUser>;
  signUp: (input: SignUpInput) => Promise<AuthUser>;
  signOut: () => void;
};

// Keep a single context instance across hot reloads so provider/consumers never diverge.
const store = globalThis as unknown as { __stackmatchAuth?: React.Context<AuthState | null> };
const AuthContext = (store.__stackmatchAuth ??= createContext<AuthState | null>(null));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
    // Keep tabs in sync when the user signs in or out elsewhere.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === sessionStorageKey) setSession(loadSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const start = (next: AuthSession) => {
    saveSession(next);
    setSession(next);
    return next.user;
  };

  const value: AuthState = {
    user: session?.user ?? null,
    ready,
    signIn: async (input) => start(await apiSignIn(input)),
    signUp: async (input) => start(await apiSignUp(input)),
    signOut: () => {
      saveSession(null);
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
