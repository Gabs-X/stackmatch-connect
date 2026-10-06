/**
 * How much a company can reach out, so nobody uses StackMatch to spam developers: each interest
 * mark and meeting proposal e-mails someone. The server enforces these; the screens explain them.
 */
export const outreachLimits = {
  /** Interest marks per company in any 24 hours; undoing one doesn't give it back. */
  interestsPerDay: 50,
  /** Meeting proposals per company in any 24 hours. */
  meetingsPerDay: 20,
  /** Meeting proposals from one company to the same developer in any 7 days. */
  meetingsPerDeveloper: 3,
  meetingsPerDeveloperDays: 7,
  /** A developer gets at most one interest e-mail from the same company in this many days. */
  interestEmailEveryDays: 30,
} as const;

/** Which limit refused the action, and in how many seconds it allows another one. */
export type OutreachLimitError = {
  error: "interest-limit" | "meeting-limit" | "developer-meeting-limit";
  retryInSeconds: number;
};
