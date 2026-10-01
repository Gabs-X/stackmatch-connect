import { describe, expect, it } from "vitest";
import { canUndo, createHistoryEntry } from "./discover-history";

const marina = { id: "marina-costa", name: "Marina Costa" };

describe("createHistoryEntry", () => {
  it("records nothing to revert when passing", () => {
    expect(createHistoryEntry(marina, "pass", 2, [], [])).toEqual({
      id: "marina-costa",
      name: "Marina Costa",
      index: 2,
      addedSaved: false,
      addedInterest: false,
    });
  });

  it("records a new save", () => {
    const entry = createHistoryEntry(marina, "save", 0, [], []);
    expect(entry.addedSaved).toBe(true);
    expect(entry.addedInterest).toBe(false);
  });

  it("records interest as both a save and an interest", () => {
    const entry = createHistoryEntry(marina, "interest", 0, [], []);
    expect(entry.addedSaved).toBe(true);
    expect(entry.addedInterest).toBe(true);
  });

  it("doesn't claim a save or interest that already existed, so undo keeps them", () => {
    const entry = createHistoryEntry(marina, "interest", 0, ["marina-costa"], ["marina-costa"]);
    expect(entry.addedSaved).toBe(false);
    expect(entry.addedInterest).toBe(false);
  });
});

describe("canUndo", () => {
  const first = createHistoryEntry(marina, "save", 0, [], []);
  const second = createHistoryEntry({ id: "rafael-lima", name: "Rafael Lima" }, "pass", 1, [], []);

  it("allows undoing only the latest decision", () => {
    expect(canUndo(second, [first, second])).toBe(true);
    expect(canUndo(first, [first, second])).toBe(false);
  });

  it("rejects entries from a cleared history", () => {
    expect(canUndo(first, [])).toBe(false);
    expect(canUndo(undefined, [first])).toBe(false);
  });
});
