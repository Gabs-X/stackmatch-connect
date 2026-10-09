import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarCheck, CalendarX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ptBR, enUS } from "react-day-picker/locale";
import { useI18n } from "@/lib/i18n";
import { AddToCalendar } from "@/components/add-to-calendar";
import { meetingEventFor } from "@/lib/calendar";
import { isMeetingExpired, meetingStart, type MeetingRequest } from "@/lib/meeting-requests";
import { answerMeetingRequestFn, receivedMeetingRequestsQuery } from "@/lib/meetings-api";
import { cn } from "@/lib/utils";

/** The time and message a company proposed for a call. */
export function MeetingProposal({
  meeting,
  className,
}: {
  meeting: MeetingRequest;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const locale = lang === "pt" ? ptBR : enUS;
  return (
    <div className={cn("rounded-lg bg-muted/60 p-4 text-sm", className)}>
      <p className="font-medium">
        {t.interests.proposedFor(
          `${format(new Date(`${meeting.date}T12:00:00`), t.interests.dateFormat, { locale })}, ${t.interests.at} ${meeting.time}`,
        )}
      </p>
      {meeting.message && (
        <p className="mt-2 whitespace-pre-line text-muted-foreground">{meeting.message}</p>
      )}
    </div>
  );
}

/**
 * The developer's answer to a proposal: buttons while it waits, then what they chose. The company
 * hears back by e-mail either way.
 */
export function MeetingAnswer({
  meeting,
  accountId,
}: {
  meeting: MeetingRequest;
  accountId: string;
}) {
  const { t, lang } = useI18n();
  const texts = t.meetingAnswer;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (isMeetingExpired(meeting))
    return (
      <p className="mt-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarX className="size-4" aria-hidden="true" />
        {texts.expired}
      </p>
    );
  if (meeting.status === "accepted")
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="mr-auto flex items-center gap-2 text-sm font-medium text-positive">
          <CalendarCheck className="size-4" aria-hidden="true" />
          {texts.accepted}
        </p>
        {/* Until the call starts, it can still go in the calendar. */}
        {meetingStart(meeting.date, meeting.time) > Date.now() && (
          <AddToCalendar
            event={meetingEventFor(meeting, "developer", lang, {
              name: meeting.contactName,
              email: meeting.email,
            })}
          />
        )}
      </div>
    );
  if (meeting.status === "declined")
    return (
      <p className="mt-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarX className="size-4" aria-hidden="true" />
        {texts.declined}
      </p>
    );
  const answer = async (value: "accepted" | "declined") => {
    setBusy(true);
    try {
      const result = await answerMeetingRequestFn({ data: { id: meeting.id, answer: value } });
      if ("error" in result && result.error === "expired") {
        toast.error(texts.expired);
        return;
      }
      if ("error" in result && result.error !== "already-answered") throw new Error(result.error);
      toast.success(value === "accepted" ? texts.acceptedToast : texts.declinedToast);
    } catch {
      toast.error(texts.error);
    } finally {
      await queryClient.invalidateQueries({
        queryKey: receivedMeetingRequestsQuery(accountId).queryKey,
      });
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm text-muted-foreground">{texts.pending}</p>
      <Button size="sm" disabled={busy} onClick={() => void answer("accepted")}>
        <CalendarCheck />
        {texts.accept}
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void answer("declined")}>
        <CalendarX />
        {texts.decline}
      </Button>
    </div>
  );
}
