import Phaser from "phaser";
import { TEX } from "../art/sprites";

const DEPTH = 9000;
const LIFE_X = 12;
const LIFE_Y = 12;
const LIFE_SPACING = 22;
const LIFE_SCALE = 1.25;
const MAX_LIFE_ICONS = 9;

function formatScore(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(6, "0");
}

// Always-visible player HUD: row of mini-ship life icons (top-left) and a
// monospace score counter (top-right). Kept separate from the dev DebugHud.
export class GameHud {
  private scene: Phaser.Scene;
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private scoreLabel: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private lives = 0;
  private capacity: number;

  constructor(scene: Phaser.Scene, opts: { lives: number; score: number } = { lives: 3, score: 0 }) {
    this.scene = scene;
    this.capacity = Math.min(MAX_LIFE_ICONS, Math.max(1, opts.lives));

    for (let i = 0; i < this.capacity; i++) {
      const icon = scene.add
        .image(LIFE_X + i * LIFE_SPACING, LIFE_Y, TEX.ship)
        .setOrigin(0, 0)
        .setScale(LIFE_SCALE)
        .setScrollFactor(0)
        .setDepth(DEPTH);
      this.lifeIcons.push(icon);
    }

    const { width } = scene.scale;
    this.scoreLabel = scene.add
      .text(width - 12, 10, "SCORE", {
        fontFamily: "Courier New, monospace",
        fontSize: "10px",
        color: "#b8eaff",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH);
    this.scoreText = scene.add
      .text(width - 12, 22, formatScore(opts.score), {
        fontFamily: "Courier New, monospace",
        fontSize: "20px",
        color: "#fff0a8",
        stroke: "#9b3aff",
        strokeThickness: 3,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH);

    this.setLives(opts.lives);
    this.setScore(opts.score);
  }

  setLives(n: number): void {
    const prev = this.lives;
    this.lives = Math.max(0, Math.min(this.capacity, n));
    for (let i = 0; i < this.lifeIcons.length; i++) {
      const icon = this.lifeIcons[i];
      const shouldShow = i < this.lives;
      if (i < prev && i >= this.lives) {
        // Lost this icon — flash + fade before hiding.
        this.scene.tweens.add({
          targets: icon,
          alpha: { from: 1, to: 0 },
          scale: { from: LIFE_SCALE * 1.4, to: LIFE_SCALE * 0.6 },
          duration: 280,
          ease: "Cubic.easeIn",
          onComplete: () => {
            icon.setVisible(false).setAlpha(1).setScale(LIFE_SCALE);
          },
        });
      } else {
        icon.setVisible(shouldShow).setAlpha(1).setScale(LIFE_SCALE);
      }
    }
  }

  setScore(n: number): void {
    this.scoreText.setText(formatScore(n));
  }

  // Floats "+amount" / "-amount" up from (x,y) and fades out. Positive uses
  // the warm score color; negative (escape penalty) uses a hot red so the
  // player notices the punishment.
  popScore(x: number, y: number, amount: number): void {
    const positive = amount >= 0;
    const label = positive ? `+${amount}` : `${amount}`; // negative already has '-'
    const text = this.scene.add
      .text(x, y, label, {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: positive ? "#fff0a8" : "#ff5577",
        stroke: positive ? "#9b3aff" : "#3a0010",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH - 10);
    this.scene.tweens.add({
      targets: text,
      y: y - 28,
      alpha: { from: 1, to: 0 },
      ease: "Cubic.easeOut",
      duration: 550,
      onComplete: () => text.destroy(),
    });
  }

  setVisible(v: boolean): void {
    for (const icon of this.lifeIcons) icon.setVisible(v && this.lifeIcons.indexOf(icon) < this.lives);
    this.scoreLabel.setVisible(v);
    this.scoreText.setVisible(v);
  }

  destroy(): void {
    for (const icon of this.lifeIcons) icon.destroy();
    this.scoreLabel.destroy();
    this.scoreText.destroy();
  }
}
