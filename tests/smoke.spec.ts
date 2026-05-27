import { test, expect } from "@playwright/test";
import { bootGame, snapshot, waitForEvent, waitForScene } from "./helpers/gameClient";

test("boots and reaches menu", async ({ page }) => {
  await bootGame(page, { seed: 0xC0FFEE });
  const boot = await waitForEvent(page, "boot");
  expect(boot.t).toBeGreaterThanOrEqual(0);
  await waitForScene(page, "menu");
  const snap = await snapshot(page);
  expect(snap.ready).toBe(true);
  expect(snap.scene).toBe("menu");
});

test("autoplay transitions into game scene and starts a level", async ({ page }) => {
  await bootGame(page, { seed: 42, autoplay: true });
  await waitForScene(page, "game");
  const lvl = await waitForEvent(page, "level-start");
  expect(lvl.level).toBe(1);
  expect(typeof lvl.world).toBe("string");
});

test("captures a screenshot per world for the first three levels", async ({ page }, testInfo) => {
  for (let level = 1; level <= 3; level++) {
    await bootGame(page, { seed: 0xC0FFEE + level, level, autoplay: true, invincible: true });
    await waitForEvent(page, "level-start");
    // Let the world breathe a moment for parallax + spawns.
    await page.waitForTimeout(800);
    const buf = await page.screenshot({ fullPage: false });
    await testInfo.attach(`level-${level}.png`, { body: buf, contentType: "image/png" });
  }
});
