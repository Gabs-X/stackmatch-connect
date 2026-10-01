import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isProposedTimeValid,
  lastRequestTo,
  meetingRequestStorageKey,
  readMeetingRequests,
  type MeetingRequest,
} from "./meeting-requests";

// Noon in Brasília on 2026-10-01; times are interpreted in GMT-3.
const now = Date.parse("2026-10-01T12:00:00-03:00");

const request = (overrides: Partial<MeetingRequest> = {}): MeetingRequest => ({
  id: "1",
  developerId: "marina-costa",
  developerName: "Marina Costa",
  date: "2026-10-02",
  time: "09:00",
  company: "Acme",
  contactName: "Bia Santos",
  email: "rh@acme.com",
  message: "",
  sentAt: "2026-10-01T15:00:00.000Z",
  ...overrides,
});

describe("isProposedTimeValid", () => {
  it("accepts a future time from the list", () => {
    expect(isProposedTimeValid("2026-10-02", "09:00", now)).toBe(true);
    expect(isProposedTimeValid("2026-10-01", "14:00", now)).toBe(true);
  });

  it("rejects times that already passed today", () => {
    expect(isProposedTimeValid("2026-10-01", "10:30", now)).toBe(false);
  });

  it("rejects times outside the offered list", () => {
    expect(isProposedTimeValid("2026-10-02", "08:00", now)).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(isProposedTimeValid("not-a-date", "09:00", now)).toBe(false);
  });
});

describe("lastRequestTo", () => {
  it("returns the newest proposal from the same sender to the developer", () => {
    const older = request({ id: "a", sentAt: "2026-09-01T10:00:00.000Z" });
    const newer = request({ id: "b", sentAt: "2026-09-20T10:00:00.000Z" });
    expect(lastRequestTo([newer, older], "marina-costa", "rh@acme.com")).toBe(newer);
  });

  it("ignores other developers and other senders", () => {
    const requests = [
      request({ developerId: "rafael-lima" }),
      request({ email: "outra@empresa.com" }),
    ];
    expect(lastRequestTo(requests, "marina-costa", "rh@acme.com")).toBeUndefined();
  });
});

describe("readMeetingRequests", () => {
  afterEach(() => vi.unstubAllGlobals());

  const withStorage = (value: string | null) =>
    vi.stubGlobal("window", { localStorage: { getItem: () => value } });

  it("returns an empty list when nothing is stored", () => {
    withStorage(null);
    expect(readMeetingRequests()).toEqual([]);
  });

  it("drops malformed entries and keeps valid ones", () => {
    withStorage(JSON.stringify([request(), { id: 2 }, null, "x"]));
    expect(readMeetingRequests()).toEqual([request()]);
    expect(meetingRequestStorageKey).toBe("stackmatch-meeting-requests");
  });

  it("ignores stored values that aren't a list", () => {
    withStorage(JSON.stringify({ id: "1" }));
    expect(readMeetingRequests()).toEqual([]);
  });
});
