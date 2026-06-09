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

// Pooled collectible: instances are created by the scene's physics group and
// reused via spawn()/despawn(). All per-pickup state is assigned in spawn().
export class Pickup extends Phaser.Physics.Arcade.Sprite {
  static nextId = 1;

  pickupId = 0;
  ability: AbilityType = "multiLaser";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEX.powerLaser);
  }

  /** (Re)activate this pooled pickup at (x, y). */
  spawn(x: number, y: number, opts: PickupOpts): this {
    // enableBody runs after the group added the sprite, so the velocity set
    // below sticks — no first-update re-assert hack needed.
    this.enableBody(true, x, y, true, true);

    this.pickupId = Pickup.nextId++;
    this.ability = opts.ability;
    this.setTexture(TEX_FOR_ABILITY[opts.ability]);
    this.setScale(2);
    this.setRotation(0);
    this.setDepth(40);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // Generous-ish circular hitbox so the fast-moving pickup is catchable.
    body.setCircle(6, 0, 3);
    body.setVelocity(0, opts.vy);
    body.setAllowGravity(false);

    return this;
  }

  /** Deactivate and return to the pool (does not destroy). */
  despawn(): void {
    this.disableBody(true, true);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    // Gentle glint: pulse the scale and slowly spin so it reads as a glowing
    // collectible rather than another enemy.
    const pulse = 2 + Math.sin(time * 0.012) * 0.12;
    this.setScale(pulse);
    this.rotation += delta * 0.002;
  }
}
