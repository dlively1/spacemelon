import Phaser from "phaser";
import { TEX } from "../art/sprites";

export class Watermelon extends Phaser.Physics.Arcade.Sprite {
  static nextId = 1;
  readonly meloId: number;
  spin: number;

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number, spin: number) {
    super(scene, x, y, TEX.watermelonSlice, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(2);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(12, 2, 2);
    body.setVelocity(vx, vy);
    body.setAllowGravity(false);
    this.meloId = Watermelon.nextId++;
    this.spin = spin;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // Cycle 4 frames at a rate proportional to spin speed.
    const frame = Math.floor((time / (1000 / Math.max(2, Math.abs(this.spin)))) % 4);
    this.setFrame(frame);
    this.rotation += this.spin * delta * 0.001;
  }
}
