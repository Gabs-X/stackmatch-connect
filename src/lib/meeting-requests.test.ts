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
  companyId: "acme-account",
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
    expect(lastRequestTo([newer, older], "marina-costa", "acme-account")).toBe(newer);
  });

  it("still finds earlier proposals after the company changes its contact e-mail", () => {
    const sent = request({ email: "rh@acme.com" });
    expect(lastRequestTo([sent], "marina-costa", "acme-account")).toBe(sent);
    expect(
      lastRequestTo([{ ...sent, email: "novo@acme.com" }], "marina-costa", "acme-account"),
    ).toBeDefined();
  });

  it("ignores other developers and other senders", () => {
    const requests = [
      request({ developerId: "rafael-lima" }),
      request({ companyId: "other-account" }),
    ];
    expect(lastRequestTo(requests, "marina-costa", "acme-account")).toBeUndefined();
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

  it("identifies proposals saved before account ids by their e-mail", () => {
    const { companyId: _companyId, ...older } = request();
    withStorage(JSON.stringify([older]));
    expect(readMeetingRequests()).toEqual([request({ companyId: "rh@acme.com" })]);
  });

  it("ignores stored values that aren't a list", () => {
    withStorage(JSON.stringify({ id: "1" }));
    expect(readMeetingRequests()).toEqual([]);
  });
});
