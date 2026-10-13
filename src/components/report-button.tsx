import { Flag } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { reportReasons, type ReportReason, type ReportTarget } from "@/lib/moderation";
import { fileReportFn } from "@/lib/moderation-api";

/**
 * Lets a signed-in, confirmed account report a job, a profile or a company to the team. Not shown
 * to visitors nor on the account's own content.
 */
export function ReportButton({
  targetType,
  targetId,
  /** The account the content belongs to, to hide the button on one's own. */
  ownerId,
  label,
  className,
}: {
  targetType: ReportTarget;
  targetId: string;
  ownerId: string;
  /** What is reported, for the button's accessible name. */
  label: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const ids = { reason: useId(), details: useId() };
  if (!user?.emailVerified || user.id === ownerId) return null;

  const send = async () => {
    setSending(true);
    try {
      const result = await fileReportFn({
        data: { accountId: user.id, targetType, targetId, reason, details },
      });
      if ("error" in result) {
        toast.error(t.moderation.errors[result.error] ?? t.moderation.errors["unknown"]);
        return;
      }
      toast.success(t.moderation.sent);
      setOpen(false);
      setDetails("");
    } catch {
      toast.error(t.moderation.errors["unknown"]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={className}
        aria-label={`${t.moderation.report}: ${label}`}
        onClick={() => setOpen(true)}
      >
        <Flag />
        {t.moderation.report}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t.moderation.reportTitle[targetType]}</DialogTitle>
          <DialogDescription>{t.moderation.reportSub}</DialogDescription>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={ids.reason}>{t.moderation.reason}</Label>
              <select
                id={ids.reason}
                value={reason}
                onChange={(event) => setReason(event.target.value as ReportReason)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {reportReasons.map((option) => (
                  <option key={option} value={option}>
                    {t.moderation.reasons[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.details}>{t.moderation.details}</Label>
              <Textarea
                id={ids.details}
                value={details}
                maxLength={1000}
                onChange={(event) => setDetails(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t.account.cancel}
            </Button>
            <Button disabled={sending} onClick={() => void send()}>
              {t.moderation.send}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
