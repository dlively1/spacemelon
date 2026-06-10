import { test, expect } from "@playwright/test";
import { bootGame, waitForEvent } from "./helpers/gameClient";

// Perf budget: under a worst-case load (?stress=1 — relentless spawns from
// all edges, megas on schedule, continuous fire so kills/explosions/popups
// churn too) the game must hold a playable frame rate. This is the guard
// rail that keeps rendering/allocation regressions from landing silently.
//
// The threshold is deliberately far below 60 because headless CI renders
// through software GL and lands around 40 fps under this load even when
// healthy — the budget exists to catch collapses (40 → 15), not wobbles.
// On real hardware the same scenario holds 60.
const MIN_AVG_FPS = 30;
// The scenario must actually stress: if the entity count never builds up,
// the fps assertion is meaningless and the test should fail loudly. Normal
// play hovers around 10–20 live entities; the stress scenario sustains 3×+.
const MIN_PEAK_ENTITIES = 40;

test("holds the frame-rate budget under stress load", async ({ page }) => {
  test.setTimeout(60_000);
  await bootGame(page, { seed: 1, autoplay: true, invincible: true, stress: true });
  await waitForEvent(page, "level-start");

  // Hold fire from screen center so explosions, popups, and pickups churn.
  await page.evaluate(() => window.__SPACEMELON?.input.fire(true));

  // Let the load build before sampling.
  await page.waitForTimeout(5_000);

  const samples: { fps: number; entities: number }[] = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    samples.push(
      await page.evaluate(() => ({
        fps: window.__SPACEMELON!.snapshot.fps,
        entities: window.__SPACEMELON!.snapshot.entities,
      })),
    );
  }

  const avgFps = samples.reduce((sum, s) => sum + s.fps, 0) / samples.length;
  const peakEntities = Math.max(...samples.map((s) => s.entities));

  expect(peakEntities).toBeGreaterThan(MIN_PEAK_ENTITIES);
  expect(avgFps).toBeGreaterThanOrEqual(MIN_AVG_FPS);
});
