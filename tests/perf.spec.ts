import { test, expect } from "@playwright/test";
import { bootGame, waitForEvent } from "./helpers/gameClient";

// Perf budget: under a worst-case load (?stress=1 — relentless spawns from
// all edges, megas on schedule, continuous fire so kills/explosions/popups
// churn too) the game must hold a playable frame rate. This is the guard
// rail that keeps rendering/allocation regressions from landing silently.
//
// CI hardware varies wildly (software-GL headless rendering can swing from
// ~25 to ~60 fps between runs of the SAME build), so the budget is relative:
// a light-load baseline is measured in the same browser session, and the
// stress run must hold a fraction of it. An absolute floor still catches
// total collapses on machines whose baseline is already low.
const STRESS_TO_BASELINE_MIN_RATIO = 0.35;
const ABSOLUTE_MIN_MEDIAN_FPS = 12;
// The scenario must actually stress: if the entity count never builds up,
// the fps assertion is meaningless and the test should fail loudly. Normal
// play hovers around 10–20 live entities; the stress scenario sustains 3×+.
const MIN_PEAK_ENTITIES = 40;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function sampleSnapshots(
  page: import("@playwright/test").Page,
  count: number,
  intervalMs: number,
): Promise<{ fps: number; entities: number }[]> {
  const samples: { fps: number; entities: number }[] = [];
  for (let i = 0; i < count; i++) {
    await page.waitForTimeout(intervalMs);
    samples.push(
      await page.evaluate(() => ({
        fps: window.__SPACEMELON!.snapshot.fps,
        entities: window.__SPACEMELON!.snapshot.entities,
      })),
    );
  }
  return samples;
}

test("holds the frame-rate budget under stress load", async ({ page }, testInfo) => {
  test.setTimeout(90_000);

  // Baseline: light load (L1, idle invincible ship) on this hardware.
  await bootGame(page, { seed: 1, autoplay: true, invincible: true });
  await waitForEvent(page, "level-start");
  await page.waitForTimeout(2_000);
  const baselineSamples = await sampleSnapshots(page, 8, 500);
  const baselineFps = median(baselineSamples.map((s) => s.fps));

  // Stress: worst-case spawn load with continuous fire.
  await bootGame(page, { seed: 1, autoplay: true, invincible: true, stress: true });
  await waitForEvent(page, "level-start");
  await page.evaluate(() => window.__SPACEMELON?.input.fire(true));
  // Let the load build before sampling.
  await page.waitForTimeout(5_000);
  const stressSamples = await sampleSnapshots(page, 20, 500);
  const stressFps = median(stressSamples.map((s) => s.fps));
  const peakEntities = Math.max(...stressSamples.map((s) => s.entities));

  // Surface the raw numbers in the report so CI failures are diagnosable.
  const summary = {
    baselineFps,
    stressFps,
    peakEntities,
    requiredFps: Math.max(ABSOLUTE_MIN_MEDIAN_FPS, baselineFps * STRESS_TO_BASELINE_MIN_RATIO),
    baselineSamples,
    stressSamples,
  };
  await testInfo.attach("fps-summary.json", {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
  console.log(
    `perf budget: baseline=${baselineFps}fps stress=${stressFps}fps ` +
      `required>=${summary.requiredFps.toFixed(1)}fps peakEntities=${peakEntities}`,
  );

  expect(peakEntities).toBeGreaterThan(MIN_PEAK_ENTITIES);
  expect(stressFps).toBeGreaterThanOrEqual(summary.requiredFps);
});
