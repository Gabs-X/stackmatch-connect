import { useI18n } from "./i18n";
import { compensationLabel, type JobInput } from "./jobs";

/** compensationLabel in the screen's language. */
export function useCompensationLabel() {
  const { t, formatCurrency } = useI18n();
  return (job: Pick<JobInput, "compensationMin" | "compensationMax" | "compensationPeriod">) =>
    compensationLabel(job, t.jobs, formatCurrency);
}
