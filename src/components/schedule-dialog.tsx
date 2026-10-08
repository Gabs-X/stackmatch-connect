import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { addDays, format, isBefore, isWeekend, startOfDay } from "date-fns";
import { ptBR, enUS } from "react-day-picker/locale";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Info,
  Loader2,
  Mail,
  Send,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { jobQuery, jobsQueryKey } from "@/lib/jobs-api";
import { JobDetails } from "@/components/job-details";
import { sendMeetingRequestFn, sentMeetingRequestsQuery } from "@/lib/meetings-api";
import { outreachLimits } from "@/lib/outreach";
import { useCompanySettings } from "@/lib/use-company-settings";
import { isProposedTimeValid, lastRequestTo, meetingTimes } from "@/lib/meeting-requests";

type ScheduleDialogProps = {
  developerId: string;
  developerName: string;
  triggerClassName?: string;
  /** The job the proposal is about; the developer moves to "contacted" in it. */
  jobId?: string | undefined;
};

/**
 * Lets a company propose one time for a call. StackMatch only delivers the proposal by e-mail;
 * the developer replies to the company and the meeting is arranged outside the app.
 */
export function ScheduleDialog({
  developerId,
  developerName,
  triggerClassName,
  jobId,
}: ScheduleDialogProps) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const settings = useCompanySettings();
  // Proposals are signed with the contact set in the company details; replies go to its e-mail.
  const sender = user
    ? {
        id: user.id,
        company: user.company,
        name: settings?.contactName ?? user.name,
        email: settings?.contactEmail ?? user.email,
      }
    : null;
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const sentQuery = sentMeetingRequestsQuery(user?.id ?? "");
  const { data: meetingRequests = [] } = useQuery({
    ...sentQuery,
    enabled: user?.accountType === "company" && user.emailVerified,
  });
  // The e-mail tells what the job is about, as the server will.
  const { data: job } = useQuery({
    ...jobQuery(user?.id ?? "", jobId ?? ""),
    enabled: Boolean(jobId && user),
  });
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"schedule" | "details" | "success">("schedule");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [open]);
  const today = startOfDay(
    new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now) + "T12:00:00",
    ),
  );
  const locale = lang === "pt" ? ptBR : enUS;
  const firstName = developerName.split(" ")[0] ?? developerName;
  const timeValid = (slot: string) =>
    !!date && isProposedTimeValid(format(date, "yyyy-MM-dd"), slot, now);

  const reset = () => {
    setStep("schedule");
    setDate(undefined);
    setTime("");
    setMessage("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      reset();
      setNow(Date.now());
    }
    setOpen(nextOpen);
  };

  const formattedDate = date ? format(date, t.schedule.dateFormat, { locale }) : "";
  const when = `${formattedDate}, ${t.schedule.at} ${time}`;
  const previous = user ? lastRequestTo(meetingRequests, developerId, user.id) : undefined;
  const previousWhen = previous
    ? `${format(new Date(`${previous.date}T12:00:00`), t.schedule.dateFormat, { locale })}, ${t.schedule.at} ${previous.time}`
    : "";

  const sendProposal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sender || !date || !time || sending) return;
    setSending(true);
    try {
      // The server signs the proposal with the company's contact, as the preview shows.
      const result = await sendMeetingRequestFn({
        data: {
          developerId,
          date: format(date, "yyyy-MM-dd"),
          time,
          message: message.trim(),
          ...(jobId ? { jobId } : {}),
          // The e-mail goes out as the preview shows it, in this screen's language.
          language: lang,
        },
      });
      if ("error" in result) {
        if (result.error === "time-passed") {
          toast.error(t.schedule.timePassed);
          setNow(Date.now());
          setTime("");
          setStep("schedule");
        } else if (result.error === "meeting-limit")
          toast.error(
            t.outreach.meetingLimit(
              outreachLimits.meetingsPerDay,
              t.outreach.wait(result.retryInSeconds),
            ),
          );
        else if (result.error === "developer-meeting-limit")
          toast.error(
            t.outreach.developerMeetingLimit(
              outreachLimits.meetingsPerDeveloper,
              outreachLimits.meetingsPerDeveloperDays,
              t.outreach.wait(result.retryInSeconds),
            ),
          );
        else toast.error(t.schedule.sendError);
        return;
      }
      queryClient.setQueryData(sentQuery.queryKey, (current = []) => [...current, result.request]);
      // The developer moved to "contacted" in the job.
      if (jobId) void queryClient.invalidateQueries({ queryKey: jobsQueryKey });
      setStep("success");
      toast.success(t.schedule.done, { description: when });
    } catch {
      toast.error(t.schedule.sendError);
    } finally {
      setSending(false);
    }
  };

  const gate = !user ? (
    <div className="px-6 py-10 text-center sm:px-12">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <UserRound className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{t.schedule.signInTitle}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {t.schedule.signInDesc}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/login" search={{ redirect: pathname }}>
            {t.schedule.signIn}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/register" search={{ type: "company", redirect: pathname }}>
            {t.schedule.signUp}
          </Link>
        </Button>
      </div>
    </div>
  ) : user.accountType !== "company" ? (
    <div className="px-6 py-10 text-center sm:px-12">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Info className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{t.schedule.companyOnlyTitle}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {t.schedule.companyOnlyDesc}
      </p>
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          <Send />
          {t.schedule.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-y-auto p-0 sm:max-w-3xl">
        <div className="border-b px-5 py-5 sm:px-7">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-primary">
              <Mail className="size-4" /> {t.schedule.duration}
            </div>
            <DialogTitle className="font-display text-2xl">
              {t.schedule.talkWith} {firstName}
            </DialogTitle>
            <DialogDescription>{t.schedule.desc}</DialogDescription>
          </DialogHeader>
        </div>

        {gate}

        {!gate && step === "schedule" && (
          <>
            {previous && (
              <p className="mx-5 mt-5 flex gap-2 rounded-lg border bg-muted/60 p-3 text-sm text-muted-foreground sm:mx-7">
                <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                {t.schedule.alreadySent(
                  previousWhen,
                  previous.status === "accepted"
                    ? t.meetingAnswer.companyAccepted
                    : previous.status === "declined"
                      ? t.meetingAnswer.companyDeclined
                      : t.meetingAnswer.companyPending,
                )}
              </p>
            )}
            <div className="grid gap-0 md:grid-cols-[1fr_220px]">
              <div className="border-b p-4 md:border-b-0 md:border-r sm:p-6">
                <p className="mb-3 text-sm font-bold">{t.schedule.pickDate}</p>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selected) => {
                    setDate(selected);
                    setTime("");
                  }}
                  disabled={(day) => isBefore(day, today) || isWeekend(day)}
                  fromMonth={today}
                  toMonth={addDays(today, 90)}
                  locale={locale}
                  className="pointer-events-auto mx-auto w-full bg-transparent [--cell-size:2.45rem]"
                />
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-sm font-bold">{t.schedule.times}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {date ? formattedDate : t.schedule.selectDate}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-1">
                  {meetingTimes.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      variant={time === slot ? "default" : "outline"}
                      disabled={!timeValid(slot)}
                      aria-pressed={time === slot}
                      onClick={() => setTime(slot)}
                      className="justify-center"
                    >
                      <Clock3 />
                      {slot}
                    </Button>
                  ))}
                </div>
                <Button
                  className="mt-5 w-full"
                  disabled={!time || !timeValid(time)}
                  onClick={() => setStep("details")}
                >
                  {t.schedule.next}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">{t.schedule.tz}</p>
              </div>
            </div>
          </>
        )}

        {!gate && user && step === "details" && (
          <form onSubmit={sendProposal} className="grid gap-6 p-5 md:grid-cols-[1fr_260px] sm:p-7">
            <div className="min-w-0 space-y-5">
              <p className="text-sm text-muted-foreground">
                {t.schedule.sender}{" "}
                <span className="font-semibold text-foreground">
                  {sender?.name} · {sender?.company}
                </span>
              </p>
              <div>
                <Label htmlFor="schedule-message">
                  {t.schedule.about}{" "}
                  <span className="font-normal text-muted-foreground">{t.schedule.optional}</span>
                </Label>
                <Textarea
                  id="schedule-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t.schedule.aboutPh}
                  className="mt-2 min-h-24 resize-none"
                />
              </div>
              <section aria-label={t.schedule.emailPreview} className="rounded-lg border">
                <p className="border-b px-4 py-2 text-xs font-bold uppercase text-muted-foreground">
                  {t.schedule.emailPreview}
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b px-4 py-3 text-xs">
                  <dt className="text-muted-foreground">{t.schedule.emailTo}</dt>
                  <dd className="min-w-0 break-words">{t.schedule.emailToValue(developerName)}</dd>
                  <dt className="text-muted-foreground">{t.schedule.emailReplyTo}</dt>
                  <dd className="min-w-0 break-words">{sender?.email}</dd>
                  <dt className="text-muted-foreground">{t.schedule.emailSubject}</dt>
                  <dd className="min-w-0 break-words font-semibold">
                    {t.schedule.subject(sender?.company ?? "")}
                  </dd>
                </dl>
                <div className="space-y-3 px-4 py-3 text-sm leading-6">
                  <p>{t.schedule.greeting(firstName)}</p>
                  <p>{t.schedule.intro(sender?.name ?? "", sender?.company ?? "", when)}</p>
                  {job && (
                    <div className="rounded-md border p-3">
                      <p className="font-semibold">{t.jobs.emailTitle(job.title)}</p>
                      <JobDetails job={job} className="mt-3 text-xs" />
                    </div>
                  )}
                  {message.trim() && (
                    <p className="whitespace-pre-line border-l-2 pl-3 text-muted-foreground">
                      {message.trim()}
                    </p>
                  )}
                  <p>{t.schedule.closing}</p>
                </div>
              </section>
            </div>
            <aside className="h-fit rounded-lg border bg-muted/60 p-5">
              <p className="text-xs font-bold uppercase text-muted-foreground">
                {t.schedule.summary}
              </p>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-bold first-letter:uppercase">{formattedDate}</p>
                    <p className="text-muted-foreground">
                      {t.schedule.at} {time}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-bold">{t.schedule.minutes}</p>
                    <p className="text-muted-foreground">{t.schedule.tzShort}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-bold">{t.schedule.byEmail}</p>
                    <p className="text-muted-foreground">{t.schedule.byEmailSub}</p>
                  </div>
                </div>
              </div>
              <Button type="submit" className="mt-6 w-full" disabled={sending}>
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
                {sending ? t.schedule.sending : t.schedule.send}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full"
                disabled={sending}
                onClick={() => setStep("schedule")}
              >
                <ArrowLeft />
                {t.schedule.change}
              </Button>
            </aside>
          </form>
        )}

        {!gate && user && step === "success" && (
          <div className="px-6 py-10 text-center sm:px-12 sm:py-14">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-positive-soft text-positive">
              <Check className="size-7" />
            </div>
            <h3 className="mt-5 font-display text-2xl font-bold">{t.schedule.done}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {t.schedule.doneDesc(developerName, when)}
            </p>
            <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 rounded-lg border bg-muted/60 p-4 text-left text-sm">
              <Mail className="size-5 shrink-0 text-primary" />
              <span>
                {t.schedule.replyNote} <strong className="break-all">{sender?.email}</strong>.
              </span>
            </div>
            <p className="mx-auto mt-4 max-w-md text-xs text-muted-foreground">
              {t.schedule.sentNote(developerName)}
            </p>
            <Button className="mt-7" onClick={() => handleOpenChange(false)}>
              {t.schedule.finish}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
