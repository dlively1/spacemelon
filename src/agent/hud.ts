import Phaser from "phaser";
import { getEventBus } from "./events";
import { MONO_FONT } from "../ui/text";

export class DebugHud {
  private text: Phaser.GameObjects.Text;
  private bus = getEventBus();
  private lastEmit = 0;

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(8, 8, "", {
        fontFamily: MONO_FONT,
        fontSize: "12px",
        color: "#9fffd9",
        backgroundColor: "rgba(0,0,0,0.45)",
        padding: { x: 6, y: 4 },
        resolution: 2,
      })
      .setScrollFactor(0)
      .setDepth(10_000);
  }

  update(scene: Phaser.Scene, info: { level: number; world: string; score: number; lives: number; entities: number }): void {
    const fps = Math.round(scene.game.loop.actualFps);
    const s = this.bus.snapshot;
    this.text.setText(
      [
        `SPACEMELON  fps:${fps}  seed:0x${s.seed.toString(16)}`,
        `world:${info.world}  lvl:${info.level}  score:${info.score}  lives:${info.lives}`,
        `entities:${info.entities}`,
      ].join("\n")
    );
    // Throttle frame events to ~4Hz so the buffer stays useful.
    const now = scene.time.now;
    if (now - this.lastEmit > 250) {
      this.bus.emit({ type: "frame", t: now, fps, entities: info.entities });
      this.lastEmit = now;
    }
  }

  setVisible(v: boolean): void {
    this.text.setVisible(v);
  }
}
