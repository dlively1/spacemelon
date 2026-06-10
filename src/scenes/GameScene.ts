import Phaser from "phaser";
import { Ship } from "../entities/Ship";
import { Watermelon } from "../entities/Watermelon";
import { Pickup, type AbilityType } from "../entities/Pickup";
import { TEX } from "../art/sprites";
import { Rng } from "../agent/rng";
import { readAgentConfig, type AgentConfig } from "../agent/config";
import { getEventBus } from "../agent/events";
import { DebugHud } from "../agent/hud";
import { GameHud } from "../ui/GameHud";
import { loadBestScore, saveBestScore } from "../agent/highscore";
import { buildBackground, worldForLevel, type StarLayer, type WorldDef } from "../worlds/worlds";
import { FxFactory } from "../fx/FxFactory";
import { tuningForLevel, type LevelTuning } from "../levels/levels";
import { sfx } from "../audio/sfx";

const STARTING_LIVES = 3;
const MEGA_SHATTER_COUNT = 6;
const SCORE_SMALL_KILL = 100;
const SCORE_MEGA_HIT = 50;
const SCORE_MEGA_DESTROY = 500;
// Penalties for letting melons drift past the ship — encourages aggressive play.
// Score floors at 0 so a bad run can't go negative.
const SCORE_SMALL_ESCAPE = -50;
const SCORE_MEGA_ESCAPE = -200;
// Ignore restart input for this long after game over so a mashed fire key
// (SPACE) doesn't immediately kick off a fresh run.
const RESTART_LOCK_MS = 1000;
// How long a collected special ability stays active.
const ABILITY_DURATION_MS = 8000;
// Radius (px) of an area-blast detonation.
const AREA_BLAST_RADIUS = 110;

export class GameScene extends Phaser.Scene {
  private ship!: Ship;
  private bullets!: Phaser.Physics.Arcade.Group;
  private melons!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private muteKey!: Phaser.Input.Keyboard.Key;

  private rng!: Rng;
  private cfg!: AgentConfig;
  private hud!: DebugHud;
  private gameHud!: GameHud;
  private level = 1;
  private world!: WorldDef;
  private tuning!: LevelTuning;
  private score = 0;
  private lives = STARTING_LIVES;
  private spawnedThisLevel = 0;
  private killedThisLevel = 0;
  private killedTotal = 0;
  // Megamelon cues consumed by index as kill count advances.
  private megaCueIdx = 0;
  private gameOverActive = false;
  private gameOverHint?: Phaser.GameObjects.Text;
  private levelTransitioning = false;
  // Active special ability from a collected power-up cylinder.
  private activeAbility: AbilityType | null = null;
  private abilityExpiresAt = 0;
  private starLayers: StarLayer[] = [];
  private bgContainer!: Phaser.GameObjects.Container;
  private fx!: FxFactory;
  private input$ = { left: false, right: false, up: false, down: false, fire: false };
  // Reused per-frame cull buffers — update() must not allocate.
  private escapedBuf: Watermelon[] = [];
  private culledBuf: Watermelon[] = [];
  private deadPickupsBuf: Pickup[] = [];

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
    this.activeAbility = null;
    this.abilityExpiresAt = 0;

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
    this.starLayers = bg.starLayers;

    this.fx = new FxFactory(this, this.rng);

    const { width, height } = this.scale;
    this.ship = new Ship(this, width / 2, height - 80);

    this.bullets = this.physics.add.group({
      maxSize: 32,
      classType: Phaser.Physics.Arcade.Sprite,
      runChildUpdate: false,
    });
    this.melons = this.physics.add.group({ classType: Watermelon, runChildUpdate: true });
    this.pickups = this.physics.add.group({ classType: Pickup, runChildUpdate: true });

    this.physics.add.overlap(this.bullets, this.melons, (b, m) => {
      const melon = m as Watermelon;
      // Skip kills that would happen while the melon is still off-screen —
      // otherwise players "shoot into the void" to score on melons they
      // never saw, which feels broken.
      if (!melon.isVulnerable()) return;
      this.onBulletHitMelon(b as Phaser.Physics.Arcade.Sprite, melon);
    });
    this.physics.add.overlap(this.ship, this.melons, (_s, m) => {
      const melon = m as Watermelon;
      if (!melon.isVulnerable()) return;
      this.onShipHitMelon(melon);
    });
    this.physics.add.overlap(this.ship, this.pickups, (_s, p) => {
      this.onShipGrabPickup(p as Pickup);
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyA = this.input.keyboard!.addKey("A");
    this.keyD = this.input.keyboard!.addKey("D");
    this.keyW = this.input.keyboard!.addKey("W");
    this.keyS = this.input.keyboard!.addKey("S");
    this.fireKey = this.input.keyboard!.addKey("SPACE");
    this.pauseKey = this.input.keyboard!.addKey("P");
    this.pauseKey.on("down", () => this.togglePause());
    this.muteKey = this.input.keyboard!.addKey("M");
    this.muteKey.on("down", () => sfx.setMuted(!sfx.isMuted()));

    // First user gesture in the gameplay scene — kick the AudioContext awake.
    sfx.setMuted(this.cfg.muted);
    this.input.keyboard!.once("keydown", () => sfx.resume());
    this.input.once("pointerdown", () => sfx.resume());

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
    this.tuning = tuningForLevel(level);
    this.spawnedThisLevel = 0;
    this.killedThisLevel = 0;
    this.megaCueIdx = 0;
    this.levelTransitioning = false;

    // Rebuild background for the new world.
    this.bgContainer.destroy(true);
    const bg = buildBackground(this, this.world, this.rng);
    this.bgContainer = bg.container;
    this.starLayers = bg.starLayers;

    const bus = getEventBus();
    bus.emit({ type: "level-start", t: this.time.now, level, world: this.world.id });
    bus.updateSnapshot({ level, world: this.world.id });
    sfx.play("levelStart");

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

    this.time.addEvent({
      delay: this.tuning.spawnDelayMs,
      loop: true,
      callback: () => this.spawnMelon(),
    });
  }

  private spawnMelon(): void {
    if (this.spawnedThisLevel >= this.tuning.totalSpawnsCap) return;
    const { width, height } = this.scale;

    // Pick a spawn edge: top by default; at higher levels, occasionally
    // from a side edge for flanking pressure. Spawn just outside the play
    // area so melons drift into view quickly — the vulnerability gate in
    // Watermelon makes sure they can't be killed until they're on-screen.
    const side =
      this.rng.next() < this.tuning.sideSpawnChance
        ? this.rng.pick(["left", "right"] as const)
        : "top";
    let x: number;
    let y: number;
    if (side === "top") {
      x = this.rng.range(40, width - 40);
      y = -12;
    } else if (side === "left") {
      x = -16;
      y = this.rng.range(60, height * 0.6);
    } else {
      x = width + 16;
      y = this.rng.range(60, height * 0.6);
    }

    this.makeMelon(x, y, { mega: false });
    this.spawnedThisLevel++;
  }

  /** Spawn a megamelon at the top center if the schedule says it's time. */
  private maybeSpawnScheduledMega(): void {
    const cues = this.tuning.megaSchedule;
    while (this.megaCueIdx < cues.length && this.killedThisLevel >= cues[this.megaCueIdx].atKill) {
      const { width } = this.scale;
      const x = this.rng.range(width * 0.3, width * 0.7);
      // Just above the screen — at scale 4 the sprite is ~112px so it peeks
      // in immediately; vulnerability gate still keeps it un-killable until
      // it's actually visible.
      const y = -30;
      this.makeMelon(x, y, { mega: true });
      this.megaCueIdx++;
    }
  }

  /** Pull a watermelon (small or mega) from the pool, aimed at the ship. */
  private makeMelon(
    x: number,
    y: number,
    opts: { mega: boolean; speedScale?: number },
  ): Watermelon | null {
    const t = this.tuning;
    const dx = this.ship.x - x;
    const dy = this.ship.y - y;
    // Use raw dy magnitude (no clamp) so side spawns aim sideways at the
    // ship instead of being forced downward.
    const baseAngle = Math.atan2(dy, dx);
    const spreadDeg = this.rng.range(-t.meloSpreadDeg, t.meloSpreadDeg);
    const angle = baseAngle + (spreadDeg * Math.PI) / 180;
    const speedScale = opts.speedScale ?? (opts.mega ? 0.7 : 1);
    const speed = this.rng.range(t.meloSpeedMin, t.meloSpeedMax) * speedScale;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const spin = this.rng.range(-2.5, 2.5);

    const m = this.melons.get() as Watermelon | null;
    if (!m) return null;
    m.spawn(x, y, {
      vx,
      vy,
      spin,
      target: this.ship,
      steerAccel: t.meloSteerAccel * (opts.mega ? 0.6 : 1),
      maxSpeed: t.meloMaxSpeed * (opts.mega ? 0.7 : 1),
      pathPattern: t.meloPath,
      wavePhase: this.rng.range(0, Math.PI * 2),
      mega: opts.mega,
      hp: opts.mega ? t.megaHp : 1,
    });
    getEventBus().emit({
      type: "spawn",
      t: this.time.now,
      kind: "watermelon",
      id: m.meloId,
      x,
      y,
      mega: opts.mega,
    });
    return m;
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

    // Parallax: scroll the star layers + bob the nebula container slightly.
    for (const layer of this.starLayers) {
      layer.sprite.tilePositionY -= layer.speed * delta * 0.001;
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
    // Collect off-screen melons first, then act on them AFTER iterating —
    // escape handling can shatter/spawn melons, which mutates the group.
    const escaped = this.escapedBuf;
    const culled = this.culledBuf;
    escaped.length = 0;
    culled.length = 0;
    this.melons.children.iterate((obj) => {
      const m = obj as Watermelon | undefined;
      if (!m || !m.active) return true;
      // Off the bottom: drifted past the ship. Off the sides: only kill if
      // they've already been on-screen (vulnerable) so freshly-spawned side
      // melons get their drift-in window.
      const offBottom = m.y > this.scale.height + 40;
      const offSide = m.isVulnerable() && (m.x < -60 || m.x > this.scale.width + 60);
      if (offBottom) {
        if (m.isVulnerable()) escaped.push(m);
        culled.push(m);
      } else if (offSide) {
        culled.push(m);
      }
      return true;
    });
    for (const m of escaped) this.onMelonEscaped(m);
    for (const m of culled) m.despawn();

    // Expire the active ability and drain its HUD timer.
    if (this.activeAbility) {
      if (time >= this.abilityExpiresAt) {
        const expired = this.activeAbility;
        this.activeAbility = null;
        const bus = getEventBus();
        bus.emit({ type: "powerup-expire", t: this.time.now, ability: expired });
        bus.updateSnapshot({ ability: null });
        this.gameHud.clearAbility();
      } else {
        const remaining = (this.abilityExpiresAt - time) / ABILITY_DURATION_MS;
        this.gameHud.updateAbilityTimer(remaining);
      }
    }

    // Cull cylinders that drifted off-screen — a missed power-up just vanishes.
    const deadPickups = this.deadPickupsBuf;
    deadPickups.length = 0;
    this.pickups.children.iterate((obj) => {
      const p = obj as Pickup | undefined;
      if (!p || !p.active) return true;
      if (p.y > this.scale.height + 30 || p.x < -40 || p.x > this.scale.width + 40) {
        deadPickups.push(p);
      }
      return true;
    });
    for (const p of deadPickups) p.despawn();

    // Unstick: spawn cap exhausted and no melons remain — the level can never
    // be cleared through kills, so advance anyway.
    if (
      !this.gameOverActive &&
      !this.levelTransitioning &&
      this.spawnedThisLevel >= this.tuning.totalSpawnsCap &&
      this.melons.countActive(true) === 0
    ) {
      this.advanceLevel();
    }

    this.hud.update(this, {
      level: this.level,
      world: this.world.id,
      score: this.score,
      lives: this.lives,
      entities:
        this.melons.countActive(true) +
        this.bullets.countActive(true) +
        this.pickups.countActive(true),
    });
  }

  private fireBullet(): void {
    switch (this.activeAbility) {
      case "multiLaser":
        // 3-way spread: straight up plus two angled lanes.
        this.spawnBullet(0, -560);
        this.spawnBullet(-150, -540);
        this.spawnBullet(150, -540);
        break;
      case "areaBlast":
        // A single explosive round that detonates on impact.
        this.spawnBullet(0, -560, true);
        break;
      default:
        this.spawnBullet(0, -560);
        break;
    }
    sfx.play("fire");
  }

  /** Pull a bullet from the pool, launch it, and tag it explosive if needed. */
  private spawnBullet(vx: number, vy: number, explosive = false): void {
    const b = this.bullets.get(
      this.ship.x,
      this.ship.y - 24,
      TEX.bullet,
    ) as Phaser.Physics.Arcade.Sprite | null;
    if (!b) return;
    b.setActive(true).setVisible(true);
    b.setScale(2);
    // Tint explosive rounds yellow so the area-blast ability reads on-screen.
    if (explosive) b.setTint(0xffe14d);
    else b.clearTint();
    b.setData("explosive", explosive);
    if (!b.body) this.physics.add.existing(b);
    const body = b.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(false);
    body.setSize(6, 14).setOffset(0, 0);
    body.setVelocity(vx, vy);
  }

  private onBulletHitMelon(bullet: Phaser.Physics.Arcade.Sprite, melon: Watermelon): void {
    const explosive = bullet.getData("explosive") === true;
    bullet.disableBody(true, true);

    // Area-blast rounds detonate where they land and damage everything nearby.
    if (explosive) {
      this.areaBlastAt(melon.x, melon.y);
      return;
    }

    const bus = getEventBus();
    const wasMega = melon.mega;
    const destroyed = melon.takeHit();

    bus.emit({
      type: "hit",
      t: this.time.now,
      targetId: melon.meloId,
      kind: "watermelon",
      destroyed,
      mega: wasMega,
    });

    if (!destroyed) {
      // Non-killing hit (only possible for megas right now).
      this.score += SCORE_MEGA_HIT;
      this.gameHud.popScore(melon.x, melon.y, SCORE_MEGA_HIT);
      bus.emit({ type: "score", t: this.time.now, score: this.score });
      bus.updateSnapshot({ score: this.score });
      this.gameHud.setScore(this.score);
      sfx.play("megaHit");
      return;
    }

    this.killMelon(melon);
  }

  /** Resolve a melon that was destroyed this frame: score, FX, shatter, drops. */
  private killMelon(melon: Watermelon): void {
    const bus = getEventBus();
    const wasMega = melon.mega;
    const x = melon.x;
    const y = melon.y;

    let award: number;
    if (wasMega) {
      award = SCORE_MEGA_DESTROY;
      this.cameras.main.shake(140, 0.008);
      sfx.play("megaDestroy");
    } else {
      award = SCORE_SMALL_KILL;
      this.killedThisLevel++;
      this.killedTotal++;
      sfx.play("hit");
    }
    this.score += award;
    bus.emit({ type: "score", t: this.time.now, score: this.score });
    bus.updateSnapshot({ score: this.score });
    this.gameHud.setScore(this.score);
    this.gameHud.popScore(x, y, award);
    this.fx.explode(x, y, wasMega ? 2 : 1);
    if (wasMega) this.shatterIntoSmallMelons(x, y);
    melon.despawn();

    // Chance to drop a power-up cylinder (0 before level 3).
    if (this.rng.next() < this.tuning.powerupDropChance) this.spawnPickup(x, y);

    this.maybeSpawnScheduledMega();
    if (this.killedThisLevel >= this.tuning.toClear) this.advanceLevel();
  }

  /** Detonate an area blast: destroy/damage every vulnerable melon in radius. */
  private areaBlastAt(x: number, y: number): void {
    this.fx.explode(x, y, 3);
    this.cameras.main.shake(200, 0.012);
    sfx.play("bomb");

    const bus = getEventBus();
    // Collect first, act after — destroying melons mid-iterate shifts the group.
    const killed: Watermelon[] = [];
    this.melons.children.iterate((obj) => {
      const m = obj as Watermelon | undefined;
      if (!m || !m.active || !m.isVulnerable()) return true;
      if (Phaser.Math.Distance.Between(x, y, m.x, m.y) > AREA_BLAST_RADIUS) return true;
      const destroyed = m.takeHit();
      bus.emit({
        type: "hit",
        t: this.time.now,
        targetId: m.meloId,
        kind: "watermelon",
        destroyed,
        mega: m.mega,
      });
      if (destroyed) killed.push(m);
      return true;
    });
    for (const m of killed) this.killMelon(m);
  }

  /** Pull a power-up cylinder from the pool; it drifts straight down from (x, y). */
  private spawnPickup(x: number, y: number): void {
    const ability: AbilityType = this.rng.next() < 0.5 ? "multiLaser" : "areaBlast";
    const p = this.pickups.get() as Pickup | null;
    if (!p) return;
    p.spawn(x, y, { ability, vy: this.tuning.powerupFallSpeed });
    getEventBus().emit({
      type: "powerup-spawn",
      t: this.time.now,
      id: p.pickupId,
      x,
      y,
      ability,
    });
  }

  /** Ship caught a cylinder — grant its ability for a fixed duration. */
  private onShipGrabPickup(pickup: Pickup): void {
    const ability = pickup.ability;
    const id = pickup.pickupId;
    pickup.despawn();

    this.activeAbility = ability;
    this.abilityExpiresAt = this.time.now + ABILITY_DURATION_MS;
    sfx.play("powerup");
    this.gameHud.setAbility(ability);

    const bus = getEventBus();
    bus.emit({ type: "powerup-collect", t: this.time.now, id, ability });
    bus.updateSnapshot({ ability });
  }

  /** A killed megamelon bursts into a ring of small melons. */
  private shatterIntoSmallMelons(x: number, y: number): void {
    for (let i = 0; i < MEGA_SHATTER_COUNT; i++) {
      const angle = (i / MEGA_SHATTER_COUNT) * Math.PI * 2 + this.rng.range(-0.15, 0.15);
      const speed = this.rng.range(140, 200);
      const m = this.melons.get() as Watermelon | null;
      if (!m) continue;
      m.spawn(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: this.rng.range(-3, 3),
        target: this.ship,
        steerAccel: this.tuning.meloSteerAccel * 0.5,
        maxSpeed: this.tuning.meloMaxSpeed,
        pathPattern: "straight",
      });
      getEventBus().emit({
        type: "spawn",
        t: this.time.now,
        kind: "watermelon",
        id: m.meloId,
        x,
        y,
        mega: false,
      });
    }
  }

  /** A melon drifted off the bottom of the screen — penalize the player. */
  private onMelonEscaped(melon: Watermelon): void {
    if (this.gameOverActive) return;
    const penalty = melon.mega ? SCORE_MEGA_ESCAPE : SCORE_SMALL_ESCAPE;
    const before = this.score;
    this.score = Math.max(0, this.score + penalty);
    const applied = this.score - before; // negative or zero (if floored)

    const bus = getEventBus();
    bus.emit({
      type: "escape",
      t: this.time.now,
      targetId: melon.meloId,
      mega: melon.mega,
      penalty: applied,
    });
    bus.emit({ type: "score", t: this.time.now, score: this.score });
    bus.updateSnapshot({ score: this.score });
    this.gameHud.setScore(this.score);
    // Show the penalty popup at the bottom edge where the melon escaped.
    if (applied < 0) {
      const x = Phaser.Math.Clamp(melon.x, 24, this.scale.width - 24);
      const y = this.scale.height - 28;
      this.gameHud.popScore(x, y, applied);
      sfx.play("escape");
    }
  }

  private onShipHitMelon(melon: Watermelon): void {
    if (this.cfg.invincible || this.gameOverActive) return;
    if (this.ship.isInvincible(this.time.now)) return;
    this.fx.explode(melon.x, melon.y);
    melon.despawn();
    this.lives -= 1;
    const bus = getEventBus();
    bus.emit({ type: "lives", t: this.time.now, lives: this.lives });
    bus.updateSnapshot({ lives: this.lives });
    this.gameHud.setLives(this.lives);
    this.cameras.main.shake(180, 0.01);
    sfx.play("shipHit");

    // Brief invincibility window so a single hit can't immediately cascade.
    const iFrameMs = 1500;
    this.ship.startInvincibility(this.time.now, iFrameMs);
    this.tweens.killTweensOf(this.ship);
    this.tweens.add({
      targets: this.ship,
      alpha: 0.15,
      duration: 110,
      yoyo: true,
      repeat: Math.round(iFrameMs / 220) - 1,
      ease: "Linear",
      onComplete: () => this.ship.setAlpha(1),
    });

    if (this.lives <= 0) this.gameOver();
  }

  private advanceLevel(): void {
    this.levelTransitioning = true;
    const bus = getEventBus();
    bus.emit({ type: "level-clear", t: this.time.now, level: this.level });
    sfx.play("levelClear");
    // Clear remaining melons + uncollected cylinders.
    // Despawn (don't destroy) so the pooled instances are reused next level.
    for (const m of this.melons.getMatching("active", true) as Watermelon[]) m.despawn();
    for (const p of this.pickups.getMatching("active", true) as Pickup[]) p.despawn();
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
    sfx.play("gameOver");

    this.physics.pause();
    this.time.removeAllEvents();
    this.gameHud.setVisible(false);

    const panel = this.buildGameOverPanel({ newBest, bestScore });
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 250 });

    // Lock out all input briefly so the spacebar a player is mashing to fire
    // doesn't instantly restart the run. After the delay, ENTER (or SPACE)
    // restarts and ESC returns to the menu. The hint reveals once unlocked.
    this.time.delayedCall(RESTART_LOCK_MS, () => {
      this.input.keyboard?.once("keydown-ENTER", () => this.restart());
      this.input.keyboard?.once("keydown-SPACE", () => this.restart());
      this.input.keyboard?.once("keydown-ESC", () => this.scene.start("menu"));
      this.gameOverHint?.setVisible(true);
    });
  }

  private buildGameOverPanel(opts: {
    newBest: boolean;
    bestScore: number;
  }): Phaser.GameObjects.Container {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const container = this.add.container(cx, cy).setDepth(5000).setScrollFactor(0);

    const W = 280;
    const H = 240;
    const bg = this.add.rectangle(0, 0, W, H, 0x05030a, 0.85).setStrokeStyle(2, 0x9b3aff, 1);
    container.add(bg);

    const fmt = (n: number) => n.toString().padStart(6, "0");
    const label = (s: string) => s.padEnd(12, " ");
    const lines: Array<{ text: string; y: number; size: number; color: string; stroke?: string }> =
      [
        { text: "GAME OVER", y: -98, size: 28, color: "#ff7bd1", stroke: "#150033" },
        { text: "─────────────────", y: -64, size: 12, color: "#9b3aff" },
        { text: `${label("SCORE")}${fmt(this.score)}`, y: -38, size: 14, color: "#fff0a8" },
        {
          text: `${label("LEVEL")}${this.level.toString().padStart(6, " ")}`,
          y: -18,
          size: 14,
          color: "#b8eaff",
        },
        {
          text: `${label("MELONS")}${this.killedTotal.toString().padStart(6, " ")}`,
          y: 2,
          size: 14,
          color: "#77d76d",
        },
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
      .text(0, 96, "ENTER  RESTART      ESC  MENU", {
        fontFamily: "Courier New, monospace",
        fontSize: "11px",
        color: "#6ac3ff",
      })
      .setOrigin(0.5)
      .setVisible(false);
    container.add(hint);
    this.gameOverHint = hint;
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
    sfx.play("restart");
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
