import Phaser from "phaser";

export interface GameOverStats {
  score: number;
  level: number;
  killedTotal: number;
  newBest: boolean;
  bestScore: number;
}

// Builds the game-over results panel. The hint line starts hidden — the
// scene reveals it once the restart input lock expires.
export function buildGameOverPanel(
  scene: Phaser.Scene,
  stats: GameOverStats,
): { container: Phaser.GameObjects.Container; hint: Phaser.GameObjects.Text } {
  const { width, height } = scene.scale;
  const cx = width / 2;
  const cy = height / 2;
  const container = scene.add.container(cx, cy).setDepth(5000).setScrollFactor(0);

  const W = 280;
  const H = 240;
  const bg = scene.add.rectangle(0, 0, W, H, 0x05030a, 0.85).setStrokeStyle(2, 0x9b3aff, 1);
  container.add(bg);

  const fmt = (n: number) => n.toString().padStart(6, "0");
  const label = (s: string) => s.padEnd(12, " ");
  const lines: Array<{ text: string; y: number; size: number; color: string; stroke?: string }> = [
    { text: "GAME OVER", y: -98, size: 28, color: "#ff7bd1", stroke: "#150033" },
    { text: "─────────────────", y: -64, size: 12, color: "#9b3aff" },
    { text: `${label("SCORE")}${fmt(stats.score)}`, y: -38, size: 14, color: "#fff0a8" },
    {
      text: `${label("LEVEL")}${stats.level.toString().padStart(6, " ")}`,
      y: -18,
      size: 14,
      color: "#b8eaff",
    },
    {
      text: `${label("MELONS")}${stats.killedTotal.toString().padStart(6, " ")}`,
      y: 2,
      size: 14,
      color: "#77d76d",
    },
    { text: "─────────────────", y: 24, size: 12, color: "#9b3aff" },
  ];
  for (const l of lines) {
    const t = scene.add
      .text(0, l.y, l.text, {
        fontFamily: "Courier New, monospace",
        fontSize: `${l.size}px`,
        color: l.color,
        ...(l.stroke ? { stroke: l.stroke, strokeThickness: 3 } : {}),
      })
      .setOrigin(0.5);
    container.add(t);
  }

  if (stats.newBest) {
    const badge = scene.add
      .text(0, 50, "★  NEW BEST  ★", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#fff0a8",
        stroke: "#ff9d3a",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    container.add(badge);
    scene.tweens.add({
      targets: badge,
      scale: { from: 1, to: 1.1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  } else {
    const best = scene.add
      .text(0, 50, `${label("BEST")}${fmt(stats.bestScore)}`, {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#b8eaff",
      })
      .setOrigin(0.5);
    container.add(best);
  }

  const hint = scene.add
    .text(0, 96, "ENTER  RESTART      ESC  MENU", {
      fontFamily: "Courier New, monospace",
      fontSize: "11px",
      color: "#6ac3ff",
    })
    .setOrigin(0.5)
    .setVisible(false);
  container.add(hint);
  scene.tweens.add({
    targets: hint,
    alpha: { from: 1, to: 0.35 },
    duration: 700,
    yoyo: true,
    repeat: -1,
  });

  return { container, hint };
}
