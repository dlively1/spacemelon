import Phaser from "phaser";
import { Rng } from "../agent/rng";
import { TEX } from "../art/sprites";

export interface WorldDef {
  id: string;
  name: string;
  bgTop: number;
  bgBottom: number;
  nebulaTints: number[];
  starDensity: number;
  decorate?(scene: Phaser.Scene, rng: Rng, layer: Phaser.GameObjects.Container): void;
}

const PURPLE_NEBULA: WorldDef = {
  id: "purple-nebula",
  name: "Iris Drift",
  bgTop: 0x150033,
  bgBottom: 0x05030a,
  nebulaTints: [0x9b3aff, 0xff7bd1, 0x3a8fff],
  starDensity: 1.0,
};

const EMERALD_BELT: WorldDef = {
  id: "emerald-belt",
  name: "Emerald Belt",
  bgTop: 0x002a1e,
  bgBottom: 0x000510,
  nebulaTints: [0x3fa056, 0x77d76d, 0x6ac3ff],
  starDensity: 1.3,
  decorate(scene, rng, layer) {
    // Drifting "asteroids" (just dark blobs for now).
    for (let i = 0; i < 8; i++) {
      const x = rng.range(0, scene.scale.width);
      const y = rng.range(0, scene.scale.height);
      const r = rng.range(3, 9);
      const rock = scene.add.circle(x, y, r, 0x0b3a1f, 1).setStrokeStyle(1, 0x1f6b34);
      layer.add(rock);
    }
  },
};

const CRIMSON_REACH: WorldDef = {
  id: "crimson-reach",
  name: "Crimson Reach",
  bgTop: 0x3a0014,
  bgBottom: 0x0a0010,
  nebulaTints: [0xff5cf6, 0xff9d3a, 0xd6204c],
  starDensity: 0.8,
};

const GOLD_RING: WorldDef = {
  id: "gold-ring",
  name: "Gold Ring",
  bgTop: 0x2a1a00,
  bgBottom: 0x05030a,
  nebulaTints: [0xfff0a8, 0xff9d3a, 0x9b3aff],
  starDensity: 1.1,
  decorate(scene, _rng, layer) {
    // Suggestion of a ringed planet in the lower-right.
    const cx = scene.scale.width * 0.85;
    const cy = scene.scale.height * 0.85;
    const planet = scene.add.circle(cx, cy, 60, 0xff9d3a, 0.35);
    const ring = scene.add.ellipse(cx, cy, 180, 30, 0xfff0a8, 0.25).setStrokeStyle(1, 0xfff0a8, 0.5);
    ring.rotation = -0.4;
    layer.add([planet, ring]);
  },
};

const VOID_BLOOM: WorldDef = {
  id: "void-bloom",
  name: "Void Bloom",
  bgTop: 0x001022,
  bgBottom: 0x000004,
  nebulaTints: [0x6ac3ff, 0xb8eaff, 0xff5cf6],
  starDensity: 1.6,
};

export const WORLDS: WorldDef[] = [
  PURPLE_NEBULA,
  EMERALD_BELT,
  CRIMSON_REACH,
  GOLD_RING,
  VOID_BLOOM,
];

export function worldForLevel(level: number): WorldDef {
  return WORLDS[(level - 1) % WORLDS.length];
}

// Builds a parallax background for the given world. Returns the container so
// scenes can scroll/animate it.
export function buildBackground(scene: Phaser.Scene, world: WorldDef, rng: Rng): {
  container: Phaser.GameObjects.Container;
  stars: Phaser.GameObjects.Image[];
} {
  const { width, height } = scene.scale;
  const container = scene.add.container(0, 0).setDepth(-100);

  // Vertical gradient (two rects, blend via alpha).
  const top = scene.add.rectangle(0, 0, width, height, world.bgTop).setOrigin(0).setAlpha(1);
  const bottom = scene.add.rectangle(0, 0, width, height, world.bgBottom).setOrigin(0).setAlpha(0.65);
  container.add([top, bottom]);

  // Painterly nebula blobs.
  for (let i = 0; i < 14; i++) {
    const tint = world.nebulaTints[i % world.nebulaTints.length];
    const x = rng.range(-40, width + 40);
    const y = rng.range(-40, height + 40);
    const r = rng.range(40, 140);
    const blob = scene.add.circle(x, y, r, tint, rng.range(0.05, 0.18));
    container.add(blob);
  }

  // Stars (two parallax layers).
  const stars: Phaser.GameObjects.Image[] = [];
  const starCount = Math.round(120 * world.starDensity);
  for (let i = 0; i < starCount; i++) {
    const x = rng.range(0, width);
    const y = rng.range(0, height);
    const big = rng.chance(0.08);
    const tex = big ? TEX.starBig : TEX.star;
    const star = scene.add.image(x, y, tex).setAlpha(big ? 1 : rng.range(0.4, 1));
    if (big) star.setData("speed", rng.range(40, 90));
    else star.setData("speed", rng.range(10, 35));
    container.add(star);
    stars.push(star);
  }

  world.decorate?.(scene, rng, container);
  return { container, stars };
}
