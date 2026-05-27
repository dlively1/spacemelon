import Phaser from "phaser";
import { TEX } from "../art/sprites";

export class Ship extends Phaser.Physics.Arcade.Sprite {
  speed = 320;
  private thrusting = false;
  private fireCooldownMs = 180;
  private nextFireAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.ship);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(2);
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 22).setOffset(2, 4);
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
}
