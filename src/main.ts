import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { initEventBus } from "./agent/events";
import { readAgentConfig } from "./agent/config";
import { installFavicon } from "./art/favicon";

installFavicon();
const cfg = readAgentConfig();
initEventBus(cfg.seed);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    // FIT scales the 480x640 logical surface up to the largest size that fits
    // in the parent while preserving aspect ratio; CENTER_BOTH pins the
    // resulting canvas inside #game. expandParent=false stops Phaser from
    // resizing the parent div (we already size #game to 100vw/100vh in CSS),
    // which previously stretched it and shoved the canvas off-axis.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: false,
    width: 480,
    height: 640,
  },
  backgroundColor: "#05030a",
  // Enable Phaser's Gamepad plugin (W3C Gamepad API) so scenes can read a
  // DualShock / USB arcade encoder via `this.input.gamepad`. Off by default.
  input: { gamepad: true },
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
