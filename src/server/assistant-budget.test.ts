import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assistantBudgetWait,
  budgetMonth,
  defaultAssistantBudgetUsd,
  recordAssistantSpend,
  usageCostMicros,
} from "./assistant-budget";
import type { Db } from "./db";
import { outbox } from "./email";
import { createTestDb } from "./test-db";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  outbox().length = 0;
  vi.stubEnv("ASSISTANT_MONTHLY_BUDGET_USD", "1");
  vi.stubEnv("SUPPORT_EMAIL", "suporte@stackmatch.test");
});

// 31/10 at 23:00 in Brasília is already November in UTC.
const lateOctober = Date.parse("2026-10-31T23:00:00-03:00");

/** Usage that costs `dollars` (output tokens at US$ 25 per million). */
const costing = (dollars: number) => ({ output_tokens: dollars * 40_000 });

describe("assistant budget", () => {
  it("prices each kind of token", () => {
    expect(
      usageCostMicros({
        input_tokens: 1000,
        output_tokens: 100,
        cache_creation_input_tokens: 2,
        cache_read_input_tokens: 9001,
      }),
    ).toBe(5000 + 2500 + 12.5 + 4500.5);
    expect(usageCostMicros({})).toBe(0);
  });

  it("counts months in Brasília time", () => {
    expect(budgetMonth(lateOctober)).toBe("2026-10");
    expect(budgetMonth(Date.parse("2026-11-01T00:00:00-03:00"))).toBe("2026-11");
  });

  it("pauses the assistant until next month once the budget is spent", async () => {
    await recordAssistantSpend(db, costing(0.5), lateOctober);
    expect(await assistantBudgetWait(db, lateOctober)).toBe(0);

    await recordAssistantSpend(db, costing(0.5), lateOctober);
    expect(await assistantBudgetWait(db, lateOctober)).toBe(3600);
    expect(await assistantBudgetWait(db, lateOctober + 3600_000)).toBe(0);
  });

  it("e-mails support once when the month crosses each alert", async () => {
    await recordAssistantSpend(db, costing(0.7), lateOctober);
    expect(outbox()).toHaveLength(0);
    await recordAssistantSpend(db, costing(0.1), lateOctober);
    expect(outbox().at(-1)).toMatchObject({
      to: "suporte@stackmatch.test",
      subject: "A Ada usou 80% do teto de gastos do mês",
    });
    await recordAssistantSpend(db, costing(0.1), lateOctober);
    expect(outbox()).toHaveLength(1);
    await recordAssistantSpend(db, costing(0.2), lateOctober);
    expect(outbox()).toHaveLength(2);
    expect(outbox().at(-1)?.subject).toBe("A Ada atingiu o teto de gastos do mês");
    expect(outbox().at(-1)?.text).toContain("US$ 1.10 de US$ 1.00");
  });

  it("falls back to the default budget", async () => {
    vi.stubEnv("ASSISTANT_MONTHLY_BUDGET_USD", "");
    await recordAssistantSpend(db, costing(defaultAssistantBudgetUsd - 1), lateOctober);
    expect(await assistantBudgetWait(db, lateOctober)).toBe(0);
    await recordAssistantSpend(db, costing(1), lateOctober);
    expect(await assistantBudgetWait(db, lateOctober)).toBeGreaterThan(0);
  });
});
