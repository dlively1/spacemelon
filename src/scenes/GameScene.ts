import Phaser from "phaser";
import { Ship } from "../entities/Ship";
import { Watermelon } from "../entities/Watermelon";
import { TEX } from "../art/sprites";
import { Rng } from "../agent/rng";
import { readAgentConfig, type AgentConfig } from "../agent/config";
import { getEventBus } from "../agent/events";
import { DebugHud } from "../agent/hud";
import { buildBackground, worldForLevel, type WorldDef } from "../worlds/worlds";

const WATERMELONS_TO_CLEAR = 12;

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
  private level = 1;
  private world!: WorldDef;
  private score = 0;
  private lives = 3;
  private spawnedThisLevel = 0;
  private killedThisLevel = 0;
  private stars: Phaser.GameObjects.Image[] = [];
  private bgContainer!: Phaser.GameObjects.Container;
  private input$ = { left: false, right: false, up: false, down: false, fire: false };

  constructor() {
    super("game");
  }

  create(): void {
    this.cfg = readAgentConfig();
    this.level = Math.max(1, this.cfg.startLevel);
    this.rng = new Rng(this.cfg.seed ^ (this.level * 0x9e3779b1));
    this.world = worldForLevel(this.level);
    this.score = 0;
    this.lives = 3;

    const bus = getEventBus();
    bus.emit({ type: "scene", t: this.time.now, name: "game" });
    bus.updateSnapshot({ scene: "game", paused: false });

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
    const vx = this.rng.range(-60, 60);
    const vy = this.rng.range(60 + this.level * 12, 110 + this.level * 16);
    const spin = this.rng.range(-2.5, 2.5);
    const m = new Watermelon(this, x, y, vx, vy, spin);
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
    const bus = getEventBus();
    bus.emit({ type: "hit", t: this.time.now, targetId: melon.meloId, kind: "watermelon" });
    this.score += 100;
    this.killedThisLevel++;
    bus.emit({ type: "score", t: this.time.now, score: this.score });
    bus.updateSnapshot({ score: this.score });
    this.spawnExplosion(melon.x, melon.y);
    melon.destroy();
    if (this.killedThisLevel >= WATERMELONS_TO_CLEAR) this.advanceLevel();
  }

  private onShipHitMelon(melon: Watermelon): void {
    if (this.cfg.invincible) return;
    this.spawnExplosion(melon.x, melon.y);
    melon.destroy();
    this.lives -= 1;
    const bus = getEventBus();
    bus.emit({ type: "lives", t: this.time.now, lives: this.lives });
    bus.updateSnapshot({ lives: this.lives });
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
    // Seed shrapnel.
    for (let i = 0; i < 6; i++) {
      const seed = this.add.image(x, y, TEX.seed).setScale(2);
      const angle = (i / 6) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      const speed = this.rng.range(60, 160);
      this.tweens.add({
        targets: seed,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        duration: 600,
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
    const bus = getEventBus();
    bus.emit({ type: "game-over", t: this.time.now, score: this.score, level: this.level });
    bus.updateSnapshot({ scene: "gameover" });
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, `GAME OVER\nscore ${this.score}`, {
        fontFamily: "Courier New, monospace",
        fontSize: "32px",
        align: "center",
        color: "#ff7bd1",
        stroke: "#150033",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(5000);
    this.physics.pause();
    this.input.keyboard?.once("keydown-SPACE", () => this.scene.start("menu"));
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
