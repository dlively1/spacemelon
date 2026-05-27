import Phaser from "phaser";
import { Ship } from "../entities/Ship";
import { Watermelon } from "../entities/Watermelon";
import { TEX } from "../art/sprites";
import { Rng } from "../agent/rng";
import { readAgentConfig, type AgentConfig } from "../agent/config";
import { getEventBus } from "../agent/events";
import { DebugHud } from "../agent/hud";
import { GameHud } from "../ui/GameHud";
import { loadBestScore, saveBestScore } from "../agent/highscore";
import { buildBackground, worldForLevel, type WorldDef } from "../worlds/worlds";

const WATERMELONS_TO_CLEAR = 12;
const STARTING_LIVES = 3;

export class GameScene extends Phaser.Scene {
  private ship!: Ship;
  private bullets!: Phaser.Physics.Arcade.Group;
  private melons!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private pauseKey!: Phaser.Input.Keyboard.Key;

  private rng!: Rng;
  private cfg!: AgentConfig;
  private hud!: DebugHud;
  private gameHud!: GameHud;
  private level = 1;
  private world!: WorldDef;
  private score = 0;
  private lives = STARTING_LIVES;
  private spawnedThisLevel = 0;
  private killedThisLevel = 0;
  private killedTotal = 0;
  private gameOverActive = false;
  private stars: Phaser.GameObjects.Image[] = [];
  private bgContainer!: Phaser.GameObjects.Container;
  private input$ = { left: false, right: false, up: false, down: false, fire: false };

  private initStartLevel?: number;

  constructor() {
    super("game");
  }

  init(data?: { startLevel?: number }): void {
    this.initStartLevel = data?.startLevel;
  }

  create(): void {
    this.cfg = readAgentConfig();
    this.level = Math.max(1, this.initStartLevel ?? this.cfg.startLevel);
    this.rng = new Rng(this.cfg.seed ^ (this.level * 0x9e3779b1));
    this.world = worldForLevel(this.level);
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.killedTotal = 0;
    this.gameOverActive = false;

    const bus = getEventBus();
    bus.emit({ type: "scene", t: this.time.now, name: "game" });
    bus.updateSnapshot({
      scene: "game",
      paused: false,
      score: 0,
      lives: STARTING_LIVES,
      bestScore: loadBestScore(),
    });

    const bg = buildBackground(this, this.world, this.rng);
    this.bgContainer = bg.container;
    this.stars = bg.stars;

    const { width, height } = this.scale;
    this.ship = new Ship(this, width / 2, height - 80);

    this.bullets = this.physics.add.group({
      maxSize: 32,
      classType: Phaser.Physics.Arcade.Sprite,
      runChildUpdate: false,
    });
    this.melons = this.physics.add.group({ classType: Watermelon, runChildUpdate: true });

    this.physics.add.overlap(this.bullets, this.melons, (b, m) =>
      this.onBulletHitMelon(b as Phaser.Physics.Arcade.Sprite, m as Watermelon)
    );
    this.physics.add.overlap(this.ship, this.melons, (_s, m) =>
      this.onShipHitMelon(m as Watermelon)
    );

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey("A");
    this.keyD = this.input.keyboard!.addKey("D");
    this.keyW = this.input.keyboard!.addKey("W");
    this.keyS = this.input.keyboard!.addKey("S");
    this.fireKey = this.input.keyboard!.addKey("SPACE");
    this.pauseKey = this.input.keyboard!.addKey("P");
    this.pauseKey.on("down", () => this.togglePause());

    this.gameHud = new GameHud(this, { lives: this.lives, score: this.score });
    this.hud = new DebugHud(this);
    this.hud.setVisible(this.cfg.debug);

    // Wire agent bridge → in-game input + pause.
    bus.bindInput({
      left: (d) => (this.input$.left = d),
      right: (d) => (this.input$.right = d),
      fire: (d) => (this.input$.fire = d),
      pause: () => this.togglePause(),
    });

    this.startLevel(this.level);

    if (this.cfg.paused) this.scene.pause();
  }

  private startLevel(level: number): void {
    this.level = level;
    this.world = worldForLevel(level);
    this.spawnedThisLevel = 0;
    this.killedThisLevel = 0;

    // Rebuild background for the new world.
    this.bgContainer.destroy(true);
    const bg = buildBackground(this, this.world, this.rng);
    this.bgContainer = bg.container;
    this.stars = bg.stars;

    const bus = getEventBus();
    bus.emit({ type: "level-start", t: this.time.now, level, world: this.world.id });
    bus.updateSnapshot({ level, world: this.world.id });

    // Banner.
    const { width, height } = this.scale;
    const banner = this.add
      .text(width / 2, height / 2, `LEVEL ${level}\n${this.world.name.toUpperCase()}`, {
        fontFamily: "Courier New, monospace",
        fontSize: "28px",
        align: "center",
        color: "#fff0a8",
        stroke: "#9b3aff",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(2000);
    this.tweens.add({
      targets: banner,
      alpha: { from: 1, to: 0 },
      duration: 1400,
      ease: "Sine.easeIn",
      onComplete: () => banner.destroy(),
    });

    // Spawn cadence scales with level.
    const baseDelay = Math.max(280, 900 - level * 70);
    this.time.addEvent({
      delay: baseDelay,
      loop: true,
      callback: () => this.spawnMelon(),
    });
  }

  private spawnMelon(): void {
    if (this.spawnedThisLevel >= WATERMELONS_TO_CLEAR * 2) return;
    const { width } = this.scale;
    const x = this.rng.range(40, width - 40);
    const y = -30;

    // Aim initial velocity roughly at the ship with some spread, so they
    // actually fly toward the player instead of straight down. Homing in
    // Watermelon.preUpdate adds gentle in-flight tracking.
    const dx = this.ship.x - x;
    const dy = Math.max(80, this.ship.y - y);
    const speed = this.rng.range(120 + this.level * 10, 170 + this.level * 14);
    const spreadDeg = this.rng.range(-22, 22);
    const baseAngle = Math.atan2(dy, dx);
    const angle = baseAngle + (spreadDeg * Math.PI) / 180;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const spin = this.rng.range(-2.5, 2.5);

    const m = new Watermelon(this, x, y, {
      vx,
      vy,
      spin,
      target: this.ship,
      steerAccel: 35 + this.level * 6,
      maxSpeed: 220 + this.level * 12,
    });
    this.melons.add(m);
    this.spawnedThisLevel++;
    getEventBus().emit({ type: "spawn", t: this.time.now, kind: "watermelon", id: m.meloId, x, y });
  }

  update(time: number, delta: number): void {
    const left = this.cursors.left?.isDown || this.keyA.isDown || this.input$.left;
    const right = this.cursors.right?.isDown || this.keyD.isDown || this.input$.right;
    const up = this.cursors.up?.isDown || this.keyW.isDown;
    const down = this.cursors.down?.isDown || this.keyS.isDown;
    const firing = this.fireKey.isDown || this.input$.fire;

    const body = this.ship.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);
    if (left) body.setVelocityX(-this.ship.speed);
    else if (right) body.setVelocityX(this.ship.speed);
    if (up) body.setVelocityY(-this.ship.speed * 0.75);
    else if (down) body.setVelocityY(this.ship.speed * 0.75);

    this.ship.setThrust(firing || left || right || up || down);

    if (firing && this.ship.tryFire(time)) this.fireBullet();

    // Parallax: scroll stars + nebula container slightly.
    for (const s of this.stars) {
      const sp = (s.getData("speed") as number) ?? 20;
      s.y += sp * delta * 0.001;
      if (s.y > this.scale.height + 4) {
        s.y = -4;
        s.x = this.rng.range(0, this.scale.width);
      }
    }
    this.bgContainer.y += 4 * delta * 0.001;
    if (this.bgContainer.y > 12) this.bgContainer.y = 0;

    // Cull bullets / melons that left the play area.
    this.bullets.children.iterate((obj) => {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) return true;
      if (b.y < -16) {
        b.disableBody(true, true);
      }
      return true;
    });
    this.melons.children.iterate((obj) => {
      const m = obj as Watermelon;
      if (!m.active) return true;
      if (m.y > this.scale.height + 40) m.destroy();
      return true;
    });

    this.hud.update(this, {
      level: this.level,
      world: this.world.id,
      score: this.score,
      lives: this.lives,
      entities: this.melons.getLength() + this.bullets.countActive(true),
    });

  }

  private fireBullet(): void {
    const b = this.bullets.get(this.ship.x, this.ship.y - 24, TEX.bullet) as Phaser.Physics.Arcade.Sprite | null;
    if (!b) return;
    b.setActive(true).setVisible(true);
    b.setScale(2);
    if (!b.body) this.physics.add.existing(b);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(false);
    body.setSize(6, 14).setOffset(0, 0);
    body.setVelocity(0, -560);
  }

  private onBulletHitMelon(bullet: Phaser.Physics.Arcade.Sprite, melon: Watermelon): void {
    bullet.disableBody(true, true);
    const award = 100;
    const bus = getEventBus();
    bus.emit({ type: "hit", t: this.time.now, targetId: melon.meloId, kind: "watermelon" });
    this.score += award;
    this.killedThisLevel++;
    this.killedTotal++;
    bus.emit({ type: "score", t: this.time.now, score: this.score });
    bus.updateSnapshot({ score: this.score });
    this.gameHud.setScore(this.score);
    this.gameHud.popScore(melon.x, melon.y, award);
    this.spawnExplosion(melon.x, melon.y);
    melon.destroy();
    if (this.killedThisLevel >= WATERMELONS_TO_CLEAR) this.advanceLevel();
  }

  private onShipHitMelon(melon: Watermelon): void {
    if (this.cfg.invincible || this.gameOverActive) return;
    this.spawnExplosion(melon.x, melon.y);
    melon.destroy();
    this.lives -= 1;
    const bus = getEventBus();
    bus.emit({ type: "lives", t: this.time.now, lives: this.lives });
    bus.updateSnapshot({ lives: this.lives });
    this.gameHud.setLives(this.lives);
    this.cameras.main.shake(180, 0.01);
    if (this.lives <= 0) this.gameOver();
  }

  private spawnExplosion(x: number, y: number): void {
    const ring = this.add.image(x, y, TEX.shockwave).setScale(0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ring,
      scale: 3,
      alpha: { from: 1, to: 0 },
      duration: 380,
      onComplete: () => ring.destroy(),
    });

    // Watermelon slice shrapnel: 5 wedges fly outward, rotating and fading.
    // Each slice already orients with its rind facing "down" in the texture,
    // so we rotate so the rind points outward from the blast center.
    const SLICES = 5;
    for (let i = 0; i < SLICES; i++) {
      const baseAngle = (i / SLICES) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      const speed = this.rng.range(110, 220);
      const slice = this.add
        .image(x, y, TEX.watermelonChunk)
        .setScale(2)
        // Rind in the texture points down (+y). Rotate so rind points along
        // the travel direction: rotation = baseAngle - PI/2.
        .setRotation(baseAngle - Math.PI / 2)
        .setDepth(500);
      const targetX = x + Math.cos(baseAngle) * speed;
      const targetY = y + Math.sin(baseAngle) * speed;
      const spin = this.rng.range(-6, 6);
      this.tweens.add({
        targets: slice,
        x: targetX,
        y: targetY,
        rotation: slice.rotation + spin,
        alpha: { from: 1, to: 0 },
        scale: { from: 2, to: 1.4 },
        ease: "Cubic.easeOut",
        duration: 650,
        onComplete: () => slice.destroy(),
      });
    }

    // A few seed specks for extra texture.
    for (let i = 0; i < 4; i++) {
      const seed = this.add.image(x, y, TEX.seed).setScale(2).setDepth(501);
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(40, 110);
      this.tweens.add({
        targets: seed,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        duration: 500,
        onComplete: () => seed.destroy(),
      });
    }
  }

  private advanceLevel(): void {
    const bus = getEventBus();
    bus.emit({ type: "level-clear", t: this.time.now, level: this.level });
    // Clear remaining melons.
    this.melons.clear(true, true);
    this.time.removeAllEvents();
    this.time.delayedCall(800, () => this.startLevel(this.level + 1));
  }

  private gameOver(): void {
    if (this.gameOverActive) return;
    this.gameOverActive = true;

    const prevBest = loadBestScore();
    const newBest = saveBestScore(this.score);
    const bestScore = Math.max(prevBest, this.score);

    const bus = getEventBus();
    bus.emit({
      type: "game-over",
      t: this.time.now,
      score: this.score,
      level: this.level,
      killedTotal: this.killedTotal,
      newBest,
      bestScore,
    });
    bus.updateSnapshot({ scene: "gameover", bestScore });

    this.physics.pause();
    this.time.removeAllEvents();
    this.gameHud.setVisible(false);

    const panel = this.buildGameOverPanel({ newBest, bestScore });
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 250 });

    this.input.keyboard?.once("keydown-SPACE", () => this.restart());
    this.input.keyboard?.once("keydown-ESC", () => this.scene.start("menu"));
  }

  private buildGameOverPanel(opts: { newBest: boolean; bestScore: number }): Phaser.GameObjects.Container {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const container = this.add.container(cx, cy).setDepth(5000).setScrollFactor(0);

    const W = 280;
    const H = 240;
    const bg = this.add
      .rectangle(0, 0, W, H, 0x05030a, 0.85)
      .setStrokeStyle(2, 0x9b3aff, 1);
    container.add(bg);

    const fmt = (n: number) => n.toString().padStart(6, "0");
    const label = (s: string) => s.padEnd(12, " ");
    const lines: Array<{ text: string; y: number; size: number; color: string; stroke?: string }> = [
      { text: "GAME OVER", y: -98, size: 28, color: "#ff7bd1", stroke: "#150033" },
      { text: "─────────────────", y: -64, size: 12, color: "#9b3aff" },
      { text: `${label("SCORE")}${fmt(this.score)}`, y: -38, size: 14, color: "#fff0a8" },
      { text: `${label("LEVEL")}${this.level.toString().padStart(6, " ")}`, y: -18, size: 14, color: "#b8eaff" },
      { text: `${label("MELONS")}${this.killedTotal.toString().padStart(6, " ")}`, y: 2, size: 14, color: "#77d76d" },
      { text: "─────────────────", y: 24, size: 12, color: "#9b3aff" },
    ];
    for (const l of lines) {
      const t = this.add
        .text(0, l.y, l.text, {
          fontFamily: "Courier New, monospace",
          fontSize: `${l.size}px`,
          color: l.color,
          ...(l.stroke ? { stroke: l.stroke, strokeThickness: 3 } : {}),
        })
        .setOrigin(0.5);
      container.add(t);
    }

    if (opts.newBest) {
      const badge = this.add
        .text(0, 50, "★  NEW BEST  ★", {
          fontFamily: "Courier New, monospace",
          fontSize: "16px",
          color: "#fff0a8",
          stroke: "#ff9d3a",
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      container.add(badge);
      this.tweens.add({
        targets: badge,
        scale: { from: 1, to: 1.1 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      const best = this.add
        .text(0, 50, `${label("BEST")}${fmt(opts.bestScore)}`, {
          fontFamily: "Courier New, monospace",
          fontSize: "14px",
          color: "#b8eaff",
        })
        .setOrigin(0.5);
      container.add(best);
    }

    const hint = this.add
      .text(0, 96, "SPACE  RESTART      ESC  MENU", {
        fontFamily: "Courier New, monospace",
        fontSize: "11px",
        color: "#6ac3ff",
      })
      .setOrigin(0.5);
    container.add(hint);
    this.tweens.add({
      targets: hint,
      alpha: { from: 1, to: 0.35 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    return container;
  }

  private restart(): void {
    const bus = getEventBus();
    bus.emit({ type: "restart", t: this.time.now });
    // Always restart from level 1, regardless of URL startLevel.
    this.scene.restart({ startLevel: 1 });
  }

  private togglePause(): void {
    const bus = getEventBus();
    if (this.scene.isPaused()) {
      this.scene.resume();
      bus.updateSnapshot({ paused: false });
    } else {
      this.scene.pause();
      bus.updateSnapshot({ paused: true });
    }
  }
}
