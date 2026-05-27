import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { initEventBus } from "./agent/events";
import { readAgentConfig } from "./agent/config";

const cfg = readAgentConfig();
initEventBus(cfg.seed);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: 480,
  height: 640,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: "#05030a",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: cfg.debug,
    },
  },
  scene: [BootScene, MenuScene, GameScene],
};

new Phaser.Game(config);
