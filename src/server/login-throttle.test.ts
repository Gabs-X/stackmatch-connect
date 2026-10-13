import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import {
  clearLoginFailures,
  loginLockedFor,
  loginWindowMinutes,
  maxFailuresPerAccount,
  maxFailuresPerIp,
  recordLoginFailure,
  releaseLoginAttempt,
  reserveLoginAttempt,
} from "./login-throttle";
import { createTestDb } from "./test-db";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

const now = Date.parse("2026-10-06T12:00:00Z");
const minutes = (count: number) => count * 60_000;

/** Wrong passwords for the e-mail from the IP, a second apart, starting at `start`. */
async function fail(email: string, ip: string | null, times: number, start = now) {
  for (let attempt = 0; attempt < times; attempt++)
    await recordLoginFailure(db, email, ip, start + attempt * 1000);
}

describe("per account", () => {
  it("locks after a few wrong passwords, until the oldest leaves the window", async () => {
    await fail("ana@example.com", "1.1.1.1", maxFailuresPerAccount - 1);
    expect(await loginLockedFor(db, "ana@example.com", "1.1.1.1", now + 5000)).toBe(0);

    await fail("ana@example.com", "1.1.1.1", 1, now + 10_000);
    const locked = await loginLockedFor(db, "ana@example.com", "1.1.1.1", now + 10_000);
    // The first failure was 10 s before: it leaves the window 10 s short of the full lock.
    expect(locked).toBe(loginWindowMinutes * 60 - 10);

    // Any address, any case: the lock is the account's.
    expect(await loginLockedFor(db, " ANA@example.com", "2.2.2.2", now + 10_000)).toBe(locked);
    expect(await loginLockedFor(db, "bia@example.com", "2.2.2.2", now + 10_000)).toBe(0);

    const after = now + minutes(loginWindowMinutes) + 1000;
    expect(await loginLockedFor(db, "ana@example.com", "2.2.2.2", after)).toBe(0);
  });

  it("is lifted by a successful sign-in or a password reset", async () => {
    await fail("ana@example.com", null, maxFailuresPerAccount);
    expect(await loginLockedFor(db, "ana@example.com", null, now + 5000)).toBeGreaterThan(0);
    await clearLoginFailures(db, "Ana@Example.com");
    expect(await loginLockedFor(db, "ana@example.com", null, now + 5000)).toBe(0);
  });
});

describe("per IP address", () => {
  it("locks an address that fails across many accounts, and only that address", async () => {
    for (let index = 0; index < maxFailuresPerIp; index++)
      await fail(`pessoa${index}@example.com`, "3.3.3.3", 1, now + index * 1000);

    expect(await loginLockedFor(db, "nova@example.com", "3.3.3.3", now + 30_000)).toBeGreaterThan(
      0,
    );
    expect(await loginLockedFor(db, "nova@example.com", "4.4.4.4", now + 30_000)).toBe(0);
  });

  it("isn't counted when the address is unknown", async () => {
    for (let index = 0; index < maxFailuresPerIp; index++)
      await fail(`pessoa${index}@example.com`, null, 1);
    expect(await loginLockedFor(db, "nova@example.com", null, now + 30_000)).toBe(0);
  });
});

describe("reserveLoginAttempt", () => {
  it("counts every one of many password checks made at once", async () => {
    const attempts = await Promise.all(
      Array.from({ length: maxFailuresPerAccount + 2 }, () =>
        reserveLoginAttempt(db, "ana@example.com", "5.5.5.5", now),
      ),
    );
    expect(attempts.filter((attempt) => "reserved" in attempt)).toHaveLength(maxFailuresPerAccount);
    expect(attempts.filter((attempt) => "retryInSeconds" in attempt)).toHaveLength(2);
    expect(await loginLockedFor(db, "ana@example.com", "5.5.5.5", now)).toBeGreaterThan(0);
  });

  it("lets only one of the checks racing for the last attempt through", async () => {
    await fail("ana@example.com", null, maxFailuresPerAccount - 1);
    const attempts = await Promise.all([
      reserveLoginAttempt(db, "ana@example.com", null, now + 5000),
      reserveLoginAttempt(db, "ana@example.com", null, now + 5000),
    ]);
    expect(attempts.filter((attempt) => "reserved" in attempt)).toHaveLength(1);
  });

  it("gives the attempt back when the password was right", async () => {
    await fail("ana@example.com", null, maxFailuresPerAccount - 1);
    const attempt = await reserveLoginAttempt(db, "ana@example.com", null, now + 5000);
    if (!("reserved" in attempt)) throw new Error("not reserved");
    expect(await loginLockedFor(db, "ana@example.com", null, now + 5000)).toBeGreaterThan(0);
    await releaseLoginAttempt(db, attempt.reserved);
    expect(await loginLockedFor(db, "ana@example.com", null, now + 5000)).toBe(0);
  });
});
