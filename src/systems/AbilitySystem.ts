import Phaser from "phaser";
import { getEventBus } from "../agent/events";
import { abilityDef, type AbilityDef, type AbilityType } from "../abilities/abilities";
import type { GameHud } from "../ui/GameHud";
import { sfx } from "../audio/sfx";

// How long a collected special ability stays active.
const ABILITY_DURATION_MS = 8000;

// Owns the active special ability: granting, expiry, and keeping the HUD
// badge + agent snapshot in sync. GameScene asks `activeDef` when firing.
export class AbilitySystem {
  private scene: Phaser.Scene;
  private hud: GameHud;
  private active: AbilityDef | null = null;
  private expiresAt = 0;

  constructor(scene: Phaser.Scene, hud: GameHud) {
    this.scene = scene;
    this.hud = hud;
  }

  get activeDef(): AbilityDef | null {
    return this.active;
  }

  /** Activate an ability (pickup catch or bridge cheat). */
  grant(ability: AbilityType): void {
    this.active = abilityDef(ability);
    this.expiresAt = this.scene.time.now + ABILITY_DURATION_MS;
    sfx.play("powerup");
    this.hud.setAbility(ability);
    getEventBus().updateSnapshot({ ability });
  }

  /** Expire the ability when its time is up and drain the HUD timer. */
  update(time: number): void {
    if (!this.active) return;
    if (time >= this.expiresAt) {
      const expired = this.active.id;
      this.active = null;
      const bus = getEventBus();
      bus.emit({ type: "powerup-expire", t: time, ability: expired });
      bus.updateSnapshot({ ability: null });
      this.hud.clearAbility();
    } else {
      this.hud.updateAbilityTimer((this.expiresAt - time) / ABILITY_DURATION_MS);
    }
  }
}
