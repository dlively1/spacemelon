import Phaser from "phaser";
import { PAL } from "./palettes";
import { PixelCanvas } from "./pixelCanvas";

export const TEX = {
  ship: "tex:ship",
  shipThrust: "tex:ship:thrust",
  bullet: "tex:bullet",
  watermelonSlice: "tex:watermelon:slice", // 4-frame tumbling sprite sheet (whole melon)
  watermelonChunk: "tex:watermelon:chunk", // wedge shrapnel for explosions
  star: "tex:star",
  starBig: "tex:starBig",
  shockwave: "tex:shockwave",
  seed: "tex:seed",
  powerLaser: "tex:power:laser", // glowing green cylinder — multi-laser ability
  powerBomb: "tex:power:bomb", // glowing green cylinder — area-blast ability
} as const;

// 28x30 ship — "Twin-Fang Cruiser": a beefy Galaga gunship. Central fuselage
// with a yellow cockpit, forward-swept fang wings tipped with dual cannons,
// and a bank of four thrusters. Drawn procedurally around an even-width axis
// (the seam between columns 13 and 14) so it stays perfectly symmetric.
const SHIP_W = 28;
const SHIP_H = 34; // extra bottom rows give the thrust frame room for a plume
const SHIP_LC = 13;
const SHIP_RC = 14;

function shipMcol(pc: PixelCanvas, dx: number, y: number, c: number): void {
  pc.px(SHIP_LC - dx, y, c);
  pc.px(SHIP_RC + dx, y, c);
}

function drawShip(scene: Phaser.Scene, thrusting: boolean, key: string): void {
  const pc = new PixelCanvas(SHIP_W, SHIP_H);

  // --- Fuselage: pointed nose tapering into a body column ---
  const noseY = 2;
  const tailY = 26;
  for (let y = noseY; y <= tailY; y++) {
    const hw = y < 6 ? y - noseY : 3;
    for (let dx = 0; dx <= hw; dx++) {
      const c = dx === hw ? PAL.hullDark : dx <= 1 ? PAL.hullLight : PAL.hull;
      shipMcol(pc, dx, y, c);
    }
  }

  // --- Forward-swept fang wings (bulge mid-span, tuck back to the body) ---
  for (let y = 8; y <= 24; y++) {
    const inner = 3;
    const outer = Math.max(inner, Math.round(12 - Math.abs(y - 15) * 0.55));
    for (let dx = inner; dx <= outer; dx++) {
      const c = dx === outer ? PAL.hullDark : dx === inner ? PAL.hullLight : PAL.hull;
      shipMcol(pc, dx, y, c);
    }
  }

  // --- Dual cannons jutting forward from the wings ---
  for (let y = 4; y <= 10; y++) {
    shipMcol(pc, 10, y, y <= 5 ? PAL.hullEdge : PAL.hull);
    shipMcol(pc, 11, y, PAL.hullDark);
    shipMcol(pc, 9, y, PAL.hullDark);
  }

  // --- Cockpit ---
  for (let y = 8; y <= 13; y++) {
    const hw = y === 8 || y === 13 ? 0 : 1;
    for (let dx = 0; dx <= hw; dx++) shipMcol(pc, dx, y, PAL.cockpit);
  }
  shipMcol(pc, 1, 9, PAL.cockpitEdge);
  shipMcol(pc, 1, 12, PAL.cockpitEdge);

  // --- Quad thruster bank ---
  shipMcol(pc, 1, 27, PAL.thruster);
  shipMcol(pc, 5, 27, PAL.thruster);
  shipMcol(pc, 1, 28, PAL.thrusterHot);
  shipMcol(pc, 5, 28, PAL.thrusterHot);

  if (thrusting) {
    // Flickery flame plume blasting out of both thruster pairs. Each pair
    // (dx≈1 and dx≈5) tapers from a hot core to a cooler tongue.
    for (const cx of [1, 5]) {
      shipMcol(pc, cx, 29, PAL.thrusterHot);
      shipMcol(pc, cx, 30, PAL.thrusterHot);
      shipMcol(pc, cx, 31, PAL.cockpit);
      shipMcol(pc, cx, 32, PAL.cockpitEdge);
    }
  }
  pc.registerTexture(scene, key);
}

// 6x14 bullet: hot core with neon glow.
function drawBullet(scene: Phaser.Scene): void {
  const pc = new PixelCanvas(6, 14);
  const legend = {
    c: PAL.bulletCore,
    g: PAL.bulletGlow,
    e: PAL.bulletEdge,
  };
  const grid = [
    "..cc..",
    ".cccc.",
    ".cccc.",
    "cggggc",
    "cggggc",
    "cggggc",
    "eggegg",
    "egeege",
    "egeege",
    "eggege",
    ".eeee.",
    ".eeee.",
    "..ee..",
    "..ee..",
  ];
  pc.stamp(0, 0, grid, legend);
  pc.registerTexture(scene, TEX.bullet);
}

// 28x28 watermelon, 4-frame "tumble" sprite sheet (112x28).
// A WHOLE melon: an oval (wider than tall) green body with curved meridian
// stripes that sweep across the 4 frames so it reads as a melon spinning about
// its vertical axis. The entity also rotates the sprite, so the two combine
// into a chaotic zero-g tumble. (Red flesh + seeds live on the shatter chunks.)
function drawWatermelon(scene: Phaser.Scene): void {
  const W = 28;
  const H = 28;
  const FRAMES = 4;
  const sheet = new PixelCanvas(W * FRAMES, H);

  const cx = W / 2 - 0.5;
  const cy = H / 2 - 0.5;
  // Oval: noticeably wider than tall (~1.3:1) so it reads as a watermelon,
  // not a ball. Rx/Ry are the ellipse half-axes in source pixels.
  const Rx = 13;
  const Ry = 10;
  const STRIPES = 8;

  for (let f = 0; f < FRAMES; f++) {
    const off = f * W;
    // Sweep exactly one stripe-gap across the 4 frames so the loop is seamless
    // and the stripes appear to rotate. (A full 2π step would land on a
    // multiple of the stripe spacing and look frozen.)
    const phase = (f / FRAMES) * ((Math.PI * 2) / STRIPES);

    // Body: shade the ellipse with a fake upper-left light source.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x - cx) / Rx;
        const ny = (y - cy) / Ry;
        const n2 = nx * nx + ny * ny;
        if (n2 > 1) continue;
        const n = Math.sqrt(n2);
        // Lambert-ish term: +1 fully lit (upper-left), -1 in shadow.
        const nl = (-nx - ny) / Math.SQRT2;
        let color: number;
        if (n > 0.93)
          color = PAL.rindDark; // crisp rim
        else if (nl > 0.45)
          color = PAL.rindLight; // lit cap
        else if (nl > -0.6)
          color = PAL.rindMid; // body (most of it)
        else color = PAL.rindDark; // thin shaded crescent, lower-right
        sheet.px(off + x, y, color);
      }
    }

    // Meridian stripes: longitudes evenly spaced around the melon. As `phase`
    // advances they sweep across the visible face; only the front hemisphere
    // (cos(lon) > threshold) is drawn. Each meridian narrows toward the poles,
    // tracing the curved stripe silhouette of a real watermelon.
    for (let s = 0; s < STRIPES; s++) {
      const lon = phase + (s / STRIPES) * Math.PI * 2;
      const facing = Math.cos(lon);
      if (facing <= 0.12) continue; // back-facing — hidden
      const sinL = Math.sin(lon);
      for (let y = 0; y < H; y++) {
        const ny = (y - cy) / Ry;
        if (Math.abs(ny) >= 0.97) continue; // skip the very poles
        const halfW = Rx * Math.sqrt(1 - ny * ny);
        // Slight wobble so stripes look hand-drawn, not laser-straight.
        const wobble = Math.sin(ny * Math.PI * 1.6 + lon) * 0.8;
        const x = Math.round(cx + sinL * halfW + wobble);
        sheet.px(off + x, y, PAL.rindDark);
        // Thicken toward the equator where the meridian faces us most.
        if (facing > 0.55 && Math.abs(ny) < 0.75) {
          sheet.px(off + x + 1, y, PAL.rindDark);
        }
      }
    }

    // Specular glint, upper-left, on the lit cap.
    const gx = Math.round(cx - Rx * 0.42);
    const gy = Math.round(cy - Ry * 0.45);
    sheet.px(off + gx, gy, PAL.fleshHighlight);
    sheet.px(off + gx + 1, gy, PAL.fleshHighlight);
    sheet.px(off + gx, gy + 1, PAL.fleshHighlight);
  }

  if (scene.textures.exists(TEX.watermelonSlice)) scene.textures.remove(TEX.watermelonSlice);
  scene.textures.addSpriteSheet(TEX.watermelonSlice, sheet.canvas as unknown as HTMLImageElement, {
    frameWidth: W,
    frameHeight: H,
  });
}

// 12x18 glowing-yellow power-up cylinder. A vertical capsule with a bright core
// highlight stripe; an inner dark glyph signals which ability it grants
// (vertical bars = multi-laser, a burst = area-blast). Yellow keeps them clearly
// distinct from the green watermelons; the glyph distinguishes the two abilities.
function drawPowerCylinder(scene: Phaser.Scene, key: string, glyph: "laser" | "bomb"): void {
  const pc = new PixelCanvas(12, 18);
  const legend = {
    e: PAL.powerEdge,
    m: PAL.powerMid,
    l: PAL.powerLight,
    c: PAL.powerCore,
    g: PAL.powerGlyph,
  };
  // Rounded capsule body with a vertical core-light stripe.
  const base = [
    "...eeee...",
    "..emmmme..",
    ".emmllmme.",
    ".emlcclme.",
    "emmlcclmme",
    "emmlcclmme",
    "emmlcclmme",
    "emmlcclmme",
    "emmlcclmme",
    "emmlcclmme",
    "emmlcclmme",
    "emmlcclmme",
    "emmlcclmme",
    ".emlcclme.",
    ".emmllmme.",
    "..emmmme..",
    "...eeee...",
  ];
  pc.stamp(1, 0, base, legend);

  // Inner glyph overlaid on the body center.
  if (glyph === "laser") {
    // Three short vertical bars.
    const bars = ["g.g.g", "g.g.g", "g.g.g", "g.g.g"];
    pc.stamp(4, 7, bars, legend);
  } else {
    // Radiating burst (star).
    const burst = ["..g..", "g.g.g", ".ggg.", "g.g.g", "..g.."];
    pc.stamp(4, 6, burst, legend);
  }
  pc.registerTexture(scene, key);
}

function drawStars(scene: Phaser.Scene): void {
  // Small star: 1px white.
  const small = new PixelCanvas(2, 2);
  small.px(0, 0, 0xffffff);
  small.registerTexture(scene, TEX.star);

  // Big star: 4-point twinkle.
  const big = new PixelCanvas(5, 5);
  big.px(2, 0, 0xffffff);
  big.px(2, 4, 0xffffff);
  big.px(0, 2, 0xffffff);
  big.px(4, 2, 0xffffff);
  big.px(1, 1, 0xfff0a8);
  big.px(3, 1, 0xfff0a8);
  big.px(1, 3, 0xfff0a8);
  big.px(3, 3, 0xfff0a8);
  big.px(2, 2, 0xffffff);
  big.registerTexture(scene, TEX.starBig);
}

function drawShockwave(scene: Phaser.Scene): void {
  const pc = new PixelCanvas(32, 32);
  pc.ring(16, 16, 14, PAL.shockwave);
  pc.ring(16, 16, 11, PAL.bulletGlow);
  pc.registerTexture(scene, TEX.shockwave);
}

function drawSeed(scene: Phaser.Scene): void {
  const pc = new PixelCanvas(4, 6);
  pc.rect(1, 0, 2, 6, PAL.seed);
  pc.px(2, 1, PAL.seedShine);
  pc.registerTexture(scene, TEX.seed);
}

// 16x12 wedge: flat cut top (flesh + seeds), curved rind base.
function drawWatermelonChunk(scene: Phaser.Scene): void {
  const pc = new PixelCanvas(16, 12);
  const legend = {
    R: PAL.flesh,
    H: PAL.fleshLight,
    s: PAL.seed,
    l: PAL.rindLight,
    m: PAL.rindMid,
    d: PAL.rindDark,
  };
  const grid = [
    "RRRRRRRRRRRRRRRR",
    "RRRRHHRRRRRRRRRR",
    "RRsRRRRRRRRRsRRR",
    "RRRRRRRRRRRRRRRR",
    "RRRRRRsRRRRRRRRR",
    ".RRRRRRRRRRRRRR.",
    ".RRRRRRRRRRRRRR.",
    "..llllllllllll..",
    "...mmmmmmmmmm...",
    "....dddddddd....",
    ".....dddddd.....",
    "......dddd......",
  ];
  pc.stamp(0, 0, grid, legend);
  pc.registerTexture(scene, TEX.watermelonChunk);
}

export function generateAllSprites(scene: Phaser.Scene): void {
  drawShip(scene, false, TEX.ship);
  drawShip(scene, true, TEX.shipThrust);
  drawBullet(scene);
  drawWatermelon(scene);
  drawWatermelonChunk(scene);
  drawStars(scene);
  drawShockwave(scene);
  drawSeed(scene);
  drawPowerCylinder(scene, TEX.powerLaser, "laser");
  drawPowerCylinder(scene, TEX.powerBomb, "bomb");
}
