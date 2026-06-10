import { describe, expect, it } from "vitest";
import { dueMegaCues, isLevelCleared } from "../../src/rules/progression";
import type { MegaSpawnCue } from "../../src/levels/levels";

describe("dueMegaCues", () => {
  const schedule: MegaSpawnCue[] = [{ atKill: 4 }, { atKill: 11 }, { atKill: 18 }];

  it("fires nothing before the first cue", () => {
    expect(dueMegaCues(schedule, 0, 0)).toBe(0);
    expect(dueMegaCues(schedule, 0, 3)).toBe(0);
  });

  it("fires a cue exactly at its kill threshold", () => {
    expect(dueMegaCues(schedule, 0, 4)).toBe(1);
  });

  it("does not refire consumed cues", () => {
    // After the first cue is consumed (nextCueIdx=1), the same kill count
    // doesn't owe another mega.
    expect(dueMegaCues(schedule, 1, 5)).toBe(0);
    expect(dueMegaCues(schedule, 1, 11)).toBe(1);
  });

  it("fires multiple cues at once after a kill burst (area blast)", () => {
    expect(dueMegaCues(schedule, 0, 18)).toBe(3);
    expect(dueMegaCues(schedule, 1, 18)).toBe(2);
  });

  it("handles empty schedules and exhausted indices", () => {
    expect(dueMegaCues([], 0, 100)).toBe(0);
    expect(dueMegaCues(schedule, 3, 100)).toBe(0);
  });
});

describe("isLevelCleared", () => {
  it("clears exactly at the threshold", () => {
    expect(isLevelCleared(7, 8)).toBe(false);
    expect(isLevelCleared(8, 8)).toBe(true);
    expect(isLevelCleared(9, 8)).toBe(true);
  });
});
