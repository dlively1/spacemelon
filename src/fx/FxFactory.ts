import Phaser from "phaser";
import { TEX } from "../art/sprites";
import type { Rng } from "../agent/rng";

const RAD_TO_DEG = 180 / Math.PI;

// Pooled / batched explosion FX. The previous implementation created 10–18
// throwaway Images + tweens per kill; an area blast killing several melons
// allocated ~100 objects in one frame — exactly when a GC pause hurts most.
// Slices and seeds are now GPU-batched particle emitters (particles are
// pooled internally by Phaser), and the shockwave ring reuses a small pool
// of tweened images.
//
// Per-particle randomness routes through the injected seeded Rng so FX stay
// reproducible per seed (useful for screenshot-based visual review).
export class FxFactory {
  private scene: Phaser.Scene;
  private rng: Rng;
  private slices: Phaser.GameObjects.Particles.ParticleEmitter;
  private seeds: Phaser.GameObjects.Particles.ParticleEmitter;
  private rings: Phaser.GameObjects.Image[] = [];
  // Magnitude of the explosion currently being emitted — read by the
  // particle op callbacks below (explode() is synchronous, so this is safe).
  private mag = 1;

  constructor(scene: Phaser.Scene, rng: Rng) {
    this.scene = scene;
    this.rng = rng;

    this.slices = scene.add.particles(0, 0, TEX.watermelonChunk, {
      emitting: false,
      lifespan: 650,
      angle: { onEmit: () => this.rng.range(0, 360) },
      speed: { onEmit: () => this.rng.range(110, 220) * this.mag },
      // Rind in the texture points down (+y); align it to the travel
      // direction once the emitter has computed this particle's velocity.
      rotate: {
        onEmit: (p) => (p ? Math.atan2(p.velocityY, p.velocityX) * RAD_TO_DEG - 90 : 0),
      },
      scale: {
        onEmit: () => 2 * this.mag,
        // Shrink to 70% over the particle's life (t runs 0→1).
        onUpdate: (_p, _k, t, v) => v * (1 - 0.3 * t),
      },
      alpha: { start: 1, end: 0 },
    });
    this.slices.setDepth(500);

    this.seeds = scene.add.particles(0, 0, TEX.seed, {
      emitting: false,
      lifespan: 500,
      angle: { onEmit: () => this.rng.range(0, 360) },
      speed: { onEmit: () => this.rng.range(40, 110) * this.mag },
      scale: 2,
      alpha: { start: 1, end: 0 },
    });
    this.seeds.setDepth(501);
  }

  /** Burst at (x, y). magnitude: 1 = small melon, 2 = mega, 3 = area blast. */
  explode(x: number, y: number, magnitude = 1): void {
    this.mag = magnitude;
    this.slices.explode(magnitude > 1 ? 9 : 5, x, y);
    this.seeds.explode(magnitude > 1 ? 8 : 4, x, y);
    this.spawnRing(x, y, magnitude);
  }

  private spawnRing(x: number, y: number, magnitude: number): void {
    let ring = this.rings.pop();
    if (!ring) {
      ring = this.scene.add.image(0, 0, TEX.shockwave).setBlendMode(Phaser.BlendModes.ADD);
    }
    ring
      .setPosition(x, y)
      .setScale(0.5 * magnitude)
      .setAlpha(1)
      .setActive(true)
      .setVisible(true);
    this.scene.tweens.add({
      targets: ring,
      scale: 3 * magnitude,
      alpha: { from: 1, to: 0 },
      duration: 380 + magnitude * 80,
      onComplete: () => {
        ring.setActive(false).setVisible(false);
        this.rings.push(ring);
      },
    });
  }
}
