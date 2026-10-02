import type React from "react";
import { useRouter } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  /** Ends the session and takes the user to the home page. */
  signOut: () => Promise<void>;
};

// Keep a single context instance across hot reloads so provider/consumers never diverge.
const store = globalThis as unknown as { __stackmatchAuth?: React.Context<AuthState | null> };
const AuthContext = (store.__stackmatchAuth ??= createContext<AuthState | null>(null));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  // Read by the storage listener, which is set up once.
  const signedIn = useRef(false);
  signedIn.current = session !== null;

  /**
   * Every sign-out lands on the home page. Navigate before clearing the session, so account-only
   * pages leave instead of sending the user to the login.
   */
  const leave = async () => {
    await router.navigate({ to: "/" });
    setSession(null);
  };

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
    // Keep tabs in sync when the user signs in or out elsewhere.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== sessionStorageKey) return;
      const next = loadSession();
      if (next) setSession(next);
      else if (signedIn.current) void leave();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // The listener reads the latest state through refs; it is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    signOut: async () => {
      saveSession(null);
      await leave();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
