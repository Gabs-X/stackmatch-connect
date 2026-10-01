import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appointmentStorageKey,
  isSlotAvailable,
  readAppointments,
  type Appointment,
} from "./appointments";

// Noon in Brasília on 2026-10-01; slots are interpreted in GMT-3.
const now = Date.parse("2026-10-01T12:00:00-03:00");

const booking = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: "1",
  developerId: "marina-costa",
  developerName: "Marina Costa",
  date: "2026-10-02",
  time: "09:00",
  company: "Acme",
  email: "rh@acme.com",
  message: "",
  ...overrides,
});

describe("isSlotAvailable", () => {
  it("accepts a free future slot", () => {
    expect(isSlotAvailable([], "marina-costa", "2026-10-02", "09:00", now)).toBe(true);
    expect(isSlotAvailable([], "marina-costa", "2026-10-01", "14:00", now)).toBe(true);
  });

  it("rejects slots that already passed today", () => {
    expect(isSlotAvailable([], "marina-costa", "2026-10-01", "10:30", now)).toBe(false);
  });

  it("rejects times outside the offered list", () => {
    expect(isSlotAvailable([], "marina-costa", "2026-10-02", "08:00", now)).toBe(false);
  });

  it("rejects a slot already booked with the same developer", () => {
    expect(isSlotAvailable([booking()], "marina-costa", "2026-10-02", "09:00", now)).toBe(false);
  });

  it("keeps the same slot open for other developers", () => {
    expect(isSlotAvailable([booking()], "rafael-lima", "2026-10-02", "09:00", now)).toBe(true);
  });

  it("rejects invalid dates", () => {
    expect(isSlotAvailable([], "marina-costa", "not-a-date", "09:00", now)).toBe(false);
  });
});

describe("readAppointments", () => {
  afterEach(() => vi.unstubAllGlobals());

  const withStorage = (value: string | null) =>
    vi.stubGlobal("window", { localStorage: { getItem: () => value } });

  it("returns an empty list when nothing is stored", () => {
    withStorage(null);
    expect(readAppointments()).toEqual([]);
  });

  it("drops malformed entries and keeps valid ones", () => {
    withStorage(JSON.stringify([booking(), { id: 2 }, null, "x"]));
    expect(readAppointments()).toEqual([booking()]);
    expect(appointmentStorageKey).toBe("stackmatch-appointments");
  });

  it("ignores stored values that aren't a list", () => {
    withStorage(JSON.stringify({ id: "1" }));
    expect(readAppointments()).toEqual([]);
  });
});
