import Phaser from "phaser";

// Tiny helper for hand-laying out pixel art into a Phaser texture.
// We draw onto an offscreen canvas at 1x and then register it as a texture;
// Phaser's nearest-neighbor filter + CSS image-rendering: pixelated upscales
// crisply at runtime.
export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly w: number;
  readonly h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) throw new Error("2d context unavailable");
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  px(x: number, y: number, rgb: number, a = 1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    this.ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    this.ctx.fillRect(x, y, 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, rgb: number, a = 1): void {
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    this.ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    this.ctx.fillRect(x, y, w, h);
  }

  // Paint by ascii grid. Space = skip, characters map via legend.
  stamp(x0: number, y0: number, grid: string[], legend: Record<string, number>): void {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === " " || ch === ".") continue;
        const c = legend[ch];
        if (c == null) continue;
        this.px(x0 + x, y0 + y, c);
      }
    }
  }

  // Filled circle by integer scan.
  disc(cx: number, cy: number, r: number, rgb: number): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) this.px(cx + x, cy + y, rgb);
      }
    }
  }

  // Circle outline.
  ring(cx: number, cy: number, r: number, rgb: number): void {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d2 = x * x + y * y;
        if (d2 <= r * r && d2 >= (r - 1) * (r - 1)) this.px(cx + x, cy + y, rgb);
      }
    }
  }

  registerTexture(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, this.canvas);
  }
}
