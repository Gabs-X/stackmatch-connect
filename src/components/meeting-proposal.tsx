import { format } from "date-fns";
import { ptBR, enUS } from "react-day-picker/locale";
import { useI18n } from "@/lib/i18n";
import type { MeetingRequest } from "@/lib/meeting-requests";
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
