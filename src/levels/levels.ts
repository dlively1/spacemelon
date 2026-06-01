// Per-level tuning. Difficulty is expressed as data (this file), not formulas
// scattered through gameplay code, so it's easy to tweak feel without
// chasing constants. `tuningForLevel(level)` returns a config for any level;
// beyond the explicit table we ramp from the last entry.

export type PathPattern = "straight" | "wave";

export interface MegaSpawnCue {
  // Spawn a megamelon once `killedThisLevel` reaches this many small kills.
  atKill: number;
}

export interface LevelTuning {
  spawnDelayMs: number;
  meloSpeedMin: number;
  meloSpeedMax: number;
  meloSteerAccel: number;
  meloMaxSpeed: number;
  meloSpreadDeg: number;
  meloPath: PathPattern;
  // Probability per spawn of coming from a side edge instead of the top.
  // Side melons feel like a flanking attack; useful for L4+ to mix lanes.
  sideSpawnChance: number;
  // Soft cap on total small-melon spawns per level (megas count separately).
  totalSpawnsCap: number;
  // Small-melon kills needed to clear the level.
  toClear: number;
  // Mega cues: when to drop a megamelon. Each mega has its own HP.
  megaSchedule: MegaSpawnCue[];
  megaHp: number;
  // Chance (0..1) that a destroyed melon drops a power-up cylinder. 0 before
  // level 3 — special abilities are a mid-game escalation.
  powerupDropChance: number;
  // Downward drift speed (px/s) of dropped cylinders. Fast = hard to catch.
  powerupFallSpeed: number;
}

// Tuning rationale:
//   L1 — onboarding. Few melons, slow, easy to dodge, straight paths.
//   L2 — close to original feel before this tuning pass landed.
//   L3 — introduces ONE megamelon mid-level; wave drift starts.
//   L4 — two megas, side spawns, faster baseline.
//   L5 — three megas, fast, full chaos.
//   L6+ — extrapolated; an extra mega and faster cadence per level.
export const LEVELS: LevelTuning[] = [
  {
    // L1 onboarding: slow cadence, slow melons, no homing, tight aim so the
    // player almost always has a clean shot. Few total spawns.
    spawnDelayMs: 1400,
    meloSpeedMin: 70,
    meloSpeedMax: 110,
    meloSteerAccel: 0,
    meloMaxSpeed: 140,
    meloSpreadDeg: 16,
    meloPath: "straight",
    sideSpawnChance: 0,
    totalSpawnsCap: 14,
    toClear: 8,
    megaSchedule: [],
    megaHp: 4,
    powerupDropChance: 0,
    powerupFallSpeed: 300,
  },
  {
    spawnDelayMs: 760,
    meloSpeedMin: 140,
    meloSpeedMax: 200,
    meloSteerAccel: 40,
    meloMaxSpeed: 240,
    meloSpreadDeg: 22,
    meloPath: "straight",
    sideSpawnChance: 0,
    totalSpawnsCap: 22,
    toClear: 12,
    megaSchedule: [],
    megaHp: 4,
    powerupDropChance: 0,
    powerupFallSpeed: 300,
  },
  {
    spawnDelayMs: 700,
    meloSpeedMin: 150,
    meloSpeedMax: 210,
    meloSteerAccel: 50,
    meloMaxSpeed: 250,
    meloSpreadDeg: 24,
    meloPath: "wave",
    sideSpawnChance: 0,
    totalSpawnsCap: 22,
    toClear: 14,
    megaSchedule: [{ atKill: 6 }],
    megaHp: 4,
    powerupDropChance: 0.06,
    powerupFallSpeed: 300,
  },
  {
    spawnDelayMs: 600,
    meloSpeedMin: 170,
    meloSpeedMax: 230,
    meloSteerAccel: 65,
    meloMaxSpeed: 270,
    meloSpreadDeg: 28,
    meloPath: "wave",
    sideSpawnChance: 0.18,
    totalSpawnsCap: 26,
    toClear: 18,
    megaSchedule: [{ atKill: 5 }, { atKill: 13 }],
    megaHp: 5,
    powerupDropChance: 0.07,
    powerupFallSpeed: 320,
  },
  {
    spawnDelayMs: 500,
    meloSpeedMin: 190,
    meloSpeedMax: 250,
    meloSteerAccel: 80,
    meloMaxSpeed: 300,
    meloSpreadDeg: 32,
    meloPath: "wave",
    sideSpawnChance: 0.28,
    totalSpawnsCap: 30,
    toClear: 22,
    megaSchedule: [{ atKill: 4 }, { atKill: 11 }, { atKill: 18 }],
    megaHp: 6,
    powerupDropChance: 0.08,
    powerupFallSpeed: 340,
  },
];

export function tuningForLevel(level: number): LevelTuning {
  if (level <= LEVELS.length) return LEVELS[level - 1];
  const base = LEVELS[LEVELS.length - 1];
  const extra = level - LEVELS.length;
  // Extrapolation: each extra level shaves spawn delay, raises speeds,
  // and adds one more mega cue further into the run.
  const extraMegas: MegaSpawnCue[] = [];
  for (let i = 1; i <= extra; i++) {
    extraMegas.push({ atKill: 18 + i * 3 });
  }
  return {
    spawnDelayMs: Math.max(260, base.spawnDelayMs - extra * 30),
    meloSpeedMin: base.meloSpeedMin + extra * 12,
    meloSpeedMax: base.meloSpeedMax + extra * 14,
    meloSteerAccel: base.meloSteerAccel + extra * 8,
    meloMaxSpeed: base.meloMaxSpeed + extra * 12,
    meloSpreadDeg: Math.min(45, base.meloSpreadDeg + extra * 2),
    meloPath: "wave",
    sideSpawnChance: Math.min(0.45, base.sideSpawnChance + extra * 0.04),
    totalSpawnsCap: base.totalSpawnsCap + extra * 3,
    toClear: base.toClear + extra * 2,
    megaSchedule: [...base.megaSchedule, ...extraMegas],
    megaHp: base.megaHp + Math.floor(extra / 2),
    powerupDropChance: Math.min(0.12, base.powerupDropChance + extra * 0.005),
    powerupFallSpeed: base.powerupFallSpeed + extra * 8,
  };
}
