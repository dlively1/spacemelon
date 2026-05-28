import { test, expect } from "@playwright/test";
import {
  bootGame,
  snapshot,
  sweepFire,
  waitForEvent,
  waitForEventAfter,
} from "./helpers/gameClient";

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
  await bootGame(page, { seed: 13, autoplay: true, invincible: true });
  const start1 = await waitForEvent(page, "level-start");
  // Sweep+fire indefinitely while waiting for the level-2 start event.
  sweepFire(page, 90_000).catch(() => {});
  const lvl2 = await waitForEventAfter(page, "level-start", start1.t, 90_000);
  expect(lvl2.level).toBeGreaterThanOrEqual(2);
  const snap = await snapshot(page);
  expect(snap.level).toBeGreaterThanOrEqual(2);
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
  // Start at L2 — L2's steerAccel=40 makes melons home toward the ship, so an
  // idle ship dies reliably. L1 is too gentle (no homing, narrow spread).
  await bootGame(page, { seed: 0xDEAD, level: 2, autoplay: true });
  await waitForEvent(page, "level-start");
  const over = await waitForEvent(page, "game-over", 45_000);
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
  await bootGame(page, { seed: 0x1234, level: 3, autoplay: true, invincible: true });
  await waitForEvent(page, "level-start");

  // Sweep+fire so we actually hit the 6-kill mega cue (atKill: 6 in
  // src/levels/levels.ts). A stationary ship at center barely lands hits
  // against L3's wave-path melons.
  sweepFire(page, 100_000).catch(() => {});

  const megaSpawn = await page.waitForFunction(
    () => window.__SPACEMELON?.events.find((e) => e.type === "spawn" && (e as { mega?: boolean }).mega === true) ?? null,
    undefined,
    { timeout: 90_000 }
  );
  const ev = await megaSpawn.jsonValue() as { id: number };
  expect(ev.id).toBeGreaterThan(0);

  // The same megamelon should register at least one non-killing hit before
  // it's destroyed — confirms HP > 1.
  await page.waitForFunction(
    (id) => {
      const hits = window.__SPACEMELON?.events.filter(
        (e) => e.type === "hit" && (e as { targetId?: number }).targetId === id
      ) ?? [];
      const survived = hits.some((h) => (h as { destroyed?: boolean }).destroyed === false);
      return survived;
    },
    ev.id,
    { timeout: 30_000 }
  );
});

test("pressing space on game-over restarts at level 1", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  // L2 — same reason as the ship-dies test: homing makes the death reliable.
  await bootGame(page, { seed: 0xBEEF, level: 2, autoplay: true });
  await waitForEvent(page, "level-start");
  const over = await waitForEvent(page, "game-over", 45_000);

  // Capture the game-over panel for visual review.
  await page.waitForTimeout(300);
  const shot = await page.screenshot();
  await testInfo.attach("game-over.png", { body: shot, contentType: "image/png" });

  // SPACE on game-over should fire a `restart` event and then a fresh
  // `level-start` for level 1.
  await page.keyboard.press("Space");
  const restart = await waitForEventAfter(page, "restart", over.t, 5_000);
  expect(restart.t).toBeGreaterThan(over.t);

  const fresh = await waitForEventAfter(page, "level-start", restart.t, 8_000);
  expect(fresh.level).toBe(1);

  const snap = await snapshot(page);
  expect(snap.scene).toBe("game");
  expect(snap.score).toBe(0);
  expect(snap.lives).toBe(3);
});
