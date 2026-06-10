import Phaser from "phaser";
import { TEX } from "../art/sprites";
import { abilityDef, type AbilityType } from "../abilities/abilities";

// Re-export so existing imports (tests, gameClient) keep working; the
// canonical definition lives in the ability registry.
export type { AbilityType };

export interface PickupOpts {
  ability: AbilityType;
  // Downward drift speed (px/s). Cylinders fall straight down, fast, so the
  // player has a narrow window to catch one before it slips past.
  vy: number;
}

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
    this.setTexture(abilityDef(opts.ability).texture);
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
