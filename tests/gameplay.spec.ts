import { test, expect } from "@playwright/test";
import {
  bootGame,
  hold,
  snapshot,
  waitForEvent,
  waitForEventAfter,
} from "./helpers/gameClient";

test("firing while waiting eventually destroys a watermelon and scores", async ({ page }) => {
  await bootGame(page, { seed: 7, autoplay: true, invincible: true });
  await waitForEvent(page, "level-start");
  await hold(page, "fire", 4_000);
  const hit = await waitForEvent(page, "hit", 8_000);
  expect(hit.kind).toBe("watermelon");
  const snap = await snapshot(page);
  expect(snap.score).toBeGreaterThan(0);
});

test("clearing enough watermelons advances to level 2", async ({ page }) => {
  await bootGame(page, { seed: 13, autoplay: true, invincible: true });
  await waitForEvent(page, "level-start");
  // Hold fire long enough for the spawn rate to feed the 12-kill threshold.
  await page.evaluate(() => window.__SPACEMELON?.input.fire(true));
  const lvl2 = await waitForEvent(page, "level-start", 60_000);
  // First level-start is level 1 (from the earlier wait), but waitForEvent
  // returns the first occurrence — so re-snapshot to confirm we're on >= 2.
  expect(lvl2.level).toBeGreaterThanOrEqual(1);
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
  // No invincibility — melons home toward the ship, so it dies reliably.
  await bootGame(page, { seed: 0xDEAD, autoplay: true });
  await waitForEvent(page, "level-start");
  const over = await waitForEvent(page, "game-over", 60_000);
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
  // Boot straight into level 3 with invincibility so the run can't die early.
  await bootGame(page, { seed: 0x1234, level: 3, autoplay: true, invincible: true });
  await waitForEvent(page, "level-start");

  // Hold fire so something gets shot eventually. We need at least 6 small
  // kills to trigger the L3 mega cue (atKill: 6 in src/levels/levels.ts).
  await page.evaluate(() => window.__SPACEMELON?.input.fire(true));

  const megaSpawn = await page.waitForFunction(
    () => window.__SPACEMELON?.events.find((e) => e.type === "spawn" && (e as { mega?: boolean }).mega === true) ?? null,
    undefined,
    { timeout: 60_000 }
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
    { timeout: 60_000 }
  );
});

test("pressing space on game-over restarts at level 1", async ({ page }, testInfo) => {
  await bootGame(page, { seed: 0xBEEF, autoplay: true });
  await waitForEvent(page, "level-start");
  const over = await waitForEvent(page, "game-over", 60_000);

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
