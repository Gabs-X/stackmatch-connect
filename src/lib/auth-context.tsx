import type React from "react";
import { useRouter } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AuthError,
  sessionStorageKey,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
} from "./auth";
import { fetchCurrentUser, signInFn, signOutFn, signUpFn } from "./auth-api";

type AuthState = {
  user: AuthUser | null;
  /** False until the server answered who is signed in; avoids flashing logged-out UI. */
  ready: boolean;
  signIn: (input: SignInInput) => Promise<AuthUser>;
  signUp: (input: SignUpInput) => Promise<AuthUser>;
  /** Ends the session and takes the user to the home page. */
  signOut: () => Promise<void>;
};

// Keep a single context instance across hot reloads so provider/consumers never diverge.
const store = globalThis as unknown as { __stackmatchAuth?: React.Context<AuthState | null> };
const AuthContext = (store.__stackmatchAuth ??= createContext<AuthState | null>(null));

/** Tells the other tabs the session changed; they ask the server who is signed in now. */
function announceSessionChange() {
  try {
    window.localStorage.setItem(sessionStorageKey, String(Date.now()));
  } catch {
    /* Other tabs catch up on their next page load. */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  // Read by the storage listener, which is set up once.
  const signedIn = useRef(false);
  signedIn.current = user !== null;

  /**
   * Every sign-out lands on the home page. Navigate before clearing the account, so account-only
   * pages leave instead of sending the user to the login.
   */
  const leave = async () => {
    await router.navigate({ to: "/" });
    setUser(null);
  };

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const next = await fetchCurrentUser().catch(() => null);
      if (!active) return;
      if (next) setUser(next);
      else if (signedIn.current) await leave();
      setReady(true);
    };
    void refresh();
    // Keep tabs in sync when the user signs in or out elsewhere.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === sessionStorageKey) void refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
    // The listener reads the latest state through refs; it is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (result: { user: AuthUser } | { error: AuthError["code"] }) => {
    if ("error" in result) throw new AuthError(result.error);
    setUser(result.user);
    announceSessionChange();
    return result.user;
  };

  const value: AuthState = {
    user,
    ready,
    signIn: async (input) => start(await signInFn({ data: input })),
    signUp: async (input) => start(await signUpFn({ data: input })),
    signOut: async () => {
      await signOutFn();
      announceSessionChange();
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
