import { describe, expect, it } from "vitest";
import { SCORE, killAward, escapePenalty, applyScoreDelta } from "../../src/rules/scoring";

describe("scoring rules", () => {
  it("awards the documented points per kill type", () => {
    expect(killAward(false)).toBe(100);
    expect(killAward(true)).toBe(500);
    expect(SCORE.megaHit).toBe(50);
  });

  it("penalizes escapes harder for megas", () => {
    expect(escapePenalty(false)).toBe(-50);
    expect(escapePenalty(true)).toBe(-200);
    expect(escapePenalty(true)).toBeLessThan(escapePenalty(false));
  });

  it("applies deltas additively", () => {
    expect(applyScoreDelta(0, 100)).toBe(100);
    expect(applyScoreDelta(100, 500)).toBe(600);
    expect(applyScoreDelta(300, -50)).toBe(250);
  });

  it("floors the score at 0 — bad runs can't go negative", () => {
    expect(applyScoreDelta(0, -50)).toBe(0);
    expect(applyScoreDelta(30, -200)).toBe(0);
    expect(applyScoreDelta(200, -200)).toBe(0);
  });
});
