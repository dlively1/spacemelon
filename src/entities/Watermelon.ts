import Phaser from "phaser";
import { TEX } from "../art/sprites";
import type { PathPattern } from "../levels/levels";

export interface WatermelonOpts {
  vx: number;
  vy: number;
  spin: number;
  target?: Phaser.GameObjects.GameObject & { x: number; y: number };
  steerAccel?: number;
  maxSpeed?: number;
  mega?: boolean;
  hp?: number;
  scale?: number;
  pathPattern?: PathPattern;
  // Strength of perpendicular sinusoidal drift for "wave" path (px/s² peak).
  waveAmplitude?: number;
  // Initial phase (radians) for the "wave" path so coexisting melons don't
  // oscillate in lockstep. Callers should derive it from the seeded Rng —
  // gameplay code must stay deterministic (no Math.random()).
  wavePhase?: number;
}

const FLASH_TINT = 0xffffff;

export class Watermelon extends Phaser.Physics.Arcade.Sprite {
  static nextId = 1;

  readonly meloId: number;
  readonly mega: boolean;
  hp: number;
  spin: number;

  private steerAccel: number;
  private maxSpeed: number;
  private target?: Phaser.GameObjects.GameObject & { x: number; y: number };
  private pathPattern: PathPattern;
  private waveAmplitude: number;
  private pathPhase: number;
  // Spawn velocity, re-asserted on the first preUpdate — see the note there.
  private launchVx: number;
  private launchVy: number;
  private launched = false;
  // Melons spawn just outside the play area and "drift in." They can't be
  // killed until their sprite touches the visible area, so the player never
  // gets credit for off-screen blasts.
  private vulnerable = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: WatermelonOpts) {
    super(scene, x, y, TEX.watermelonSlice, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.mega = !!opts.mega;
    this.hp = opts.hp ?? (this.mega ? 4 : 1);
    const scale = opts.scale ?? (this.mega ? 4 : 2);
    this.setScale(scale);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // Body radius is in source pixels and doesn't auto-scale with the sprite,
    // so scale it ourselves. Normal melon (scale 2) keeps r=12 / offset=2;
    // mega (scale 4) gets r=24 / offset=4 so collision matches visible size.
    const scaleRatio = scale / 2;
    body.setCircle(12 * scaleRatio, 2 * scaleRatio, 2 * scaleRatio);
    this.launchVx = opts.vx;
    this.launchVy = opts.vy;
    body.setVelocity(opts.vx, opts.vy);
    body.setAllowGravity(false);

    this.meloId = Watermelon.nextId++;
    this.spin = opts.spin;
    this.target = opts.target;
    this.steerAccel = opts.steerAccel ?? 40;
    this.maxSpeed = opts.maxSpeed ?? 260;
    this.pathPattern = opts.pathPattern ?? "straight";
    this.waveAmplitude = opts.waveAmplitude ?? 70;
    this.pathPhase = opts.wavePhase ?? 0;

    if (this.mega) this.setDepth(50); // draw mega above small melons
  }

  /** True once any part of the sprite has touched the visible play area. */
  isVulnerable(): boolean {
    if (this.vulnerable) return true;
    const halfW = this.displayWidth / 2;
    const halfH = this.displayHeight / 2;
    const { width, height } = this.scene.scale;
    const touchingScreen =
      this.x + halfW > 0 && this.x - halfW < width && this.y + halfH > 0 && this.y - halfH < height;
    if (touchingScreen) this.vulnerable = true;
    return this.vulnerable;
  }

  /** Apply one bullet of damage. Returns true if this hit destroyed the melon. */
  takeHit(): boolean {
    this.hp -= 1;
    if (this.hp <= 0) return true;
    // Non-killing hit: white flash.
    this.setTintFill(FLASH_TINT);
    this.scene.time.delayedCall(70, () => {
      if (this.active) this.clearTint();
    });
    return false;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      if (!this.launched) {
        // Phaser's Arcade physics Group resets a body to the group's (zero)
        // velocity defaults when the sprite is add()'ed — which happens AFTER
        // our constructor set the spawn velocity. Re-assert it on the first
        // update so melons actually drift in. Without this, L1 melons (which
        // have no homing accel to mask the lost velocity) sit frozen offscreen.
        body.setVelocity(this.launchVx, this.launchVy);
        this.launched = true;
      }
      const dt = delta * 0.001;
      if (this.target && this.target.active !== false) {
        // Gentle homing toward the target.
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        body.velocity.x += (dx / len) * this.steerAccel * dt;
        body.velocity.y += (dy / len) * this.steerAccel * dt;
      }
      if (this.pathPattern === "wave") {
        // Perpendicular sinusoidal drift (px/s² impulse along world X).
        // Combined with homing, this produces a weaving descent.
        const phase = time * 0.003 + this.pathPhase;
        body.velocity.x += Math.sin(phase) * this.waveAmplitude * dt;
      }
      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      if (speed > this.maxSpeed) {
        body.velocity.x = (body.velocity.x / speed) * this.maxSpeed;
        body.velocity.y = (body.velocity.y / speed) * this.maxSpeed;
      }
    }

    const frame = Math.floor((time / (1000 / Math.max(2, Math.abs(this.spin)))) % 4);
    this.setFrame(frame);
    this.rotation += this.spin * delta * 0.001;
  }
}
