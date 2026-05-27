// Carefully curated pixel-art palettes. Each entry is RGBA "0xRRGGBBAA".
// Keeping palettes tight keeps the look cohesive across procedural art.

export const PAL = {
  // Watermelon body
  rindDark: 0x0b3a1f,
  rindMid: 0x1f6b34,
  rindLight: 0x3fa056,
  rindStripe: 0x77d76d,
  flesh: 0xd6204c,
  fleshLight: 0xf25278,
  fleshHighlight: 0xfff0a8,
  seed: 0x150a04,
  seedShine: 0x6a3a14,

  // Ship
  hullDark: 0x10142a,
  hull: 0x2b3a78,
  hullLight: 0x6ac3ff,
  hullEdge: 0xb8eaff,
  cockpit: 0xfff6a8,
  cockpitEdge: 0xff9d3a,
  thruster: 0xff5cf6,
  thrusterHot: 0xffd6ff,

  // Bullet
  bulletCore: 0xfff0a8,
  bulletGlow: 0xff7bd1,
  bulletEdge: 0x9b3aff,

  // FX
  shockwave: 0xfff0a8,
  spark: 0xfff6c2,
} as const;

export type ColorName = keyof typeof PAL;
export const PALETTE_HEX = (name: ColorName): number => PAL[name];
