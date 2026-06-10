import { describe, expect, it } from "vitest";
import { LEVELS, STRESS_TUNING, tuningForLevel } from "../../src/levels/levels";

describe("tuningForLevel", () => {
  it("returns the explicit table entries for L1–L5", () => {
    for (let level = 1; level <= LEVELS.length; level++) {
      expect(tuningForLevel(level)).toBe(LEVELS[level - 1]);
    }
  });

  it("extrapolates beyond the table without mutating the base entry", () => {
    const baseBefore = structuredClone(LEVELS[LEVELS.length - 1]);
    const l8 = tuningForLevel(8);
    expect(LEVELS[LEVELS.length - 1]).toEqual(baseBefore);
    expect(l8).not.toBe(LEVELS[LEVELS.length - 1]);
  });

  it("ramps difficulty monotonically past the table", () => {
    const l6 = tuningForLevel(6);
    const l10 = tuningForLevel(10);
    expect(l10.spawnDelayMs).toBeLessThanOrEqual(l6.spawnDelayMs);
    expect(l10.meloSpeedMax).toBeGreaterThan(l6.meloSpeedMax);
    expect(l10.toClear).toBeGreaterThan(l6.toClear);
    expect(l10.megaSchedule.length).toBeGreaterThan(l6.megaSchedule.length);
  });

  it("keeps extrapolated values inside sane gameplay bounds", () => {
    const deep = tuningForLevel(100);
    expect(deep.spawnDelayMs).toBeGreaterThanOrEqual(260);
    expect(deep.meloSpreadDeg).toBeLessThanOrEqual(45);
    expect(deep.sideSpawnChance).toBeLessThanOrEqual(0.45);
    expect(deep.powerupDropChance).toBeLessThanOrEqual(0.12);
  });

  it("keeps every level clearable: enough spawns to reach the kill target", () => {
    for (let level = 1; level <= 30; level++) {
      const t = tuningForLevel(level);
      expect(t.totalSpawnsCap).toBeGreaterThanOrEqual(t.toClear);
    }
  });

  it("mega cues fire within the level's reachable kill count", () => {
    for (let level = 1; level <= 30; level++) {
      const t = tuningForLevel(level);
      for (const cue of t.megaSchedule) {
        expect(cue.atKill).toBeLessThanOrEqual(t.totalSpawnsCap);
      }
    }
  });
});

describe("STRESS_TUNING", () => {
  it("never clears — both progression exits are unreachable", () => {
    expect(STRESS_TUNING.toClear).toBeGreaterThan(100_000);
    expect(STRESS_TUNING.totalSpawnsCap).toBeGreaterThan(100_000);
  });

  it("spawns far faster than any real level", () => {
    for (let level = 1; level <= 30; level++) {
      expect(STRESS_TUNING.spawnDelayMs).toBeLessThan(tuningForLevel(level).spawnDelayMs);
    }
  });
});
