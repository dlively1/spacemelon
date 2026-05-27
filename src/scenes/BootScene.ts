import Phaser from "phaser";
import { generateAllSprites } from "../art/sprites";
import { getEventBus } from "../agent/events";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    generateAllSprites(this);
    // Make sure pixel art stays crisp on resize.
    this.textures.list && Object.values(this.textures.list).forEach((tex) => {
      tex.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
    });
    const bus = getEventBus();
    bus.emit({ type: "boot", t: this.time.now });
    bus.updateSnapshot({ ready: true });
    this.scene.start("menu");
  }
}
