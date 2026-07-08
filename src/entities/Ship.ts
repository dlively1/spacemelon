import Phaser from "phaser";
import { TEX } from "../art/sprites";

const BASE_FIRE_COOLDOWN_MS = 180;

export class Ship extends Phaser.Physics.Arcade.Sprite {
  speed = 320;
  private thrusting = false;
  private fireCooldownMs = BASE_FIRE_COOLDOWN_MS;
  private nextFireAt = 0;
  private invincibleUntil = 0;
  private respawning = false;
  private readonly spawnX: number;
  private readonly spawnY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.ship);
    this.spawnX = x;
    this.spawnY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(2);
    this.setCollideWorldBounds(true);
    // Collision box wraps the fuselage + wings of the 28x34 sprite, leaving the
    // nose tip, cannon tips, and thruster plume as forgiving margin.
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 22).setOffset(3, 6);
  }

  // Fire cooldown is measured against the raw update-loop clock, which the
  // game-speed timeScale does NOT touch — so the scale must be applied here
  // for fire rate to keep up with a sped-up game.
  setTimeScale(scale: number): void {
    this.fireCooldownMs = BASE_FIRE_COOLDOWN_MS / scale;
  }

  setThrust(on: boolean): void {
    if (on === this.thrusting) return;
    this.thrusting = on;
    this.setTexture(on ? TEX.shipThrust : TEX.ship);
  }

  tryFire(nowMs: number): boolean {
    if (nowMs < this.nextFireAt) return false;
    this.nextFireAt = nowMs + this.fireCooldownMs;
    return true;
  }

  isInvincible(nowMs: number): boolean {
    return nowMs < this.invincibleUntil;
  }

  startInvincibility(nowMs: number, durationMs: number): void {
    this.invincibleUntil = nowMs + durationMs;
  }

  // True while the ship is mid-respawn (visibly "destroyed", before it flashes
  // back in). Callers should suppress movement/fire during this window.
  isRespawning(): boolean {
    return this.respawning;
  }

  // Arcade "life lost" beat: the ship vanishes (the scene spawns the explosion
  // FX at its position), then after `hiddenMs` it snaps back to its spawn point
  // and rapid-blinks for the remainder of the i-frame window before turning
  // solid + vulnerable again.
  playHitSequence(nowMs: number, iFrameMs: number, hiddenMs = 400): void {
    this.respawning = true;
    this.startInvincibility(nowMs, iFrameMs);
    this.scene.tweens.killTweensOf(this);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0);
    this.setVisible(false);

    this.scene.time.delayedCall(hiddenMs, () => {
      this.setPosition(this.spawnX, this.spawnY);
      this.setThrust(false);
      this.setVisible(true).setAlpha(1);
      this.respawning = false;

      const blinkMs = Math.max(0, iFrameMs - hiddenMs);
      this.scene.tweens.add({
        targets: this,
        alpha: 0.2,
        duration: 90,
        yoyo: true,
        repeat: Math.max(0, Math.round(blinkMs / 180) - 1),
        ease: "Linear",
        onComplete: () => this.setAlpha(1),
      });
    });
  }
}
