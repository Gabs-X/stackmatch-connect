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

  const at = Date.parse("2026-09-30T12:00:00Z");
  const icsOf = (title: string, description: string) => ({
    ics: toIcs({ ...meetingEventFor(meeting, "company", "pt"), title, description }, at),
  });
  /** The value of a property, with folded lines joined back. */
  const property = (ics: string, name: string) =>
    ics
      .replace(/\r\n /g, "")
      .split("\r\n")
      .find((line) => line.startsWith(`${name}:`))
      ?.slice(name.length + 1);

  it("turns every kind of line break, a lone CR included, into an escaped \\n", () => {
    const { ics } = icsOf("Conversa\rcom Acme", "linha 1\rlinha 2\r\nlinha 3\nlinha 4\r\rfim");
    expect(property(ics, "SUMMARY")).toBe("Conversa\\ncom Acme");
    expect(property(ics, "DESCRIPTION")).toBe("linha 1\\nlinha 2\\nlinha 3\\nlinha 4\\n\\nfim");
    // No raw CR or LF is left to start a line the calendar would misread.
    for (const line of ics.split("\r\n").slice(0, -1)) expect(line).not.toMatch(/[\r\n]/);
    expect(ics.split("\r\n").filter((line) => line.startsWith("END:VEVENT"))).toHaveLength(1);
  });

  it("drops control characters TEXT doesn't allow, keeping tabs and the escapes", () => {
    const { ics } = icsOf(
      "Acme\u0000\u0007",
      "a\u0001b\u0008c\u000Bd\u000Ce\u001Bf\u001Fg\u007Fh\ti \\ back; semi, comma",
    );
    expect(property(ics, "SUMMARY")).toBe("Acme");
    expect(property(ics, "DESCRIPTION")).toBe("abcdefgh\ti \\\\ back\\; semi\\, comma");
    // eslint-disable-next-line no-control-regex -- checking none is left
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\x00-\x08\x0A-\x1F\x7F]/);
  });

  it("keeps accents and emoji whole when folding at 75 octets", () => {
    const text = "Ação, café e conversa com João 🚀👩‍💻 ".repeat(6).trim();
    const { ics } = icsOf(`Conversa com ${text}`, text);
    const encoder = new TextEncoder();
    const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    const lines = ics.split("\r\n");
    expect(lines.filter((line) => line.startsWith(" ")).length).toBeGreaterThan(4);
    for (const line of lines) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      // Each line stands as valid UTF-8 on its own: no character is split between two.
      expect(loneSurrogate.test(line)).toBe(false);
      expect(() =>
        new TextDecoder("utf-8", { fatal: true }).decode(encoder.encode(line)),
      ).not.toThrow();
    }
    expect(property(ics, "DESCRIPTION")).toBe(text.replace(/,/g, "\\,"));
    expect(property(ics, "SUMMARY")).toBe(`Conversa com ${text}`.replace(/,/g, "\\,"));
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("links to Google Calendar's form", () => {
    const url = new URL(googleCalendarUrl(meetingEventFor(meeting, "company", "pt")));
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20261002T133000Z/20261002T140000Z");
    expect(url.searchParams.get("text")).toBe("Conversa com Marina Costa (StackMatch)");
  });
});
