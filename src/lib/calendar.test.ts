import { describe, expect, it } from "vitest";
import { googleCalendarUrl, meetingEventFor, toIcs } from "./calendar";

const meeting = {
  id: "abc",
  date: "2026-10-02",
  time: "10:30",
  developerName: "Marina Costa",
  company: "Acme, Ltda.",
  job: { title: "Backend Pleno" },
};

describe("calendar", () => {
  it("titles the call with the other side and times it in UTC, 30 minutes long", () => {
    const event = meetingEventFor(meeting, "developer", "pt", {
      name: "Bia",
      email: "bia@acme.com",
    });
    expect(event).toMatchObject({
      uid: "abc@stackmatch",
      title: "Conversa com Acme, Ltda. (StackMatch)",
      start: Date.parse("2026-10-02T13:30:00Z"),
      end: Date.parse("2026-10-02T14:00:00Z"),
    });
    expect(event.description).toContain("Vaga: Backend Pleno\nContato: Bia <bia@acme.com>");
    expect(meetingEventFor(meeting, "company", "en").title).toBe(
      "Call with Marina Costa (StackMatch)",
    );
  });

  it("writes an iCalendar file with escaped and folded text", () => {
    const event = meetingEventFor(meeting, "developer", "pt");
    const ics = toIcs(event, Date.parse("2026-09-30T12:00:00Z"));
    expect(ics).toContain("METHOD:PUBLISH\r\n");
    expect(ics).toContain("DTSTAMP:20260930T120000Z\r\n");
    expect(ics).toContain("DTSTART:20261002T133000Z\r\nDTEND:20261002T140000Z\r\n");
    expect(ics).toContain("SUMMARY:Conversa com Acme\\, Ltda. (StackMatch)\r\n");
    expect(ics).toContain("\\nVaga: Backend Pleno");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n"))
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    // Unfolding gives back the description line.
    expect(ics.replace(/\r\n /g, "")).toContain(
      "DESCRIPTION:Conversa combinada pelo StackMatch. O link da chamada é combinado por e-mail.\\nVaga: Backend Pleno\r\n",
    );
  });

  it("links to Google Calendar's form", () => {
    const url = new URL(googleCalendarUrl(meetingEventFor(meeting, "company", "pt")));
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261002T133000Z/20261002T140000Z");
    expect(url.searchParams.get("text")).toBe("Conversa com Marina Costa (StackMatch)");
  });
});
