import Phaser from "phaser";
import { Rng } from "../agent/rng";
import { PixelCanvas } from "../art/pixelCanvas";

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
    const ring = scene.add
      .ellipse(cx, cy, 180, 30, 0xfff0a8, 0.25)
      .setStrokeStyle(1, 0xfff0a8, 0.5);
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

export interface StarLayer {
  sprite: Phaser.GameObjects.TileSprite;
  // Downward scroll speed in px/s.
  speed: number;
}

export interface BackgroundHandle {
  container: Phaser.GameObjects.Container;
  starLayers: StarLayer[];
}

// Star fields are painted into per-layer canvas textures and scrolled as
// TileSprites — far (small, dim, slow) and near (big, bright, fast). Keys are
// reused across rebuilds; registerTexture replaces the old texture.
const STARS_FAR_TEX = "tex:bg:stars:far";
const STARS_NEAR_TEX = "tex:bg:stars:near";

function paintStarTexture(
  scene: Phaser.Scene,
  key: string,
  rng: Rng,
  opts: { count: number; big: boolean },
): void {
  const { width, height } = scene.scale;
  const pc = new PixelCanvas(width, height);
  for (let i = 0; i < opts.count; i++) {
    // Keep a margin so stars don't clip at the tile seam.
    const x = Math.floor(rng.range(3, width - 3));
    const y = Math.floor(rng.range(3, height - 3));
    if (opts.big) {
      // 3x3 cross with a bright core (mirrors the old TEX.starBig look).
      pc.px(x, y, 0xffffff);
      pc.px(x - 1, y, 0xb8eaff, 0.9);
      pc.px(x + 1, y, 0xb8eaff, 0.9);
      pc.px(x, y - 1, 0xb8eaff, 0.9);
      pc.px(x, y + 1, 0xb8eaff, 0.9);
    } else {
      pc.px(x, y, 0xffffff, rng.range(0.4, 1));
    }
  }
  pc.registerTexture(scene, key);
}

// Builds a parallax background for the given world.
//
// Everything static (gradient, nebula blobs, world decorations) is rendered
// ONCE into a RenderTexture so it costs a single draw per frame — the
// Shape-based blobs/decorations would otherwise each break sprite batching
// every frame. Stars live in two scrolling TileSprite layers, replacing the
// old per-star JS position loop (and its per-star data-manager lookups).
export function buildBackground(scene: Phaser.Scene, world: WorldDef, rng: Rng): BackgroundHandle {
  const { width, height } = scene.scale;
  const container = scene.add.container(0, 0).setDepth(-100);

  // --- Static layer, baked into a RenderTexture ---
  // Built in a temp container that is drawn into the RT and destroyed before
  // it ever renders to the screen.
  const temp = scene.add.container(0, 0);

  // Vertical gradient (two rects, blend via alpha).
  const top = scene.add.rectangle(0, 0, width, height, world.bgTop).setOrigin(0).setAlpha(1);
  const bottom = scene.add
    .rectangle(0, 0, width, height, world.bgBottom)
    .setOrigin(0)
    .setAlpha(0.65);
  temp.add([top, bottom]);

  // Painterly nebula blobs.
  for (let i = 0; i < 14; i++) {
    const tint = world.nebulaTints[i % world.nebulaTints.length];
    const x = rng.range(-40, width + 40);
    const y = rng.range(-40, height + 40);
    const r = rng.range(40, 140);
    const blob = scene.add.circle(x, y, r, tint, rng.range(0.05, 0.18));
    temp.add(blob);
  }

  world.decorate?.(scene, rng, temp);

  const rt = scene.add.renderTexture(0, 0, width, height).setOrigin(0);
  rt.draw(temp, 0, 0);
  temp.destroy(true);
  container.add(rt);

  // --- Star layers (scrolling TileSprites) ---
  paintStarTexture(scene, STARS_FAR_TEX, rng, {
    count: Math.round(110 * world.starDensity),
    big: false,
  });
  paintStarTexture(scene, STARS_NEAR_TEX, rng, {
    count: Math.round(10 * world.starDensity),
    big: true,
  });

  const far = scene.add.tileSprite(0, 0, width, height, STARS_FAR_TEX).setOrigin(0);
  const near = scene.add.tileSprite(0, 0, width, height, STARS_NEAR_TEX).setOrigin(0);
  container.add([far, near]);

  const starLayers: StarLayer[] = [
    { sprite: far, speed: 22 },
    { sprite: near, speed: 65 },
  ];

  return { container, starLayers };
}
