import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { googleCalendarUrl, icsFileName, toIcs, type CalendarEvent } from "@/lib/calendar";
import { useI18n } from "@/lib/i18n";

/** Saves an accepted call in the person's calendar: Google Calendar, or an .ics for any other. */
export function AddToCalendar({ event }: { event: CalendarEvent }) {
  const { t } = useI18n();
  const download = () => {
    const url = URL.createObjectURL(new Blob([toIcs(event)], { type: "text/calendar" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = icsFileName;
    link.click();
    // Some browsers start the download after click() returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarPlus />
          {t.calendar.add}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            {t.calendar.google}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={download}>
          <Download />
          {t.calendar.ics}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
