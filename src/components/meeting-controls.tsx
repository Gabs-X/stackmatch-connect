import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, isBefore, isWeekend, startOfDay } from "date-fns";
import { enUS, ptBR } from "react-day-picker/locale";
import {
  CalendarCheck,
  CalendarClock,
  CalendarSync,
  CalendarX,
  Clock,
  Clock3,
  Send,
  X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { meetingContact, meetingEventFor } from "@/lib/calendar";
import { useI18n } from "@/lib/i18n";
import { jobsQueryKey } from "@/lib/jobs-api";
import {
  isMeetingExpired,
  isProposedTimeValid,
  maxReschedules,
  meetingStart,
  meetingTimes,
  type MeetingRequest,
  type MeetingSide,
} from "@/lib/meeting-requests";
import { answerMeetingRequestFn, cancelMeetingFn, rescheduleMeetingFn } from "@/lib/meetings-api";
import { cn } from "@/lib/utils";

type ChangeError =
  | "unknown-meeting"
  | "already-answered"
  | "expired"
  | "own-proposal"
  | "closed"
  | "started"
  | "time-passed"
  | "same-time"
  | "reschedule-limit"
  | "changed";

/**
 * Where a call stands for one side, and what that side can do with it: answer a time the other
 * side proposed, move the call to another time, cancel it, or put it in the calendar.
 */
export function MeetingControls({ meeting, side }: { meeting: MeetingRequest; side: MeetingSide }) {
  const { t, lang } = useI18n();
  const texts = t.meetingAnswer;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | null>(null);
  const other = side === "company" ? meeting.developerName : meeting.company;
  const proposer = meeting.proposedBy === side ? texts.you : other;
  const start = meetingStart(meeting.date, meeting.time);
  // When the call starts, what can be done with it changes: render again then, for a page left open.
  const [startTimer, setStartTimer] = useState(0);
  useEffect(() => {
    const wait = start - Date.now();
    if (!(wait > 0)) return;
    // Longer waits than setTimeout takes are made in steps.
    const timer = window.setTimeout(() => setStartTimer((n) => n + 1), Math.min(wait, 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [start, startTimer]);
  const expired = isMeetingExpired(meeting);
  const started = start <= Date.now();
  const myTurn = meeting.status === "pending" && meeting.proposedBy !== side && !expired;
  const canReschedule =
    meeting.status !== "canceled" &&
    !(meeting.status === "accepted" && started) &&
    meeting.reschedules < maxReschedules;
  const canCancel = (meeting.status === "pending" || meeting.status === "accepted") && !started;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["meeting-requests"] });
    // Accepting moves the developer in the job.
    if (side === "company") await queryClient.invalidateQueries({ queryKey: jobsQueryKey });
  };
  const failed = (error: ChangeError) => {
    toast.error(
      error in texts.errors ? texts.errors[error as keyof typeof texts.errors] : texts.error,
    );
  };

  const answer = async (value: "accepted" | "declined") => {
    setBusy(true);
    try {
      const result = await answerMeetingRequestFn({ data: { id: meeting.id, answer: value } });
      if ("error" in result) {
        if (result.error !== "already-answered") failed(result.error);
        return;
      }
      toast.success(value === "accepted" ? texts.acceptedToast(other) : texts.declinedToast(other));
    } catch {
      toast.error(texts.error);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const status = (() => {
    if (meeting.status === "canceled")
      return {
        icon: CalendarX,
        tone: "text-muted-foreground",
        text: meeting.canceledBy === side ? texts.canceledByYou : texts.canceledBy(other),
      };
    if (expired) return { icon: CalendarClock, tone: "text-muted-foreground", text: texts.expired };
    if (meeting.status === "accepted")
      return {
        icon: CalendarCheck,
        tone: "text-positive",
        text: meeting.proposedBy === side ? texts.acceptedByOther(other) : texts.accepted,
      };
    if (meeting.status === "declined")
      return {
        icon: CalendarX,
        tone: "text-muted-foreground",
        text: meeting.proposedBy === side ? texts.declinedByOther(other) : texts.declined,
      };
    return {
      icon: Clock,
      tone: "text-muted-foreground",
      text: myTurn ? texts.pending : texts.waitingFor(other),
    };
  })();
  const StatusIcon = status.icon;

  return (
    <div className="mt-3 space-y-3">
      {meeting.reschedules > 0 && meeting.status !== "canceled" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarSync className="size-4 shrink-0" aria-hidden="true" />
          {texts.rescheduledBy(proposer)}
        </p>
      )}
      {meeting.updateMessage && (meeting.reschedules > 0 || meeting.status === "canceled") && (
        <blockquote className="whitespace-pre-line border-l-2 pl-3 text-sm text-muted-foreground">
          {meeting.updateMessage}
        </blockquote>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <p className={cn("mr-auto flex items-center gap-2 text-sm font-medium", status.tone)}>
          <StatusIcon className="size-4 shrink-0" aria-hidden="true" />
          {status.text}
        </p>
        {myTurn && (
          <>
            <Button size="sm" disabled={busy} onClick={() => void answer("accepted")}>
              <CalendarCheck />
              {texts.accept}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void answer("declined")}
            >
              <CalendarX />
              {texts.decline}
            </Button>
          </>
        )}
        {meeting.status === "accepted" && !started && (
          <AddToCalendar
            event={meetingEventFor(
              meeting,
              side,
              lang,
              meetingContact(meeting, side, meeting.developerEmail),
            )}
          />
        )}
        {canReschedule && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setDialog("reschedule")}
          >
            <CalendarSync />
            {myTurn ? texts.suggest : texts.reschedule}
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setDialog("cancel")}
            className="text-destructive hover:text-destructive"
          >
            <X />
            {texts.cancel}
          </Button>
        )}
      </div>
      <RescheduleDialog
        open={dialog === "reschedule"}
        meeting={meeting}
        other={other}
        onClose={() => setDialog(null)}
        onDone={refresh}
        onError={failed}
      />
      <CancelDialog
        open={dialog === "cancel"}
        meeting={meeting}
        other={other}
        onClose={() => setDialog(null)}
        onDone={refresh}
        onError={failed}
      />
    </div>
  );
}

/** Today in Brasília time, at noon, so the calendar compares days the same in any time zone. */
function brasiliaToday(now: number) {
  return startOfDay(
    new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now) + "T12:00:00",
    ),
  );
}

function RescheduleDialog({
  open,
  meeting,
  other,
  onClose,
  onDone,
  onError,
}: {
  open: boolean;
  meeting: MeetingRequest;
  other: string;
  onClose: () => void;
  onDone: () => Promise<void>;
  onError: (error: ChangeError) => void;
}) {
  const { t, lang } = useI18n();
  const texts = t.meetingAnswer;
  const id = useId();
  const locale = lang === "pt" ? ptBR : enUS;
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const today = brasiliaToday(now);
  const day = date ? format(date, "yyyy-MM-dd") : "";
  const timeValid = (slot: string) =>
    !!date &&
    isProposedTimeValid(day, slot, now) &&
    !(day === meeting.date && slot === meeting.time && meeting.status !== "declined");

  const close = () => {
    setDate(undefined);
    setTime("");
    setMessage("");
    onClose();
  };
  const send = async () => {
    if (!date || !time) return;
    setBusy(true);
    try {
      const result = await rescheduleMeetingFn({
        data: { id: meeting.id, date: day, time, message: message.trim() },
      });
      if ("error" in result) {
        onError(result.error);
        if (result.error === "time-passed") setTime("");
        else close();
        return;
      }
      toast.success(texts.rescheduledToast(other));
      close();
    } catch {
      toast.error(texts.error);
    } finally {
      await onDone();
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && close()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>{texts.rescheduleTitle}</DialogTitle>
        <DialogDescription>{texts.rescheduleDesc(other)}</DialogDescription>
        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selected) => {
              setDate(selected);
              setTime("");
            }}
            disabled={(candidate) => isBefore(candidate, today) || isWeekend(candidate)}
            fromMonth={today}
            toMonth={addDays(today, 90)}
            locale={locale}
            className="mx-auto w-full bg-transparent [--cell-size:2.3rem]"
          />
          <div>
            <p className="text-sm font-bold">{t.schedule.times}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {date ? format(date, t.schedule.dateFormat, { locale }) : t.schedule.selectDate}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-1">
              {meetingTimes.map((slot) => (
                <Button
                  key={slot}
                  type="button"
                  size="sm"
                  variant={time === slot ? "default" : "outline"}
                  disabled={!timeValid(slot)}
                  aria-pressed={time === slot}
                  onClick={() => setTime(slot)}
                >
                  <Clock3 />
                  {slot}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t.schedule.tz}</p>
          </div>
        </div>
        <div>
          <Label htmlFor={`${id}-message`}>{texts.messageLabel}</Label>
          <Textarea
            id={`${id}-message`}
            className="mt-2"
            maxLength={1000}
            value={message}
            placeholder={texts.rescheduleMessagePh}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              {texts.keep}
            </Button>
          </DialogClose>
          <Button disabled={busy || !time || !timeValid(time)} onClick={() => void send()}>
            <Send />
            {texts.sendTime}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  meeting,
  other,
  onClose,
  onDone,
  onError,
}: {
  open: boolean;
  meeting: MeetingRequest;
  other: string;
  onClose: () => void;
  onDone: () => Promise<void>;
  onError: (error: ChangeError) => void;
}) {
  const { t } = useI18n();
  const texts = t.meetingAnswer;
  const id = useId();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => {
    setMessage("");
    onClose();
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const result = await cancelMeetingFn({ data: { id: meeting.id, message: message.trim() } });
      if ("error" in result) onError(result.error);
      else toast.success(texts.canceledToast(other));
      close();
    } catch {
      toast.error(texts.error);
    } finally {
      await onDone();
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && close()}>
      <DialogContent>
        <DialogTitle>{texts.cancelTitle}</DialogTitle>
        <DialogDescription>{texts.cancelDesc(other)}</DialogDescription>
        <div>
          <Label htmlFor={`${id}-reason`}>{texts.messageLabel}</Label>
          <Textarea
            id={`${id}-reason`}
            className="mt-2"
            maxLength={1000}
            value={message}
            placeholder={texts.cancelMessagePh}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              {texts.keep}
            </Button>
          </DialogClose>
          <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
            <X />
            {texts.confirmCancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
