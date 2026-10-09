import { dictionaries, type Lang } from "./i18n";
import { meetingDurationMinutes, meetingStart, type MeetingRequest } from "./meeting-requests";

/**
 * Calendar entries for an accepted call: an .ics file (any calendar app imports it, and the
 * company gets it attached to the acceptance e-mail) and a Google Calendar link. Both sides get
 * the same event, by the proposal's id, so importing it twice updates it instead of doubling it.
 */
export type CalendarEvent = {
  /** Stable across both sides and repeated downloads. */
  uid: string;
  title: string;
  description: string;
  /** UTC, in ms. */
  start: number;
  end: number;
};

export function meetingEvent(
  meeting: Pick<MeetingRequest, "id" | "date" | "time">,
  title: string,
  description: string,
): CalendarEvent {
  const start = meetingStart(meeting.date, meeting.time);
  return {
    uid: `${meeting.id}@stackmatch`,
    title,
    description,
    start,
    end: start + meetingDurationMinutes * 60_000,
  };
}

/**
 * The call as one side sees it: titled with the other side's name, with the job and, when known,
 * where to reach them.
 */
export function meetingEventFor(
  meeting: Pick<MeetingRequest, "id" | "date" | "time" | "developerName" | "company"> & {
    job?: { title: string } | undefined;
  },
  side: "company" | "developer",
  language: Lang,
  contact?: { name: string; email: string },
) {
  const t = dictionaries[language].calendar;
  return meetingEvent(
    meeting,
    t.title(side === "company" ? meeting.developerName : meeting.company),
    [
      t.intro,
      ...(meeting.job ? [t.job(meeting.job.title)] : []),
      ...(contact ? [t.contact(contact.name, contact.email)] : []),
    ].join("\n"),
  );
}

/** 20261002T133000Z */
const utcStamp = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** Text values escape backslashes, semicolons, commas and line breaks (RFC 5545, 3.3.11). */
const escapeText = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets continue on the next one, after a space (RFC 5545, 3.1). */
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length ? 74 : 75;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = "";
    }
    current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The event as an iCalendar file. PUBLISH: a calendar entry, not an invitation asking for RSVPs. */
export function toIcs(event: CalendarEvent, now = Date.now()) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StackMatch//Meetings//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(event.start)}`,
    `DTEND:${utcStamp(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}

/** Opens Google Calendar's new-event form filled with the event. */
export function googleCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.start)}/${utcStamp(event.end)}`,
    details: event.description,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export const icsFileName = "conversa-stackmatch.ics";
