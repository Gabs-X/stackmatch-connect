import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/auth";
import { emptyJob } from "@/lib/jobs";
import { meetingContact, meetingEventFor, toIcs } from "@/lib/calendar";
import { maxReschedules, type MeetingRequest, type MeetingSide } from "@/lib/meeting-requests";
import type { Db } from "./db";
import { outbox } from "./email";
import { createJob, listCandidates } from "./jobs";
import {
  answerMeetingRequest,
  cancelMeeting,
  listReceivedBy,
  listSentBy,
  rescheduleMeeting,
  sendMeetingRequest,
  type MeetingActor,
} from "./meetings";
import { createCompany, createDeveloper, createTestDb } from "./test-db";

let db: Db;
let acme: AuthUser;
let marina: string;
let company: MeetingActor;
let developer: MeetingActor;

const now = Date.parse("2026-10-01T12:00:00-03:00");
const appUrl = "https://stackmatch.example";

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  acme = await createCompany(db, "bia@acme.com");
  marina = await createDeveloper(db, "marina@example.com", "Marina Costa");
  company = { side: "company", accountId: acme.id };
  developer = { side: "developer", accountId: marina };
});

async function propose(jobId?: string) {
  const result = await sendMeetingRequest(
    db,
    acme,
    {
      developerId: marina,
      date: "2026-10-05",
      time: "10:30",
      message: "",
      ...(jobId ? { jobId } : {}),
    },
    now,
  );
  if (!("request" in result)) throw new Error("proposal not sent");
  return result.request;
}

const move = (actor: MeetingActor, id: string, date: string, time: string, at = now) =>
  rescheduleMeeting(db, actor, id, { date, time, message: "" }, at, appUrl);

describe("moving a call", () => {
  it("lets the developer suggest another time, which the company then answers", async () => {
    const job = await createJob(db, acme.id, { ...emptyJob, title: "Backend Pleno" });
    if (!("job" in job)) throw new Error("job not created");
    const request = await propose(job.job.id);

    const moved = await rescheduleMeeting(
      db,
      developer,
      request.id,
      { date: "2026-10-06", time: "14:00", message: "Nesse dia estou viajando." },
      now,
      appUrl,
    );
    expect(moved).toMatchObject({
      request: { date: "2026-10-06", time: "14:00", status: "pending", proposedBy: "developer" },
    });
    const toCompany = outbox().at(-1);
    expect(toCompany).toMatchObject({
      to: "bia@acme.com",
      replyTo: "marina@example.com",
      subject: "Marina Costa sugeriu um novo horário para a conversa",
    });
    expect(toCompany?.text).toContain("de segunda-feira, 5 de outubro, às 10:30 para terça-feira");
    expect(toCompany?.text).toContain("> Nesse dia estou viajando.");
    expect(toCompany?.text).toContain(`${appUrl}/proposals`);

    // The side that proposed the time doesn't answer it.
    expect(await answerMeetingRequest(db, developer, request.id, "accepted", now, appUrl)).toEqual({
      error: "own-proposal",
    });
    const accepted = await answerMeetingRequest(db, company, request.id, "accepted", now, appUrl);
    expect(accepted).toHaveProperty("request.status", "accepted");
    const toDeveloper = outbox().at(-1);
    expect(toDeveloper).toMatchObject({
      to: "marina@example.com",
      replyTo: "bia@acme.com",
      subject: "Acme aceitou o horário que você sugeriu",
    });
    expect(toDeveloper?.text).toContain(`${appUrl}/interests`);
    const ics = toDeveloper?.attachments?.[0]?.content ?? "";
    expect(ics).toContain("SEQUENCE:1");
    expect(ics).toContain("DTSTART:20261006T170000Z");
    expect(ics).toContain("SUMMARY:Conversa com Acme (StackMatch)");
    expect((await listCandidates(db, acme.id, job.job.id))?.[0]?.stage).toBe("meeting");
  });

  it("moves an accepted call back to waiting, by either side, up to the limit", async () => {
    const request = await propose();
    await answerMeetingRequest(db, developer, request.id, "accepted", now, appUrl);
    expect(await move(company, request.id, "2026-10-07", "09:00")).toMatchObject({
      request: { status: "pending", proposedBy: "company", reschedules: 1 },
    });
    expect(outbox().at(-1)?.to).toBe("marina@example.com");
    expect(outbox().at(-1)?.text).toContain(`${appUrl}/interests`);

    expect(await move(company, request.id, "2026-10-07", "09:00")).toEqual({
      error: "same-time",
    });
    expect(await move(company, request.id, "2026-09-30", "09:00")).toEqual({
      error: "time-passed",
    });
    const other = await createCompany(db, "rh@globex.com", "Globex");
    expect(
      await move({ side: "company", accountId: other.id }, request.id, "2026-10-08", "09:00"),
    ).toEqual({ error: "unknown-meeting" });

    await move(developer, request.id, "2026-10-08", "09:00");
    await move(company, request.id, "2026-10-09", "09:00");
    expect(await move(developer, request.id, "2026-10-12", "09:00")).toEqual({
      error: "reschedule-limit",
    });
    expect((await listSentBy(db, acme.id))[0]?.reschedules).toBe(maxReschedules);
  });

  it("lets a declined or expired call get a new time, but not one that already happened", async () => {
    const declined = await propose();
    await answerMeetingRequest(db, developer, declined.id, "declined", now, appUrl);
    expect(await move(company, declined.id, "2026-10-05", "10:30")).toHaveProperty(
      "request.status",
      "pending",
    );

    const start = Date.parse("2026-10-05T10:30:00-03:00");
    // Waiting when its time came: it expired, and a new time revives it.
    expect(await move(developer, declined.id, "2026-10-06", "09:00", start)).toHaveProperty(
      "request.proposedBy",
      "developer",
    );

    const accepted = await propose();
    await answerMeetingRequest(db, developer, accepted.id, "accepted", now, appUrl);
    expect(await move(company, accepted.id, "2026-10-08", "09:00", start)).toEqual({
      error: "started",
    });
  });
});

describe("calendar entries", () => {
  /** The .ics without DTSTAMP, which only says when the file was made. */
  const withoutStamp = (ics: string) => ics.replace(/DTSTAMP:\d{8}T\d{6}Z\r\n/, "");
  const download = (meeting: MeetingRequest, side: MeetingSide) =>
    toIcs(
      meetingEventFor(meeting, side, "pt", meetingContact(meeting, side, meeting.developerEmail)),
    );

  it("gives the company the same event as the acceptance e-mail, developer's contact included", async () => {
    const request = await propose();
    // Before the developer accepts, the company's list doesn't carry their e-mail.
    expect((await listSentBy(db, acme.id))[0]).not.toHaveProperty("developerEmail");

    await answerMeetingRequest(db, developer, request.id, "accepted", now, appUrl);
    const attached = outbox().at(-1)?.attachments?.[0]?.content ?? "";
    expect(attached).toContain("Contato: Marina Costa <marina@example.com>");

    const [sent] = await listSentBy(db, acme.id);
    expect(sent?.developerEmail).toBe("marina@example.com");
    expect(withoutStamp(download(sent!, "company"))).toBe(withoutStamp(attached));
    // The developer's own list never carries it.
    expect((await listReceivedBy(db, marina))[0]).not.toHaveProperty("developerEmail");

    // Moved, it waits again, and the e-mail goes back out of the company's list.
    await move(company, request.id, "2026-10-07", "09:00");
    expect((await listSentBy(db, acme.id))[0]).not.toHaveProperty("developerEmail");
  });

  it("gives the developer the same event as the e-mail of a time the company accepted", async () => {
    const request = await propose();
    await move(developer, request.id, "2026-10-06", "14:00");
    await answerMeetingRequest(db, company, request.id, "accepted", now, appUrl);
    const attached = outbox().at(-1)?.attachments?.[0]?.content ?? "";
    const [received] = await listReceivedBy(db, marina);
    expect(withoutStamp(download(received!, "developer"))).toBe(withoutStamp(attached));
    expect(attached).toContain("UID:" + request.id + "@stackmatch");
    expect(attached).toContain("SEQUENCE:1");
  });
});

describe("canceling a call", () => {
  it("cancels a call ahead, tells the other side and closes it", async () => {
    const request = await propose();
    await answerMeetingRequest(db, developer, request.id, "accepted", now, appUrl);
    const canceled = await cancelMeeting(
      db,
      company,
      request.id,
      "A vaga foi preenchida.",
      now,
      appUrl,
    );
    expect(canceled).toMatchObject({
      request: {
        status: "canceled",
        canceledBy: "company",
        updateMessage: "A vaga foi preenchida.",
      },
    });
    const email = outbox().at(-1);
    expect(email).toMatchObject({ to: "marina@example.com", subject: "Acme cancelou a conversa" });
    expect(email?.text).toContain("> A vaga foi preenchida.");

    expect(await cancelMeeting(db, developer, request.id, "", now, appUrl)).toEqual({
      error: "closed",
    });
    expect(await move(developer, request.id, "2026-10-06", "09:00")).toEqual({ error: "closed" });
    expect(await answerMeetingRequest(db, developer, request.id, "accepted", now, appUrl)).toEqual({
      error: "already-answered",
    });
  });

  it("lets the developer cancel, but not once the call started", async () => {
    const request = await propose();
    const start = Date.parse("2026-10-05T10:30:00-03:00");
    expect(await cancelMeeting(db, developer, request.id, "", start, appUrl)).toEqual({
      error: "started",
    });
    expect(await cancelMeeting(db, developer, request.id, "", now, appUrl)).toHaveProperty(
      "request.canceledBy",
      "developer",
    );
    expect(outbox().at(-1)).toMatchObject({
      to: "bia@acme.com",
      subject: "Marina Costa cancelou a conversa",
    });
  });
});
