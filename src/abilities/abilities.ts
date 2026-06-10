import { TEX } from "../art/sprites";

// Registry of special abilities granted by power-up cylinders.
//
// Abilities are DATA, like worlds and levels: adding one means appending an
// AbilityDef here (plus a sprite key if it needs new art) — no switch
// statements in GameScene, no HUD edits, no Pickup edits. The pickup drop
// table, HUD badge, and firing pattern all read from this registry.

export type AbilityType = "multiLaser" | "areaBlast";

/** Fire one bullet from the ship's cannon: (vx, vy, explosive?). */
export type FireBullet = (vx: number, vy: number, explosive?: boolean) => void;

export interface AbilityDef {
  id: AbilityType;
  // HUD badge text.
  label: string;
  // Texture for the falling cylinder and the HUD badge icon.
  texture: string;
  // HUD label color.
  color: string;
  // Firing pattern while this ability is active.
  onFire(fire: FireBullet): void;
}

export const ABILITIES: readonly AbilityDef[] = [
  {
    id: "multiLaser",
    label: "MULTI-LASER",
    texture: TEX.powerLaser,
    color: "#ffe14d",
    // 3-way spread: straight up plus two angled lanes.
    onFire: (fire) => {
      fire(0, -560);
      fire(-150, -540);
      fire(150, -540);
    },
  },
  {
    id: "areaBlast",
    label: "AREA-BLAST",
    texture: TEX.powerBomb,
    color: "#ffe14d",
    // A single explosive round that detonates on impact.
    onFire: (fire) => fire(0, -560, true),
  },
];

const BY_ID = new Map(ABILITIES.map((a) => [a.id, a]));

export function abilityDef(id: AbilityType): AbilityDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown ability: ${id}`);
  return def;
}
