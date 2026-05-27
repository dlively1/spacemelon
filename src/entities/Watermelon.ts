import Phaser from "phaser";
import { TEX } from "../art/sprites";

export interface WatermelonOpts {
  vx: number;
  vy: number;
  spin: number;
  target?: Phaser.GameObjects.GameObject & { x: number; y: number };
  steerAccel?: number; // pixels/sec² toward the target
  maxSpeed?: number;
}

export class Watermelon extends Phaser.Physics.Arcade.Sprite {
  static nextId = 1;
  readonly meloId: number;
  spin: number;
  private steerAccel: number;
  private maxSpeed: number;
  private target?: Phaser.GameObjects.GameObject & { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number, opts: WatermelonOpts) {
    super(scene, x, y, TEX.watermelonSlice, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(2);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(12, 2, 2);
    body.setVelocity(opts.vx, opts.vy);
    body.setAllowGravity(false);
    this.meloId = Watermelon.nextId++;
    this.spin = opts.spin;
    this.target = opts.target;
    this.steerAccel = opts.steerAccel ?? 40;
    this.maxSpeed = opts.maxSpeed ?? 260;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body && this.target && this.target.active !== false) {
      // Gentle homing: nudge velocity toward the target each frame, then cap.
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const len = Math.hypot(dx, dy) || 1;
      const dt = delta * 0.001;
      body.velocity.x += (dx / len) * this.steerAccel * dt;
      body.velocity.y += (dy / len) * this.steerAccel * dt;
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
