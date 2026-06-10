// Event bridge exposed on `window.__SPACEMELON` so Playwright (or any browser-
// side agent) can observe gameplay state without scraping pixels.

import type { AbilityType } from "../entities/Pickup";

export type GameEvent =
  | { type: "boot"; t: number }
  | { type: "scene"; t: number; name: string }
  | { type: "level-start"; t: number; level: number; world: string }
  | { type: "level-clear"; t: number; level: number }
  | {
      type: "spawn";
      t: number;
      kind: "watermelon";
      id: number;
      x: number;
      y: number;
      mega: boolean;
    }
  | {
      type: "hit";
      t: number;
      targetId: number;
      kind: "watermelon";
      destroyed: boolean;
      mega: boolean;
    }
  | { type: "escape"; t: number; targetId: number; mega: boolean; penalty: number }
  | { type: "score"; t: number; score: number }
  | { type: "lives"; t: number; lives: number }
  | {
      type: "game-over";
      t: number;
      score: number;
      level: number;
      killedTotal: number;
      newBest: boolean;
      bestScore: number;
    }
  | { type: "restart"; t: number }
  | { type: "powerup-spawn"; t: number; id: number; x: number; y: number; ability: AbilityType }
  | { type: "powerup-collect"; t: number; id: number; ability: AbilityType }
  | { type: "powerup-expire"; t: number; ability: AbilityType }
  | { type: "frame"; t: number; fps: number; entities: number };

export interface GameSnapshot {
  ready: boolean;
  scene: string;
  level: number;
  world: string;
  score: number;
  lives: number;
  bestScore: number;
  fps: number;
  entities: number;
  seed: number;
  paused: boolean;
  // Currently-active special ability (from a power-up cylinder), or null.
  ability: AbilityType | null;
}

export interface GameBridge {
  version: 1;
  events: GameEvent[];
  snapshot: GameSnapshot;
  // Imperative hooks (used by tests + autoplay).
  input: {
    left: (down: boolean) => void;
    right: (down: boolean) => void;
    fire: (down: boolean) => void;
    pause: () => void;
  };
  // Wait helpers (resolve in the page context, awaitable from Playwright).
  waitFor: (predicate: (s: GameSnapshot) => boolean, timeoutMs?: number) => Promise<GameSnapshot>;
  waitForEvent: <T extends GameEvent["type"]>(
    type: T,
    timeoutMs?: number,
  ) => Promise<Extract<GameEvent, { type: T }>>;
}

declare global {
  interface Window {
    __SPACEMELON?: GameBridge;
  }
}

const MAX_EVENTS = 2000;
// Let the buffer overshoot by this much before trimming back to MAX_EVENTS.
const TRIM_SLACK = 256;

class EventBus {
  private bridge: GameBridge;
  private listeners = new Set<(e: GameEvent) => void>();
  private snapshotListeners = new Set<(s: GameSnapshot) => void>();

  constructor(seed: number) {
    this.bridge = {
      version: 1,
      events: [],
      snapshot: {
        ready: false,
        scene: "boot",
        level: 0,
        world: "",
        score: 0,
        lives: 0,
        bestScore: 0,
        fps: 0,
        entities: 0,
        seed,
        paused: false,
        ability: null,
      },
      input: {
        left: () => {},
        right: () => {},
        fire: () => {},
        pause: () => {},
      },
      waitFor: (predicate, timeoutMs = 10_000) =>
        new Promise((resolve, reject) => {
          if (predicate(this.bridge.snapshot)) {
            resolve({ ...this.bridge.snapshot });
            return;
          }
          const timer = setTimeout(() => {
            this.snapshotListeners.delete(handler);
            reject(new Error(`waitFor timeout after ${timeoutMs}ms`));
          }, timeoutMs);
          const handler = (s: GameSnapshot) => {
            if (predicate(s)) {
              clearTimeout(timer);
              this.snapshotListeners.delete(handler);
              resolve({ ...s });
            }
          };
          this.snapshotListeners.add(handler);
        }),
      waitForEvent: <T extends GameEvent["type"]>(type: T, timeoutMs = 10_000) =>
        new Promise<Extract<GameEvent, { type: T }>>((resolve, reject) => {
          const timer = setTimeout(() => {
            this.listeners.delete(handler);
            reject(new Error(`waitForEvent(${type}) timeout after ${timeoutMs}ms`));
          }, timeoutMs);
          const handler = (e: GameEvent) => {
            if (e.type === type) {
              clearTimeout(timer);
              this.listeners.delete(handler);
              resolve(e as Extract<GameEvent, { type: T }>);
            }
          };
          this.listeners.add(handler);
        }),
    };
    window.__SPACEMELON = this.bridge;
  }

  bindInput(input: GameBridge["input"]): void {
    this.bridge.input = input;
  }

  emit(event: GameEvent): void {
    // Always stamp `t` with a monotonic clock here, regardless of what the
    // caller passed. Phaser's `scene.time.now` resets across scene restarts,
    // which breaks `event.t > since` filters like waitForEventAfter; using
    // performance.now() keeps t monotonic for the whole page session.
    event.t = performance.now();
    const events = this.bridge.events;
    events.push(event);
    // Trim in amortized batches: a splice/slice per emit once the buffer is
    // full would shift the whole array on every event during heavy play.
    // Consumers read `bridge.events` fresh each access, so swapping the
    // array identity here is safe.
    if (events.length > MAX_EVENTS + TRIM_SLACK) {
      this.bridge.events = events.slice(events.length - MAX_EVENTS);
    }
    for (const fn of this.listeners) fn(event);
  }

  updateSnapshot(patch: Partial<GameSnapshot>): void {
    Object.assign(this.bridge.snapshot, patch);
    for (const fn of this.snapshotListeners) fn(this.bridge.snapshot);
  }

  get snapshot(): GameSnapshot {
    return this.bridge.snapshot;
  }
}

let busInstance: EventBus | null = null;

export function initEventBus(seed: number): EventBus {
  if (!busInstance) busInstance = new EventBus(seed);
  return busInstance;
}

export function getEventBus(): EventBus {
  if (!busInstance) throw new Error("EventBus not initialized");
  return busInstance;
}
