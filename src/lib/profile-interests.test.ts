import { describe, expect, it } from "vitest";
import type { MeetingRequest } from "./meeting-requests";
import { interestedCompanies, type ProfileInterest } from "./profile-interests";

const interest = (fields: Partial<ProfileInterest>): ProfileInterest => ({
  id: "i",
  developerId: "demo-developer",
  company: "Acme",
  contactName: "Bruno",
  email: "bruno@acme.com",
  at: "2026-10-01T10:00:00.000Z",
  ...fields,
});

const meeting = (fields: Partial<MeetingRequest>): MeetingRequest => ({
  id: "m",
  developerId: "demo-developer",
  developerName: "Ana",
  date: "2026-10-05",
  time: "14:00",
  company: "Acme",
  contactName: "Bruno",
  email: "bruno@acme.com",
  message: "",
  sentAt: "2026-10-02T10:00:00.000Z",
  ...fields,
});

describe("interestedCompanies", () => {
  it("keeps only this developer's activity, one entry per company, newest first", () => {
    const result = interestedCompanies(
      "demo-developer",
      [
        interest({}),
        interest({ email: "carla@nuvem.com", company: "Nuvem", at: "2026-10-03T08:00:00.000Z" }),
        interest({ developerId: "marina-costa", email: "x@y.com" }),
      ],
      [meeting({}), meeting({ developerId: "marina-costa", email: "z@y.com" })],
    );
    expect(result.map((item) => item.company)).toEqual(["Nuvem", "Acme"]);
    expect(result[1]).toMatchObject({ at: "2026-10-02T10:00:00.000Z", meeting: { id: "m" } });
    expect(result[0]?.meeting).toBeUndefined();
  });

  it("shows the latest proposal when a company sent more than one", () => {
    const [acme] = interestedCompanies(
      "demo-developer",
      [],
      [meeting({ id: "new", sentAt: "2026-10-04T00:00:00.000Z" }), meeting({ id: "old" })],
    );
    expect(acme?.meeting?.id).toBe("new");
    expect(acme?.at).toBe("2026-10-04T00:00:00.000Z");
  });
});
