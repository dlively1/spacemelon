import Phaser from "phaser";
import { getEventBus } from "../agent/events";
import { Rng } from "../agent/rng";
import { buildBackground, worldForLevel } from "../worlds/worlds";
import { readAgentConfig } from "../agent/config";
import { loadBestScore } from "../agent/highscore";
import { Controls } from "../input/Controls";

export class MenuScene extends Phaser.Scene {
  private controls!: Controls;

  constructor() {
    super("menu");
  }

  create(): void {
    const bus = getEventBus();
    const best = loadBestScore();
    bus.emit({ type: "scene", t: this.time.now, name: "menu" });
    bus.updateSnapshot({ scene: "menu", bestScore: best });

    const cfg = readAgentConfig();
    const world = worldForLevel(cfg.startLevel);
    const rng = new Rng(cfg.seed);
    buildBackground(this, world, rng);

    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2 - 80, "SPACEMELONS", {
        fontFamily: "Courier New, monospace",
        fontSize: "48px",
        color: "#fff0a8",
        stroke: "#9b3aff",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 - 30, "BLAST THE WATERMELONS", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#ff7bd1",
      })
      .setOrigin(0.5);

    if (best > 0) {
      this.add
        .text(width / 2, height / 2 + 8, `BEST  ${best.toString().padStart(6, "0")}`, {
          fontFamily: "Courier New, monospace",
          fontSize: "13px",
          color: "#b8eaff",
        })
        .setOrigin(0.5);
    }
    const prompt = this.add
      .text(width / 2, height / 2 + 60, "PRESS  SPACE  TO  START", {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: "#b8eaff",
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.3 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    this.add
      .text(width / 2, height - 30, "Arrows / WASD / Pad to move  ·  Space / ✕ to fire", {
        fontFamily: "Courier New, monospace",
        fontSize: "11px",
        color: "#6ac3ff",
      })
      .setOrigin(0.5);

    this.controls = new Controls(this);
    this.input.keyboard?.once("keydown-SPACE", () => this.startGame());
    this.input.keyboard?.once("keydown-ENTER", () => this.startGame());

    // Autoplay path for headless agents — skip menu immediately.
    if (cfg.autoplay) {
      this.time.delayedCall(100, () => this.startGame());
    }
  }

  update(): void {
    // Gamepad confirm (✕ / Options) starts the game. Keyboard SPACE/ENTER are
    // handled by the once() listeners above; the autoplay path is unaffected.
    this.controls.update();
    if (this.controls.confirmPressed()) this.startGame();
  }

  private startGame(): void {
    this.scene.start("game");
  }
}
