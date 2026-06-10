import { PAL } from "./palettes";

// Generates a 64x64 watermelon pixel-art favicon and injects it into <head>.
export function installFavicon(): void {
  const SIZE = 64;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = SIZE / 2 - 2;

  function toRgba(rgb: number, a = 1): string {
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    return `rgba(${r},${g},${b},${a})`;
  }

  function px(x: number, y: number, rgb: number, a = 1): void {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    ctx.fillStyle = toRgba(rgb, a);
    ctx.fillRect(x, y, 1, 1);
  }

  // Rind + flesh fill
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R) continue;
      let color: number;
      if (d > R - 1.5) color = PAL.rindDark;
      else if (d > R - 5) color = PAL.rindMid;
      else if (d > R - 8) color = PAL.rindLight;
      else color = PAL.flesh;
      px(x, y, color);
    }
  }

  // Rind stripes — 6 dark stripes radiating outward
  for (let s = 0; s < 6; s++) {
    const ang = (s / 6) * Math.PI * 2;
    const sx = Math.cos(ang);
    const sy = Math.sin(ang);
    for (let t = R - 8; t < R - 1; t++) {
      const x = Math.round(cx + sx * t);
      const y = Math.round(cy + sy * t);
      px(x, y, PAL.rindStripe);
      // 2px wide at outer edge
      if (t > R - 4) {
        px(
          Math.round(cx + sx * t) + Math.round(-sy),
          Math.round(cy + sy * t) + Math.round(sx),
          PAL.rindStripe,
        );
      }
    }
  }

  // Flesh highlight band (upper-left quarter)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > (R - 8) * (R - 8)) continue;
      if (dx + dy < -6) px(x, y, PAL.fleshLight);
    }
  }

  // Seeds — ring of 7, radius ~12
  const seedR = SIZE * 0.19;
  const seedCount = 7;
  for (let i = 0; i < seedCount; i++) {
    const a = (i / seedCount) * Math.PI * 2 + 0.4;
    const sx = Math.round(cx + Math.cos(a) * seedR);
    const sy = Math.round(cy + Math.sin(a) * seedR);
    px(sx, sy, PAL.seed);
    px(sx, sy - 1, PAL.seed);
    px(sx + 1, sy, PAL.seed);
    px(sx + 1, sy - 1, PAL.seedShine);
  }

  // Specular highlight top-left
  px(Math.round(cx - 10), Math.round(cy - 12), PAL.fleshHighlight);
  px(Math.round(cx - 9), Math.round(cy - 12), PAL.fleshHighlight);
  px(Math.round(cx - 8), Math.round(cy - 12), PAL.fleshHighlight);
  px(Math.round(cx - 10), Math.round(cy - 11), PAL.fleshHighlight);
  px(Math.round(cx - 9), Math.round(cy - 11), PAL.fleshHighlight);

  // Small vine curl at top
  px(Math.round(cx), Math.round(cy - R + 1), PAL.rindDark);
  px(Math.round(cx + 1), Math.round(cy - R), PAL.rindDark);
  px(Math.round(cx + 2), Math.round(cy - R - 1), PAL.rindMid);
  px(Math.round(cx + 3), Math.round(cy - R - 1), PAL.rindLight);

  const url = canvas.toDataURL("image/png");
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = url;
}
