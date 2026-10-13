import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalProfile } from "./local-profile";
import {
  claimDraft,
  clearDraft,
  draftOwner,
  draftStores,
  loadDraft,
  sameProfile,
  writeDraft,
  type ProfileDraft,
} from "./profile-draft";

/** How long typing waits before the draft is written. */
const writeDelayMs = 300;

export type DraftOffer = ProfileDraft & {
  /** The profile was saved after the draft started (another tab or device). */
  outdated: boolean;
};

/**
 * The profile form's draft (see profile-draft.ts). Once the saved profile is known, offers the
 * account's stored draft when it differs from it; until the developer recovers or discards it,
 * nothing is written over it. Then, while the form differs from the saved profile (`dirty`), it
 * keeps the changes as the draft, and drops the draft this tab wrote once they're published or
 * undone. A draft another tab wrote is left to that tab.
 */
export function useProfileDraft({
  accountId,
  profile,
  pristine,
  baseVersion,
  savedVersion,
  ready,
}: {
  accountId: string;
  /** What the form shows. */
  profile: LocalProfile;
  /** The saved profile the form started from (or the blank one, before the first save). */
  pristine: LocalProfile;
  baseVersion: number;
  /** The saved profile's version; 0 when there's none. */
  savedVersion: number;
  /** The saved profile is known. */
  ready: boolean;
}) {
  const [tabId] = useState(() => crypto.randomUUID());
  const dirty = useMemo(() => !sameProfile(profile, pristine), [profile, pristine]);
  const [offer, setOffer] = useState<DraftOffer | null>(null);
  const [checked, setChecked] = useState(false);
  /** Set when the account is signing out: its drafts are being deleted, nothing writes them. */
  const closing = useRef(false);

  useEffect(() => {
    if (!ready || checked) return;
    const stores = draftStores();
    if (!stores) {
      setChecked(true);
      return;
    }
    let active = true;
    void loadDraft(stores, accountId)
      .then((draft) => {
        if (!active) return;
        if (draft && !sameProfile(draft.profile, pristine))
          setOffer({ ...draft, outdated: draft.baseVersion < savedVersion });
        // The same as the saved profile: nothing left to recover.
        else if (draft) void clearDraft(stores, accountId);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [ready, checked, accountId, pristine, savedVersion]);

  const write = async () => {
    const stores = draftStores();
    if (!stores || closing.current) return;
    if (dirty) await writeDraft(stores, accountId, { baseVersion, tabId, profile });
    else if (draftOwner(stores, accountId) === tabId) await clearDraft(stores, accountId);
  };
  useEffect(() => {
    if (!checked || offer) return;
    const timer = window.setTimeout(() => void write().catch(() => undefined), writeDelayMs);
    return () => window.clearTimeout(timer);
    // `write` reads the values below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, offer, dirty, profile, baseVersion, accountId, tabId]);

  return {
    dirty,
    offer,
    /** Hands over the offered draft, for the form to show; it stays stored until published. */
    recover: () => {
      const draft = offer;
      setOffer(null);
      const stores = draftStores();
      if (stores) claimDraft(stores, accountId, tabId);
      return draft;
    },
    discard: async () => {
      setOffer(null);
      const stores = draftStores();
      if (stores) await clearDraft(stores, accountId).catch(() => undefined);
    },
    /** Writes the changes now, before leaving the page. */
    flush: () => (offer ? Promise.resolve() : write().catch(() => undefined)),
    /** Stops writing: the account is signing out. */
    close: () => {
      closing.current = true;
    },
  };
}
