import Phaser from "phaser";
import { getEventBus } from "./events";

export class DebugHud {
  private text: Phaser.GameObjects.Text;
  private bus = getEventBus();

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(8, 8, "", {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: "#9fffd9",
        backgroundColor: "rgba(0,0,0,0.45)",
        padding: { x: 6, y: 4 },
        resolution: 2,
      })
      .setScrollFactor(0)
      .setDepth(10_000);
  }

  update(
    scene: Phaser.Scene,
    info: { level: number; world: string; score: number; lives: number; entities: number },
  ): void {
    const fps = Math.round(scene.game.loop.actualFps);
    const s = this.bus.snapshot;
    this.text.setText(
      [
        `SPACEMELON  fps:${fps}  seed:0x${s.seed.toString(16)}`,
        `world:${info.world}  lvl:${info.level}  score:${info.score}  lives:${info.lives}`,
        `entities:${info.entities}`,
      ].join("\n"),
    );
    // Frame telemetry events are emitted by GameScene (always on, ~4Hz) —
    // this HUD is display-only.
  }

  setVisible(v: boolean): void {
    this.text.setVisible(v);
  }
}
