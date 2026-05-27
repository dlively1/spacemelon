import { test, expect } from "@playwright/test";
import { bootGame, hold, snapshot, waitForEvent } from "./helpers/gameClient";

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
