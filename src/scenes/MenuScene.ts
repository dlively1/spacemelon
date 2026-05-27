import Phaser from "phaser";
import { getEventBus } from "../agent/events";
import { Rng } from "../agent/rng";
import { buildBackground, worldForLevel } from "../worlds/worlds";
import { readAgentConfig } from "../agent/config";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create(): void {
    const bus = getEventBus();
    bus.emit({ type: "scene", t: this.time.now, name: "menu" });
    bus.updateSnapshot({ scene: "menu" });

    const cfg = readAgentConfig();
    const world = worldForLevel(cfg.startLevel);
    const rng = new Rng(cfg.seed);
    buildBackground(this, world, rng);

    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2 - 80, "SPACEMELON", {
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
      .text(width / 2, height - 30, "Arrows / WASD to move  ·  Space to fire", {
        fontFamily: "Courier New, monospace",
        fontSize: "11px",
        color: "#6ac3ff",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-SPACE", () => this.startGame());
    this.input.keyboard?.once("keydown-ENTER", () => this.startGame());

    // Autoplay path for headless agents — skip menu immediately.
    if (cfg.autoplay) {
      this.time.delayedCall(100, () => this.startGame());
    }
  }

  private startGame(): void {
    this.scene.start("game");
  }
}
