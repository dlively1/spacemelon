import type { Page } from "@playwright/test";
import type { GameSnapshot, GameEvent } from "../../src/agent/events";

export interface GameClientOptions {
  seed?: number;
  level?: number;
  autoplay?: boolean;
  invincible?: boolean;
  debug?: boolean;
  // Defaults to true — keeps headless chromium quiet and avoids AudioContext
  // gesture warnings. Set false for tests that want to assert audio behavior.
  muted?: boolean;
}

export async function bootGame(page: Page, opts: GameClientOptions = {}): Promise<void> {
  const params = new URLSearchParams();
  if (opts.seed != null) params.set("seed", String(opts.seed));
  if (opts.level != null) params.set("level", String(opts.level));
  if (opts.autoplay) params.set("autoplay", "1");
  if (opts.invincible) params.set("invincible", "1");
  if (opts.debug) params.set("debug", "1");
  if (opts.muted !== false) params.set("muted", "1");
  const qs = params.toString();
  await page.goto(`/${qs ? `?${qs}` : ""}`);
  await page.waitForFunction(() => !!window.__SPACEMELON?.snapshot.ready, undefined, {
    timeout: 15_000,
  });
}

export async function snapshot(page: Page): Promise<GameSnapshot> {
  return page.evaluate(() => {
    return { ...window.__SPACEMELON!.snapshot };
  });
}

export async function events(page: Page): Promise<GameEvent[]> {
  return page.evaluate(() => [...(window.__SPACEMELON?.events ?? [])]);
}

export async function waitForScene(page: Page, name: string, timeoutMs = 8_000): Promise<void> {
  await page.waitForFunction(
    (n) => window.__SPACEMELON?.snapshot.scene === n,
    name,
    { timeout: timeoutMs }
  );
}

export async function waitForEvent<T extends GameEvent["type"]>(
  page: Page,
  type: T,
  timeoutMs = 8_000
): Promise<Extract<GameEvent, { type: T }>> {
  const handle = await page.waitForFunction(
    (t) => {
      const ev = window.__SPACEMELON?.events.find((e) => e.type === t);
      return ev ?? null;
    },
    type,
    { timeout: timeoutMs }
  );
  return (await handle.jsonValue()) as Extract<GameEvent, { type: T }>;
}

// Wait for an event that occurred strictly after `sinceT` (ms since boot).
// Useful when looking for a fresh occurrence after a restart or scene change.
export async function waitForEventAfter<T extends GameEvent["type"]>(
  page: Page,
  type: T,
  sinceT: number,
  timeoutMs = 15_000
): Promise<Extract<GameEvent, { type: T }>> {
  const handle = await page.waitForFunction(
    ({ t, since }) => {
      const ev = window.__SPACEMELON?.events.find((e) => e.type === t && e.t > since);
      return ev ?? null;
    },
    { t: type, since: sinceT },
    { timeout: timeoutMs }
  );
  return (await handle.jsonValue()) as Extract<GameEvent, { type: T }>;
}

export async function hold(
  page: Page,
  control: "left" | "right" | "fire",
  durationMs: number
): Promise<void> {
  await page.evaluate((c) => window.__SPACEMELON?.input[c](true), control);
  await page.waitForTimeout(durationMs);
  await page.evaluate((c) => window.__SPACEMELON?.input[c](false), control);
}
