// Pure scoring rules — no Phaser, no scene state. GameScene applies these;
// unit tests exercise them directly (tests/unit/scoring.test.ts).

export const SCORE = {
  smallKill: 100,
  // Non-killing hit on a megamelon.
  megaHit: 50,
  megaDestroy: 500,
  // Penalties for letting melons drift past the ship — encourages aggressive
  // play. Score floors at 0 so a bad run can't go negative.
  smallEscape: -50,
  megaEscape: -200,
} as const;

/** Points awarded for destroying a melon. */
export function killAward(mega: boolean): number {
  return mega ? SCORE.megaDestroy : SCORE.smallKill;
}

/** Penalty (negative) for a melon escaping off the bottom of the screen. */
export function escapePenalty(mega: boolean): number {
  return mega ? SCORE.megaEscape : SCORE.smallEscape;
}

/** Apply a score delta, flooring the result at 0. */
export function applyScoreDelta(score: number, delta: number): number {
  return Math.max(0, score + delta);
}
