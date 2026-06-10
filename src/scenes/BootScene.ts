import Phaser from "phaser";
import { generateAllSprites } from "../art/sprites";
import { generatePixelFont } from "../art/pixelFont";
import { getEventBus } from "../agent/events";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    generateAllSprites(this);
    generatePixelFont(this);
    // Make sure pixel art stays crisp on resize.
    for (const tex of Object.values(this.textures.list)) {
      tex.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
    }
    const bus = getEventBus();
    bus.emit({ type: "boot", t: this.time.now });
    bus.updateSnapshot({ ready: true });
    this.scene.start("menu");
  }
}
