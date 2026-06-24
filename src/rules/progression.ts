// Pure level-progression rules — no Phaser, no scene state. GameScene applies
// these; unit tests exercise them directly (tests/unit/progression.test.ts).

import type { MegaSpawnCue } from "../levels/levels";

/**
 * How many megamelon cues are due, given the next unconsumed cue index and
 * the small-melon kill count so far this level. Multiple cues can come due
 * from a single kill burst (e.g. an area blast).
 */
export function dueMegaCues(schedule: MegaSpawnCue[], nextCueIdx: number, kills: number): number {
  let due = 0;
  while (nextCueIdx + due < schedule.length && kills >= schedule[nextCueIdx + due].atKill) {
    due++;
  }
  return due;
}

/** Small-melon kills needed to clear the level have been reached. */
export function isLevelCleared(kills: number, toClear: number): boolean {
  return kills >= toClear;
}
