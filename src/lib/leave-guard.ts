/**
 * Lets a page with unpublished changes be asked before the account signs out, which the router's
 * blocker doesn't cover: signing out ends the session first and then leaves without asking (see
 * AuthProvider). One page at a time holds it.
 */
type Guard = () => Promise<boolean>;

let guard: Guard | null = null;

export function setLeaveGuard(next: Guard | null) {
  guard = next;
}

/** Whether the account may sign out now: true when no page holds changes, or it agreed. */
export const confirmSignOut = () => (guard ? guard() : Promise.resolve(true));
