import { test, expect } from "@playwright/test";
import {
  bootGame,
  clearLevel,
  events,
  grantAbility,
  snapshot,
  sweepFire,
  waitForEvent,
  waitForEventAfter,
} from "./helpers/gameClient";

test("bridge cheats grant abilities and clear levels without grinding", async ({ page }) => {
  await bootGame(page, { seed: 5, autoplay: true, invincible: true });
  const start = await waitForEvent(page, "level-start");

  await grantAbility(page, "multiLaser");
  const withAbility = await snapshot(page);
  expect(withAbility.ability).toBe("multiLaser");

  await clearLevel(page);
  const lvl2 = await waitForEventAfter(page, "level-start", start.t, 8_000);
  expect(lvl2.level).toBe(2);
});

test("firing while sweeping eventually destroys a watermelon and scores", async ({ page }) => {
  test.setTimeout(30_000);
  await bootGame(page, { seed: 7, autoplay: true, invincible: true });
  const start = await waitForEvent(page, "level-start");
  // L1's narrow spread + slow speed mean a stationary ship's bullets miss
  // most melons. Sweep the ship side-to-side so bullets sample x more widely.
  sweepFire(page, 8_000).catch(() => {});
  const hit = await waitForEventAfter(page, "hit", start.t, 12_000);
  expect(hit.kind).toBe("watermelon");
  const snap = await snapshot(page);
  expect(snap.score).toBeGreaterThan(0);
});

test("clearing enough watermelons advances to level 2", async ({ page }) => {
  test.setTimeout(120_000);
  // 3× game speed — progression tests shouldn't wait wall-clock minutes.
  await bootGame(page, { seed: 13, autoplay: true, invincible: true, timeScale: 3 });
  const start1 = await waitForEvent(page, "level-start");
  // Sweep+fire indefinitely while waiting for the level-2 start event.
  sweepFire(page, 60_000).catch(() => {});
  const lvl2 = await waitForEventAfter(page, "level-start", start1.t, 60_000);
  expect(lvl2.level).toBeGreaterThanOrEqual(2);
  const snap = await snapshot(page);
  expect(snap.level).toBeGreaterThanOrEqual(2);
});

test("melons drifting off the bottom emit escape penalties without crashing", async ({ page }) => {
  test.setTimeout(60_000);
  // An idle, invincible ship lets melons sail past and off the bottom. The
  // off-bottom cull used to destroy melons mid-iteration over the physics
  // group, which handed Phaser's iterate() an undefined entry and threw —
  // crashing the game the first time a melon escaped. Assert escapes fire and
  // no page error surfaces.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e.stack || e)));

  await bootGame(page, { seed: 0xc0ffee, level: 1, autoplay: true, invincible: true });
  await waitForEvent(page, "level-start");
  const esc = await waitForEvent(page, "escape", 45_000);
  expect(esc.mega).toBe(false);
  // Let several more frames run so any post-escape crash would surface.
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test("snapshot exposes lives and score for the always-on HUD", async ({ page }) => {
  await bootGame(page, { seed: 99, autoplay: true, invincible: true });
  await waitForEvent(page, "level-start");
  const snap = await snapshot(page);
  // Starting state: 3 lives, 0 score, and a bestScore field on the bridge.
  expect(snap.lives).toBe(3);
  expect(snap.score).toBe(0);
  expect(typeof snap.bestScore).toBe("number");
});

test("ship dies after enough hits and the game-over event carries stats", async ({ page }) => {
  test.setTimeout(60_000);
  // Start at L2 and steer UP into the top spawn stream. An idle ship no longer
  // dies reliably: melons keep their aimed spawn velocity plus spread, so they
  // sail past a stationary target instead of homing into it. Flying into where
  // melons enter the screen makes draining the 3 lives deterministic.
  await bootGame(page, { seed: 0xdead, level: 2, autoplay: true });
  await waitForEvent(page, "level-start");
  await page.keyboard.down("ArrowUp");
  const over = await waitForEvent(page, "game-over", 45_000);
  await page.keyboard.up("ArrowUp");
  expect(over.score).toBeGreaterThanOrEqual(0);
  expect(over.level).toBeGreaterThanOrEqual(1);
  expect(over.killedTotal).toBeGreaterThanOrEqual(0);
  expect(typeof over.newBest).toBe("boolean");
  expect(typeof over.bestScore).toBe("number");
  const snap = await snapshot(page);
  expect(snap.lives).toBe(0);
  expect(snap.scene).toBe("gameover");
});

test("level 3 spawns a megamelon and it takes multiple hits to break", async ({ page }) => {
  test.setTimeout(120_000);
  // 3× game speed — progression tests shouldn't wait wall-clock minutes.
  await bootGame(page, { seed: 0x1234, level: 3, autoplay: true, invincible: true, timeScale: 3 });
  await waitForEvent(page, "level-start");

  // Sweep+fire so we actually hit the 6-kill mega cue (atKill: 6 in
  // src/levels/levels.ts). A stationary ship at center barely lands hits
  // against L3's wave-path melons.
  sweepFire(page, 60_000).catch(() => {});

  const megaSpawn = await page.waitForFunction(
    () =>
      window.__SPACEMELON?.events.find(
        (e) => e.type === "spawn" && (e as { mega?: boolean }).mega === true,
      ) ?? null,
    undefined,
    { timeout: 90_000 },
  );
  const ev = (await megaSpawn.jsonValue()) as { id: number };
  expect(ev.id).toBeGreaterThan(0);

  // The same megamelon should register at least one non-killing hit before
  // it's destroyed — confirms HP > 1.
  await page.waitForFunction(
    (id) => {
      const hits =
        window.__SPACEMELON?.events.filter(
          (e) => e.type === "hit" && (e as { targetId?: number }).targetId === id,
        ) ?? [];
      const survived = hits.some((h) => (h as { destroyed?: boolean }).destroyed === false);
      return survived;
    },
    ev.id,
    { timeout: 30_000 },
  );
});

test("no power-up cylinders drop before level 3", async ({ page }) => {
  test.setTimeout(30_000);
  // L1 tuning has powerupDropChance: 0 — special abilities are a mid-game
  // escalation, so no cylinders should ever drop here no matter how many
  // melons we destroy.
  await bootGame(page, { seed: 7, level: 1, autoplay: true, invincible: true });
  await waitForEvent(page, "level-start");
  await sweepFire(page, 9_000).catch(() => {});
  const evs = await events(page);
  const drops = evs.filter((e) => e.type === "powerup-spawn");
  expect(drops).toHaveLength(0);
  // Sanity: we did actually destroy melons during the sweep.
  expect(evs.some((e) => e.type === "hit")).toBe(true);
});

test("level 3 drops a cylinder that the ship can collect for an ability", async ({ page }) => {
  test.setTimeout(120_000);
  // 3× game speed — progression tests shouldn't wait wall-clock minutes.
  await bootGame(page, { seed: 0x5afe, level: 3, autoplay: true, invincible: true, timeScale: 3 });
  await waitForEvent(page, "level-start");

  // Pin the ship against the right wall (collideWorldBounds gives it a stable
  // x) and hold fire. Bullets travel straight up, so a melon killed above the
  // ship spawns its cylinder at ~the ship's x — and since cylinders fall
  // straight down, it drops right back onto the stationary ship. That makes a
  // self-catch deterministic without needing the ship's exact coordinates.
  await page.evaluate(() => {
    window.__SPACEMELON?.input.right(true);
    window.__SPACEMELON?.input.fire(true);
  });

  const spawn = await waitForEvent(page, "powerup-spawn", 90_000);
  expect(["multiLaser", "areaBlast"]).toContain(spawn.ability);

  const collect = await waitForEvent(page, "powerup-collect", 30_000);
  expect(["multiLaser", "areaBlast"]).toContain(collect.ability);

  await page.evaluate(() => {
    window.__SPACEMELON?.input.right(false);
    window.__SPACEMELON?.input.fire(false);
  });

  const snap = await snapshot(page);
  expect(snap.ability).toBe(collect.ability);
});

test("game-over locks out input briefly, then ENTER restarts at level 1", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  // L2 — steer UP into the spawn stream so the death is deterministic (see the
  // ship-dies test for why an idle ship no longer reliably dies).
  await bootGame(page, { seed: 0xbeef, level: 2, autoplay: true });
  await waitForEvent(page, "level-start");
  await page.keyboard.down("ArrowUp");
  const over = await waitForEvent(page, "game-over", 45_000);
  await page.keyboard.up("ArrowUp");

  // Mashing SPACE (the fire key) right after death must NOT restart — the
  // input lock guards against an accidental insta-restart. Assert this before
  // the (slow) screenshot below so the lock window is still open.
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  const restarted = (await events(page)).some((e) => e.type === "restart" && e.t > over.t);
  expect(restarted).toBe(false);

  // Capture the game-over panel for visual review.
  const shot = await page.screenshot();
  await testInfo.attach("game-over.png", { body: shot, contentType: "image/png" });

  // After the lock window, ENTER fires a `restart` and a fresh L1 `level-start`.
  await page.waitForTimeout(1200);
  await page.keyboard.press("Enter");
  const restart = await waitForEventAfter(page, "restart", over.t, 5_000);
  expect(restart.t).toBeGreaterThan(over.t);

  const fresh = await waitForEventAfter(page, "level-start", restart.t, 8_000);
  expect(fresh.level).toBe(1);

  const snap = await snapshot(page);
  expect(snap.scene).toBe("game");
  expect(snap.score).toBe(0);
  expect(snap.lives).toBe(3);
});
