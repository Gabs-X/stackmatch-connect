import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Structured server logs: one JSON line per event, with the request's id, so every line a request
 * wrote can be found together (Vercel's logs search them). Fields that could hold a secret are
 * never written, and e-mail addresses are masked.
 */

const requests = new AsyncLocalStorage<{ requestId: string }>();

/** An id a client or proxy sent, if it looks like one; else a new one. */
export function requestIdFrom(headers: Headers) {
  const sent = headers.get("x-request-id") ?? headers.get("x-vercel-id") ?? "";
  return /^[\w.:-]{8,128}$/.test(sent) ? sent : randomUUID();
}

/** Runs the request with its id, which every log line it writes carries. */
export const withRequestId = <T>(requestId: string, run: () => T) =>
  requests.run({ requestId }, run);

export const currentRequestId = () => requests.getStore()?.requestId ?? null;

/** Keys whose values are never logged, whatever they hold. */
const secretKey = /pass(word)?|token|secret|cookie|authorization|api[-_]?key|code|hash|session/i;
const email = /([\w.+-])[\w.+-]*@([\w-]+\.[\w.-]+)/g;

/** The value without secrets: secret keys redacted, e-mails masked, long texts cut. */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.replace(email, "$1***@$2").slice(0, 1000);
  if (value instanceof Error) return redact({ name: value.name, message: value.message }, depth);
  if (Array.isArray(value))
    return depth > 4 ? "[…]" : value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    if (depth > 4) return "[…]";
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        secretKey.test(key) ? "[redacted]" : redact(item, depth + 1),
      ]),
    );
  }
  return value;
}

type Level = "info" | "warn" | "error";

/** Writes one event, such as log("info", "account.suspended", { accountId }). */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    requestId: currentRequestId(),
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
