import Phaser from "phaser";
import { PAL } from "./palettes";
import { PixelCanvas } from "./pixelCanvas";
import { Rng } from "../agent/rng";

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
} as const;

// 24x24 ship. Symmetric Galaga-style fighter with cockpit + thrusters.
function drawShip(scene: Phaser.Scene, thrusting: boolean, key: string): void {
  const pc = new PixelCanvas(24, 28);
  const legend = {
    "#": PAL.hullDark,
    "H": PAL.hull,
    "L": PAL.hullLight,
    "E": PAL.hullEdge,
    "C": PAL.cockpit,
    "O": PAL.cockpitEdge,
    "T": PAL.thruster,
    "*": PAL.thrusterHot,
  };
  const grid = [
    "..........EE............",
    ".........EHHE...........", // nose
    ".........EHHE...........",
    "........ELHHLE..........",
    "........ELCCLE..........",
    "........EOCCOE..........",
    ".......EHLCCLHE.........",
    "......EEHHCCHHEE........",
    ".....EHHHLCCLHHHE.......",
    "....EHHHHHCCHHHHHE......",
    "...EHHHHHHCCHHHHHHE.....",
    "..EHHLHHHHCCHHHHLHHE....",
    ".EHHLLHHHHCCHHHHLLHHE...",
    ".EHLLHHHHHCCHHHHHLLHE...",
    "EHLL#HHHHHCCHHHHH#LLHE..",
    "EHL##HHHHHCCHHHHH##LHE..",
    "EHL#.HHHHHHHHHHHH.#LHE..",
    "EHL#.HHHHHHHHHHHH.#LHE..",
    ".E#..#HHHHHHHHHH#..#E...",
    ".....#HH##HH##HH#.......",
    ".....#H#TT##TT#H#.......",
    "......#TT*TT*TT#........",
    ".......*T**T**T*........",
  ];
  pc.stamp(0, 1, grid, legend);

  if (thrusting) {
    // Flickery flame plume below thrusters.
    const flameLegend = { "t": PAL.thruster, "f": PAL.thrusterHot, "h": PAL.cockpit };
    const flame = [
      "......t.t..t.t..",
      ".....tftftftft..",
      "......fhfhfhf...",
      ".......ththt....",
      "........t.t.....",
    ];
    pc.stamp(4, 23, flame, flameLegend);
  }
  pc.registerTexture(scene, key);
}

// 6x14 bullet: hot core with neon glow.
function drawBullet(scene: Phaser.Scene): void {
  const pc = new PixelCanvas(6, 14);
  const legend = {
    "c": PAL.bulletCore,
    "g": PAL.bulletGlow,
    "e": PAL.bulletEdge,
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
// Each frame rotates the seed/stripe pattern so it looks like it's spinning.
function drawWatermelon(scene: Phaser.Scene): void {
  const W = 28;
  const H = 28;
  const FRAMES = 4;
  const sheet = new PixelCanvas(W * FRAMES, H);
  const rng = new Rng(0xC0FFEE);

  const cx = W / 2 - 0.5;
  const cy = H / 2 - 0.5;
  const R = 12;

  for (let f = 0; f < FRAMES; f++) {
    const off = f * W;
    // Rind: outer dark, mid green, light highlight, stripes.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const d = Math.sqrt(d2);
        let color: number = PAL.rindMid;
        if (d > R - 1) color = PAL.rindDark;
        else if (d > R - 3) color = PAL.rindMid;
        else if (d > R - 4.5) color = PAL.rindLight;
        else color = PAL.flesh;
        sheet.px(off + x, y, color);
      }
    }
    // Stripes on rind (rotate per frame for spin effect).
    const phase = (f / FRAMES) * Math.PI * 2;
    for (let s = 0; s < 6; s++) {
      const ang = phase + (s / 6) * Math.PI * 2;
      const sx = Math.cos(ang);
      const sy = Math.sin(ang);
      for (let t = R - 4; t < R; t++) {
        const x = Math.round(cx + sx * t);
        const y = Math.round(cy + sy * t);
        sheet.px(off + x, y, PAL.rindStripe);
      }
    }
    // Flesh shading: lighter band toward upper-left.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > (R - 4.5) * (R - 4.5)) continue;
        if (dx + dy < -3 && rng.chance(0.5)) {
          sheet.px(off + x, y, PAL.fleshLight);
        }
      }
    }
    // Seeds — placed in a ring that rotates per frame.
    const seedCount = 7;
    for (let i = 0; i < seedCount; i++) {
      const a = phase * 1.3 + (i / seedCount) * Math.PI * 2;
      const r = 4 + ((i * 1.7) % 3);
      const sx = Math.round(cx + Math.cos(a) * r);
      const sy = Math.round(cy + Math.sin(a) * r);
      sheet.px(off + sx, sy, PAL.seed);
      sheet.px(off + sx, sy - 1, PAL.seed);
      sheet.px(off + sx + 1, sy, PAL.seedShine);
    }
    // Specular pip top-left.
    sheet.px(off + Math.round(cx - 5), Math.round(cy - 6), PAL.fleshHighlight);
    sheet.px(off + Math.round(cx - 4), Math.round(cy - 6), PAL.fleshHighlight);
    sheet.px(off + Math.round(cx - 5), Math.round(cy - 5), PAL.fleshHighlight);
  }

  if (scene.textures.exists(TEX.watermelonSlice)) scene.textures.remove(TEX.watermelonSlice);
  scene.textures.addSpriteSheet(TEX.watermelonSlice, sheet.canvas as unknown as HTMLImageElement, {
    frameWidth: W,
    frameHeight: H,
  });
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
    "R": PAL.flesh,
    "H": PAL.fleshLight,
    "s": PAL.seed,
    "l": PAL.rindLight,
    "m": PAL.rindMid,
    "d": PAL.rindDark,
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
}
