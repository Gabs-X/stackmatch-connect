import type React from "react";
import { useAuth } from "./auth-context";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { toast } from "sonner";
import type { MarkResult } from "@/server/outreach";
import { useI18n, type Lang } from "./i18n";
import { outreachLimits } from "./outreach";
import { fetchMyInterests, markInterestFn, removeInterestFn } from "./interests-api";
import { removeCandidateFn } from "./jobs-api";
import { fetchSavedTalents, removeSavedTalentFn, saveTalentFn } from "./saved-talents-api";

/**
 * True once the server kept the change; false when it refused it or failed (the list then shows
 * what the server has), or when the account changed before it was sent.
 */
type Change = Promise<boolean>;

type AppState = {
  /** False until the lists have been loaded; lists should show loading, not empty, before. */
  hydrated: boolean;
  /** The lists couldn't be loaded: they are unknown, not empty, until reloadLists works. */
  loadFailed: boolean;
  reloadLists: () => void;
  saved: string[];
  /** Developers the signed-in company marked as interesting; they see the company that did it. */
  interests: string[];
  /** With a job, the developer also joins it (see src/server/jobs.ts). */
  addSaved: (id: string, jobId?: string) => Change;
  registerInterest: (id: string, jobId?: string) => Change;
  removeSaved: (id: string) => Change;
  removeInterest: (id: string) => Change;
  toggleSaved: (id: string) => Change;
  /** Takes the developer out of the job, after the saves and marks already on their way. */
  leaveJob: (id: string, jobId: string) => void;
};
// Keep a single context instance across hot reloads so provider/consumers never diverge.
const globalStore = globalThis as unknown as {
  __stackmatchAppContext?: React.Context<AppState | null>;
};
const AppContext = (globalStore.__stackmatchAppContext ??= createContext<AppState | null>(null));

type ListName = "saved" | "interests";

/** The server turned the change down, for instance because of a limit (src/lib/outreach.ts). */
class Refused extends Error {
  constructor(readonly result: Exclude<MarkResult, { ok: true }>) {
    super(result.error);
    this.name = "Refused";
  }
}

/**
 * Every call names the account the lists belong to; the server refuses it when the session became
 * another account's in another tab (see requireAccount).
 */
type ChangeRequest = { accountId: string; developerId: string };
type AddRequest = ChangeRequest & { language: Lang; jobId?: string | undefined };

/** Each hiring account's shortlist and interest marks, kept on the server. */
const lists = {
  saved: {
    fetch: (accountId: string) => fetchSavedTalents({ data: { accountId } }),
    add: ({ accountId, developerId, jobId }: AddRequest) =>
      saveTalentFn({ data: { accountId, developerId, ...(jobId ? { jobId } : {}) } }),
    remove: (data: ChangeRequest) => removeSavedTalentFn({ data }),
  },
  interests: {
    fetch: (accountId: string) => fetchMyInterests({ data: { accountId } }),
    // The developer gets an e-mail about the first mark, in this screen's language.
    add: ({ accountId, developerId, language, jobId }: AddRequest) =>
      markInterestFn({
        data: { accountId, developerId, language, ...(jobId ? { jobId } : {}) },
      }),
    remove: (data: ChangeRequest) => removeInterestFn({ data }),
  },
} satisfies Record<ListName, unknown>;

/**
 * Before lists and proposals moved to the server, the browser kept them under these keys. They
 * are dropped rather than handed to whoever signs in next.
 */
const legacyListKeys =
  /^stackmatch-(saved|interests)(:|$)|^stackmatch-(profile-interests|meeting-requests)$/;

/** One account's lists, or that they failed to load (`failed`, with both lists empty). */
type AccountLists = {
  owner: string | null;
  saved: string[];
  interests: string[];
  failed: boolean;
};

const noPendingChanges = (): Record<ListName, Promise<unknown>> => ({
  saved: Promise.resolve(),
  interests: Promise.resolve(),
});

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const { t, lang } = useI18n();
  // Only hiring accounts save talents and mark interest; other sessions get empty lists.
  // Only confirmed company accounts have lists; the server refuses anyone else.
  const owner = user?.accountType === "company" && user.emailVerified ? user.id : null;
  // Tagged with their owner, so a previous account's lists never show after switching accounts.
  const [accountLists, setAccountLists] = useState<AccountLists | null>(null);
  const current = accountLists?.owner === owner ? accountLists : null;
  const saved = current?.saved ?? [];
  const interests = current?.interests ?? [];
  const hydrated = current !== null && !current.failed;
  const loadFailed = current?.failed ?? false;
  // Changes wait for the ones before them on the same list (see setInList).
  const pending = useRef(noPendingChanges());
  /**
   * Counts the sessions this tab has seen: it goes up whenever the account changes, including a
   * sign-out and a sign-in back to the same account. A change made in one session is never sent,
   * nor its answer applied, in a later one.
   */
  const session = useRef(0);
  useEffect(() => {
    session.current += 1;
    pending.current = noPendingChanges();
  }, [owner]);
  // Goes up to load the lists again after a failure.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const reloadLists = () => {
    setAccountLists(null);
    setLoadAttempt((attempt) => attempt + 1);
  };
  useEffect(() => {
    if (!ready) return;
    try {
      for (const key of Object.keys(window.localStorage))
        if (legacyListKeys.test(key)) window.localStorage.removeItem(key);
    } catch {
      /* Storage unavailable; nothing to clean up. */
    }
    if (!owner) {
      setAccountLists({ owner, saved: [], interests: [], failed: false });
      return;
    }
    let active = true;
    void Promise.all([lists.saved.fetch(owner), lists.interests.fetch(owner)])
      .then(([saved, interests]) => ({ owner, saved, interests, failed: false }))
      .catch((error: unknown) => {
        console.error(error);
        return { owner, saved: [], interests: [], failed: true };
      })
      .then((loaded) => {
        if (active) setAccountLists(loaded);
      });
    return () => {
      active = false;
    };
  }, [ready, owner, loadAttempt]);
  /** Applies `update` to one of the signed-in account's lists. */
  const updateList = (list: ListName, update: (ids: string[]) => string[]) =>
    setAccountLists((state) => {
      if (!state || state.owner !== owner) return state;
      const next = update(state[list]);
      return next === state[list] ? state : { ...state, [list]: next };
    });
  const add = (id: string) => (ids: string[]) => (ids.includes(id) ? ids : [...ids, id]);
  const remove = (id: string) => (ids: string[]) =>
    ids.includes(id) ? ids.filter((item) => item !== id) : ids;
  /**
   * Shows the change right away and sends it to the server. If the server refuses (a limit, or an
   * error), the list goes back to what the server has. Only for an account whose lists loaded.
   */
  const setInList = (list: ListName, id: string, keep: boolean, jobId?: string): Change => {
    if (!owner || !hydrated) return Promise.resolve(false);
    const accountId = owner;
    const started = session.current;
    const sameSession = () => session.current === started;
    const wasIn = (list === "saved" ? saved : interests).includes(id);
    updateList(list, keep ? add(id) : remove(id));
    // One request at a time per list, so an undo right after an action reaches the server last.
    const change = pending.current[list].then(async () => {
      // The account changed while it waited: it was the previous account's, so it's dropped.
      if (!sameSession()) return false;
      try {
        const result = keep
          ? await lists[list].add({ accountId, developerId: id, language: lang, jobId })
          : await lists[list].remove({ accountId, developerId: id });
        if (result && typeof result === "object" && "error" in result) throw new Refused(result);
        return true;
      } catch (error) {
        // An answer for the previous account; the lists on screen are another account's now.
        if (!sameSession()) return false;
        if (error instanceof Refused && error.result.error === "interest-limit")
          toast.error(
            t.outreach.interestLimit(
              outreachLimits.interestsPerDay,
              t.outreach.wait(error.result.retryInSeconds),
            ),
          );
        else {
          console.error(error);
          toast.error(t.saved.changeError);
        }
        const stored = await lists[list].fetch(accountId).catch(() => null);
        if (!sameSession()) return false;
        // Without the server's list (the session may be another account's now), undo just this.
        updateList(list, stored ? () => stored : wasIn ? add(id) : remove(id));
        return false;
      }
    });
    pending.current[list] = change;
    return change;
  };
  const addSaved = (id: string, jobId?: string) => setInList("saved", id, true, jobId);
  const registerInterest = (id: string, jobId?: string) => setInList("interests", id, true, jobId);
  const removeSaved = (id: string) => setInList("saved", id, false);
  const removeInterest = (id: string) => setInList("interests", id, false);
  const toggleSaved = (id: string) => setInList("saved", id, !saved.includes(id));
  const leaveJob = (id: string, jobId: string) => {
    if (!owner) return;
    const accountId = owner;
    const started = session.current;
    const after = Promise.all([pending.current.saved, pending.current.interests]);
    pending.current.saved = after
      .then(() =>
        session.current === started
          ? removeCandidateFn({ data: { jobId, developerId: id, accountId } })
          : undefined,
      )
      .catch((error: unknown) => console.error(error));
  };
  return (
    <AppContext.Provider
      value={{
        hydrated,
        loadFailed,
        reloadLists,
        saved,
        interests,
        addSaved,
        registerInterest,
        removeSaved,
        removeInterest,
        toggleSaved,
        leaveJob,
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
