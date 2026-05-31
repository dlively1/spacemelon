import Phaser from "phaser";
import { TEX } from "../art/sprites";

// Which special ability a power-up cylinder grants when collected.
export type AbilityType = "multiLaser" | "areaBlast";

export interface PickupOpts {
  ability: AbilityType;
  // Downward drift speed (px/s). Cylinders fall straight down, fast, so the
  // player has a narrow window to catch one before it slips past.
  vy: number;
}

const TEX_FOR_ABILITY: Record<AbilityType, string> = {
  multiLaser: TEX.powerLaser,
  areaBlast: TEX.powerBomb,
};

export class Pickup extends Phaser.Physics.Arcade.Sprite {
  static nextId = 1;

  readonly pickupId: number;
  readonly ability: AbilityType;

  // Spawn velocity, re-asserted on the first preUpdate. Phaser's Arcade Group
  // zeroes a body's velocity when the sprite is add()'ed (after our constructor
  // ran), so without this the cylinder would sit frozen. Same trick Watermelon
  // uses.
  private launchVy: number;
  private launched = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: PickupOpts) {
    super(scene, x, y, TEX_FOR_ABILITY[opts.ability]);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.ability = opts.ability;
    this.pickupId = Pickup.nextId++;
    this.setScale(2);
    this.setDepth(40);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // Generous-ish circular hitbox so the fast-moving pickup is catchable.
    body.setCircle(6, 0, 3);
    this.launchVy = opts.vy;
    body.setVelocity(0, opts.vy);
    body.setAllowGravity(false);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body && !this.launched) {
      body.setVelocity(0, this.launchVy);
      this.launched = true;
    }

    // Gentle glint: pulse the scale and slowly spin so it reads as a glowing
    // collectible rather than another enemy.
    const pulse = 2 + Math.sin(time * 0.012) * 0.12;
    this.setScale(pulse);
    this.rotation += delta * 0.002;
  }
}
