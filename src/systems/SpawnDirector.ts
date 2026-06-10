import Phaser from "phaser";
import { Watermelon } from "../entities/Watermelon";
import { getEventBus } from "../agent/events";
import { dueMegaCues } from "../rules/progression";
import type { Rng } from "../agent/rng";
import type { Ship } from "../entities/Ship";
import type { LevelTuning } from "../levels/levels";

const MEGA_SHATTER_COUNT = 6;

// Owns melon spawning for a level: edge picks, aiming, the megamelon cue
// schedule, and mega shatter bursts. GameScene drives it (spawn timer, kill
// notifications) and keeps score/lives/level flow for itself.
export class SpawnDirector {
  private scene: Phaser.Scene;
  private rng: Rng;
  private melons: Phaser.Physics.Arcade.Group;
  private ship: Ship;
  private timeScale: number;

  private tuning!: LevelTuning;
  private spawned = 0;
  // Megamelon cues consumed by index as kill count advances.
  private megaCueIdx = 0;

  constructor(opts: {
    scene: Phaser.Scene;
    rng: Rng;
    melons: Phaser.Physics.Arcade.Group;
    ship: Ship;
    timeScale: number;
  }) {
    this.scene = opts.scene;
    this.rng = opts.rng;
    this.melons = opts.melons;
    this.ship = opts.ship;
    this.timeScale = opts.timeScale;
  }

  /** Reset per-level counters and adopt the level's tuning. */
  startLevel(tuning: LevelTuning): void {
    this.tuning = tuning;
    this.spawned = 0;
    this.megaCueIdx = 0;
  }

  get spawnedCount(): number {
    return this.spawned;
  }

  /** The spawn budget is used up — no more small melons will appear. */
  isExhausted(): boolean {
    return this.spawned >= this.tuning.totalSpawnsCap;
  }

  /** Timer callback: spawn one small melon from a screen edge. */
  spawnTick(): void {
    if (this.isExhausted()) return;
    const { width, height } = this.scene.scale;

    // Pick a spawn edge: top by default; at higher levels, occasionally
    // from a side edge for flanking pressure. Spawn just outside the play
    // area so melons drift into view quickly — the vulnerability gate in
    // Watermelon makes sure they can't be killed until they're on-screen.
    const side =
      this.rng.next() < this.tuning.sideSpawnChance
        ? this.rng.pick(["left", "right"] as const)
        : "top";
    let x: number;
    let y: number;
    if (side === "top") {
      x = this.rng.range(40, width - 40);
      y = -12;
    } else if (side === "left") {
      x = -16;
      y = this.rng.range(60, height * 0.6);
    } else {
      x = width + 16;
      y = this.rng.range(60, height * 0.6);
    }

    this.makeMelon(x, y, { mega: false });
    this.spawned++;
  }

  /** Spawn megamelons for any cues that came due at this kill count. */
  noteKills(killedThisLevel: number): void {
    const due = dueMegaCues(this.tuning.megaSchedule, this.megaCueIdx, killedThisLevel);
    for (let i = 0; i < due; i++) {
      const { width } = this.scene.scale;
      const x = this.rng.range(width * 0.3, width * 0.7);
      // Just above the screen — at scale 4 the sprite is ~112px so it peeks
      // in immediately; vulnerability gate still keeps it un-killable until
      // it's actually visible.
      const y = -30;
      this.makeMelon(x, y, { mega: true });
      this.megaCueIdx++;
    }
  }

  /** A killed megamelon bursts into a ring of small melons. */
  shatter(x: number, y: number): void {
    for (let i = 0; i < MEGA_SHATTER_COUNT; i++) {
      const angle = (i / MEGA_SHATTER_COUNT) * Math.PI * 2 + this.rng.range(-0.15, 0.15);
      const speed = this.rng.range(140, 200);
      const m = this.melons.get() as Watermelon | null;
      if (!m) continue;
      m.spawn(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: this.rng.range(-3, 3),
        target: this.ship,
        steerAccel: this.tuning.meloSteerAccel * 0.5,
        maxSpeed: this.tuning.meloMaxSpeed,
        pathPattern: "straight",
        timeScale: this.timeScale,
      });
      getEventBus().emit({
        type: "spawn",
        t: this.scene.time.now,
        kind: "watermelon",
        id: m.meloId,
        x,
        y,
        mega: false,
      });
    }
  }

  /** Pull a watermelon (small or mega) from the pool, aimed at the ship. */
  private makeMelon(
    x: number,
    y: number,
    opts: { mega: boolean; speedScale?: number },
  ): Watermelon | null {
    const t = this.tuning;
    const dx = this.ship.x - x;
    const dy = this.ship.y - y;
    // Use raw dy magnitude (no clamp) so side spawns aim sideways at the
    // ship instead of being forced downward.
    const baseAngle = Math.atan2(dy, dx);
    const spreadDeg = this.rng.range(-t.meloSpreadDeg, t.meloSpreadDeg);
    const angle = baseAngle + (spreadDeg * Math.PI) / 180;
    const speedScale = opts.speedScale ?? (opts.mega ? 0.7 : 1);
    const speed = this.rng.range(t.meloSpeedMin, t.meloSpeedMax) * speedScale;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const spin = this.rng.range(-2.5, 2.5);

    const m = this.melons.get() as Watermelon | null;
    if (!m) return null;
    m.spawn(x, y, {
      vx,
      vy,
      spin,
      target: this.ship,
      steerAccel: t.meloSteerAccel * (opts.mega ? 0.6 : 1),
      maxSpeed: t.meloMaxSpeed * (opts.mega ? 0.7 : 1),
      pathPattern: t.meloPath,
      wavePhase: this.rng.range(0, Math.PI * 2),
      timeScale: this.timeScale,
      mega: opts.mega,
      hp: opts.mega ? t.megaHp : 1,
    });
    getEventBus().emit({
      type: "spawn",
      t: this.scene.time.now,
      kind: "watermelon",
      id: m.meloId,
      x,
      y,
      mega: opts.mega,
    });
    return m;
  }
}
