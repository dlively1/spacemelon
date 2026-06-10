import Phaser from "phaser";
import { PixelCanvas } from "./pixelCanvas";

// Procedural retro bitmap font for high-churn text (score popups). Phaser's
// `Text` objects rasterize to their own canvas and re-upload a texture on
// every setText — far too expensive to create per score event. BitmapText
// glyphs render as plain batched quads instead.
//
// Glyphs are white with a 1px dark outline, so setTint() colors the fill
// while the outline stays dark — one font serves every popup color.

export const FONT = {
  pixel: "font:pixel",
} as const;

const FONT_TEX = "tex:font:pixel";

export const PIXEL_FONT_CHARS = "0123456789+-";

// 5x7 glyphs, one string row per pixel row ('#' = lit).
const GLYPHS: Record<string, string[]> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "####.", "#...#", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
};

// Cell = 5x7 glyph + 1px outline margin on every side.
const CELL_W = 7;
const CELL_H = 9;

const FILL = 0xffffff;
const OUTLINE = 0x10041c;

export function generatePixelFont(scene: Phaser.Scene): void {
  const pc = new PixelCanvas(CELL_W * PIXEL_FONT_CHARS.length, CELL_H);

  for (let i = 0; i < PIXEL_FONT_CHARS.length; i++) {
    const rows = GLYPHS[PIXEL_FONT_CHARS[i]];
    const x0 = i * CELL_W + 1;
    const y0 = 1;
    // Outline pass: stamp the 8 neighbors of every lit pixel first…
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        if (rows[y][x] !== "#") continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            pc.px(x0 + x + dx, y0 + y + dy, OUTLINE);
          }
        }
      }
    }
    // …then the white fill on top.
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        if (rows[y][x] === "#") pc.px(x0 + x, y0 + y, FILL);
      }
    }
  }

  pc.registerTexture(scene, FONT_TEX);

  const config: Phaser.Types.GameObjects.BitmapText.RetroFontConfig = {
    image: FONT_TEX,
    "offset.x": 0,
    "offset.y": 0,
    width: CELL_W,
    height: CELL_H,
    chars: PIXEL_FONT_CHARS,
    charsPerRow: PIXEL_FONT_CHARS.length,
    "spacing.x": 0,
    "spacing.y": 0,
    lineSpacing: 0,
  };
  if (scene.cache.bitmapFont.exists(FONT.pixel)) scene.cache.bitmapFont.remove(FONT.pixel);
  scene.cache.bitmapFont.add(FONT.pixel, Phaser.GameObjects.RetroFont.Parse(scene, config));
}
