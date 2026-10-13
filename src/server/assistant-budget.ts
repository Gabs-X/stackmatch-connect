import { eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { assistantSpend } from "./db/schema";
import { messageEmail, sendEmail } from "./email";
import { log } from "./log";

/**
 * A monthly spending cap for the assistant. Each reply adds what its tokens cost to the month's
 * total; once the total reaches the budget, the assistant pauses until the next month (Brasília
 * time) and the route answers 503. Support gets an e-mail when the month crosses 80% and 100%.
 * The per-IP limit (assistant-throttle.ts) keeps one person from spending it alone.
 */

/** ASSISTANT_MONTHLY_BUDGET_USD, or this when it isn't set to a positive number. */
export const defaultAssistantBudgetUsd = 4;

/** The share of the budget, in percent, that e-mails support when the month crosses it. */
export const assistantBudgetAlerts = [80, 100];

/**
 * US$ per million tokens of the assistant's model (Opus). Cache writes are the 5-minute kind.
 * Replies the API finishes on a fallback model are counted at these prices too, which can only
 * overstate the spend.
 */
export const assistantPrices = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 };

export type AssistantUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** What the usage cost, in millionths of a US dollar, rounded up. */
export function usageCostMicros(usage: AssistantUsage) {
  return Math.ceil(
    (usage.input_tokens ?? 0) * assistantPrices.input +
      (usage.output_tokens ?? 0) * assistantPrices.output +
      (usage.cache_creation_input_tokens ?? 0) * assistantPrices.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * assistantPrices.cacheRead,
  );
}

export function assistantBudgetUsd() {
  const value = Number(process.env["ASSISTANT_MONTHLY_BUDGET_USD"]);
  return Number.isFinite(value) && value > 0 ? value : defaultAssistantBudgetUsd;
}

const budgetMicros = () => Math.round(assistantBudgetUsd() * 1_000_000);

/** The month in Brasília time, as "2026-10". */
export function budgetMonth(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .slice(0, 7);
}

/** Seconds until the next month starts in Brasília time (GMT−3, no daylight saving time). */
function secondsToNextMonth(now: number) {
  const [year = 0, month = 1] = budgetMonth(now).split("-").map(Number);
  return Math.max(1, Math.ceil((Date.UTC(year, month, 1, 3) - now) / 1000));
}

/** Seconds until the assistant may answer again, or 0 while the month's budget lasts. */
export async function assistantBudgetWait(db: Db, now = Date.now()) {
  const [row] = await db
    .select({ costMicros: assistantSpend.costMicros })
    .from(assistantSpend)
    .where(eq(assistantSpend.month, budgetMonth(now)));
  return (row?.costMicros ?? 0) >= budgetMicros() ? secondsToNextMonth(now) : 0;
}

/** Adds a reply's cost to the month and e-mails support when it crosses an alert. */
export async function recordAssistantSpend(db: Db, usage: AssistantUsage, now = Date.now()) {
  const cost = usageCostMicros(usage);
  if (!cost) return;
  const month = budgetMonth(now);
  const [row] = await db
    .insert(assistantSpend)
    .values({ month, costMicros: cost })
    .onConflictDoUpdate({
      target: assistantSpend.month,
      set: { costMicros: sql`${assistantSpend.costMicros} + ${cost}` },
    })
    .returning({ costMicros: assistantSpend.costMicros });
  if (!row) return;
  const budget = budgetMicros();
  // The highest alert this reply crossed, if any.
  const crossed = [...assistantBudgetAlerts]
    .reverse()
    .find(
      (percent) =>
        row.costMicros * 100 >= budget * percent &&
        (row.costMicros - cost) * 100 < budget * percent,
    );
  if (crossed) await alertSupport(month, crossed, row.costMicros);
}

const usd = (micros: number) => `US$ ${(micros / 1_000_000).toFixed(2)}`;

async function alertSupport(month: string, percent: number, spentMicros: number) {
  const budget = `US$ ${assistantBudgetUsd().toFixed(2)}`;
  const summary =
    percent >= 100
      ? `A Ada atingiu o teto de gastos de ${month}: ${usd(spentMicros)} de ${budget}. Ela fica em pausa até o mês que vem.`
      : `A Ada já gastou ${percent}% do teto de ${month}: ${usd(spentMicros)} de ${budget}.`;
  const team = process.env["SUPPORT_EMAIL"]?.trim();
  if (!team) {
    log("warn", "assistant.budget_alert", {
      summary,
      note: "Set SUPPORT_EMAIL to get this by e-mail.",
    });
    return;
  }
  try {
    await sendEmail(
      messageEmail({
        to: team,
        subject:
          percent >= 100
            ? "A Ada atingiu o teto de gastos do mês"
            : `A Ada usou ${percent}% do teto de gastos do mês`,
        paragraphs: [
          summary,
          "Para mudar o teto, altere ASSISTANT_MONTHLY_BUDGET_USD nas variáveis de ambiente da Vercel e faça um novo deploy.",
        ],
        closing: "StackMatch",
      }),
    );
  } catch (error) {
    // The spend is recorded; the cap still holds without the e-mail.
    log("error", "assistant.budget_alert_not_sent", { error });
  }
}
