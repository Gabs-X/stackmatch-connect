import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request comes from Vercel Cron (schedules in vite.config.ts). Vercel sends
 * "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set in the project; without it, the
 * cron routes refuse everyone, so nobody else can trigger them.
 */
export function cronAuthorized(header: string | null) {
  const secret = process.env["CRON_SECRET"]?.trim();
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
