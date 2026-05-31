import Phaser from "phaser";
import { TEX } from "../art/sprites";
import type { AbilityType } from "../entities/Pickup";

const DEPTH = 9000;

const ABILITY_META: Record<AbilityType, { label: string; tex: string; color: string }> = {
  multiLaser: { label: "MULTI-LASER", tex: TEX.powerLaser, color: "#ffe14d" },
  areaBlast: { label: "AREA-BLAST", tex: TEX.powerBomb, color: "#ffe14d" },
};

const ABILITY_BAR_W = 96;
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
  // Active-ability badge (top-center). Built lazily on first setAbility.
  private abilityContainer: Phaser.GameObjects.Container | null = null;
  private abilityIcon: Phaser.GameObjects.Image | null = null;
  private abilityLabel: Phaser.GameObjects.Text | null = null;
  private abilityBar: Phaser.GameObjects.Rectangle | null = null;

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

  // Show (or update) the active-ability badge at top-center: pickup icon,
  // ability name, and a full timer bar that drains via updateAbilityTimer.
  setAbility(type: AbilityType): void {
    const meta = ABILITY_META[type];
    const { width } = this.scene.scale;
    const cx = width / 2;

    if (!this.abilityContainer) {
      this.abilityContainer = this.scene.add
        .container(cx, 44)
        .setScrollFactor(0)
        .setDepth(DEPTH);
      this.abilityIcon = this.scene.add.image(-ABILITY_BAR_W / 2 - 12, 0, meta.tex).setScale(1.5);
      this.abilityLabel = this.scene.add
        .text(0, -10, meta.label, {
          fontFamily: "Courier New, monospace",
          fontSize: "11px",
          color: meta.color,
          stroke: "#3a2606",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0.5);
      const track = this.scene.add
        .rectangle(0, 8, ABILITY_BAR_W, 5, 0x3a2606, 0.85)
        .setOrigin(0.5, 0.5)
        .setStrokeStyle(1, 0xf2b81f, 1);
      this.abilityBar = this.scene.add
        .rectangle(-ABILITY_BAR_W / 2, 8, ABILITY_BAR_W, 5, 0xffe14d, 1)
        .setOrigin(0, 0.5);
      this.abilityContainer.add([this.abilityIcon, this.abilityLabel, track, this.abilityBar]);
    } else {
      this.abilityIcon!.setTexture(meta.tex);
      this.abilityLabel!.setText(meta.label).setColor(meta.color);
    }
    this.abilityContainer.setVisible(true);
    this.updateAbilityTimer(1);
  }

  // frac01 = remaining fraction of the ability duration (1 → full, 0 → expired).
  updateAbilityTimer(frac01: number): void {
    if (!this.abilityBar) return;
    this.abilityBar.scaleX = Phaser.Math.Clamp(frac01, 0, 1);
  }

  clearAbility(): void {
    this.abilityContainer?.setVisible(false);
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
    if (!v) this.abilityContainer?.setVisible(false);
  }

  destroy(): void {
    for (const icon of this.lifeIcons) icon.destroy();
    this.scoreLabel.destroy();
    this.scoreText.destroy();
    this.abilityContainer?.destroy(true);
  }
}
