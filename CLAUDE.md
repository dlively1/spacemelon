# Spacemelon — Agent Handbook

Pixel-art Galaga-meets-Geometry-Wars where the player blasts watermelons drifting
through themed cosmic worlds. This document is the **first-class spec** for any
agent (Claude, scripted, or human) collaborating on the codebase. `AGENTS.md` is
a symlink to this file — keep both in sync by editing only `CLAUDE.md`.

## Stack

- **Phaser 3** game engine, **TypeScript** (strict), **Vite** build, **pnpm**.
- **Playwright** for end-to-end browser tests against a real built bundle.
- No runtime asset binaries — all sprites are **generated procedurally** in
  `src/art/` so the repo stays text-only and palettes are easy to iterate.

## Commands

| Script | What it does |
|---|---|
| `pnpm install` | Install deps. |
| `pnpm test:install` | One-time: install Playwright chromium + system deps. |
| `pnpm dev` | Vite dev server at http://localhost:5173. |
| `pnpm build` | Type-check + production build to `dist/`. |
| `pnpm preview` | Serve the production build on :4173 (used by Playwright). |
| `pnpm test` | Run Playwright tests (auto-boots `pnpm build && pnpm preview`). |
| `pnpm test:ui` | Interactive Playwright UI mode. |
| `pnpm typecheck` | `tsc --noEmit`. |

## Repository map

```
src/
  main.ts                 Phaser game boot
  agent/
    config.ts             URL-param config (seed, level, autoplay, invincible, debug, paused)
    rng.ts                Seedable PRNG — deterministic runs across machines
    events.ts             window.__SPACEMELON bridge (events, snapshot, input, waitFor*)
    hud.ts                In-game debug overlay (FPS, seed, score, entity count)
  art/
    palettes.ts           Named hex colors shared across all sprites
    pixelCanvas.ts        Tiny helper to paint pixel-perfect textures
    sprites.ts            Procedural ship / bullet / watermelon / star / fx textures
  worlds/
    worlds.ts             WorldDef registry + buildBackground(scene, world, rng)
  levels/
    levels.ts             LevelTuning registry (spawn rate, speed, megas) + tuningForLevel
  ui/
    GameHud.ts            Always-on lives + score overlay (separate from agent/hud.ts dev HUD)
  entities/
    Ship.ts               Player ship (Arcade Sprite)
    Watermelon.ts         Spinning watermelon enemy (small or mega, with HP + path patterns)
  scenes/
    BootScene.ts          Generate textures, emit `boot`, → menu
    MenuScene.ts          Title screen; SPACE/ENTER → game (or autoplay)
    GameScene.ts          Gameplay loop, levels, world swap, scoring
tests/
  helpers/gameClient.ts   Typed wrappers around the bridge for Playwright
  smoke.spec.ts           Boot + per-world screenshot capture
  gameplay.spec.ts        Fire → hit → level-up flow
```

## The agent loop (THIS IS THE LOAD-BEARING PART)

Every gameplay-relevant action emits a structured event and updates a snapshot
on `window.__SPACEMELON`. Tests and agents observe state via this bridge instead
of scraping pixels.

### URL params (all optional)

| Param | Type | Default | Notes |
|---|---|---|---|
| `seed` | int or `0xHEX` | `0xC0FFEE` | Feeds the deterministic RNG everywhere. |
| `level` | int | `1` | Start on a specific level / world. |
| `autoplay` | `1` / `true` | off | Skip the menu and start the game immediately. |
| `invincible` | `1` / `true` | off | Ship ignores watermelon collisions. |
| `debug` | `1` / `true` | off | Show HUD + Arcade physics debug. |
| `paused` | `1` / `true` | off | Boot paused (useful for screenshot framing). |

Example: `http://localhost:5173/?seed=42&level=3&autoplay=1&invincible=1&debug=1`

### Browser-side bridge

```ts
window.__SPACEMELON = {
  version: 1,
  events: GameEvent[],          // ring buffer, last ~2000 entries
  snapshot: {
    ready, scene, level, world, score, lives, fps, entities, seed, paused
  },
  input: {                      // headless input
    left(down), right(down), fire(down), pause()
  },
  waitFor(predicate, timeoutMs?),     // resolves with snapshot
  waitForEvent(type, timeoutMs?),     // resolves with first matching event
};
```

### Event types

`boot`, `scene`, `level-start`, `level-clear`, `spawn`, `hit`, `escape`,
`score`, `lives`, `game-over`, `restart`, `frame`. All carry `t` (ms since
boot). See `src/agent/events.ts` for exact shapes.

**Scoring rules** live in `src/scenes/GameScene.ts` as constants:
small kill `+100`, mega hit `+50`, mega destroy `+500`. Letting a melon drift
off the bottom of the screen penalizes the player (`escape` event):
small `-50`, mega `-200`. Score floors at 0 — bad runs can't go negative.

### Test helpers

`tests/helpers/gameClient.ts` wraps the bridge into a tidy Playwright API:

```ts
await bootGame(page, { seed: 42, autoplay: true, invincible: true });
await waitForEvent(page, "level-start");
await hold(page, "fire", 2000);
const snap = await snapshot(page);
```

Prefer these helpers — they keep tests readable and centralize bridge churn.

## Conventions

- **Determinism first.** Any randomness goes through `Rng` seeded from
  `AgentConfig.seed`. Never call `Math.random()` in gameplay code.
- **Add events for new state.** If you add a feature an agent might want to
  observe (boss spawned, power-up collected, etc.), add a new variant to
  `GameEvent` and emit it. Then update `gameClient.ts` if a higher-level helper
  helps tests stay short.
- **Procedural art lives in `src/art/`.** Use the shared `palettes.ts` rather
  than inlining hex codes — keeps the look cohesive. New textures register a
  key in `TEX` so callers reference them by constant.
- **Worlds are data.** Add a level/world by appending a `WorldDef` to `WORLDS`
  in `src/worlds/worlds.ts`. `worldForLevel(level)` wraps modulo so the loop
  always has art.
- **Difficulty is data.** Per-level tuning (spawn rate, melon speed, spread,
  side-spawn chance, mega schedule, HP) lives in `src/levels/levels.ts`.
  `tuningForLevel(level)` returns explicit entries for L1–L5 and extrapolates
  beyond. Tweak feel here — `GameScene` reads it on `startLevel()`.
- **Tests should boot fresh per scenario.** `bootGame(page, opts)` re-navigates
  with new URL params, which is the supported way to get a clean RNG.

## Closed-loop workflow for agents

When iterating on gameplay or visuals:

1. Make the change.
2. `pnpm typecheck` (fast feedback that the model didn't break types).
3. `pnpm test` — Playwright will build, serve, and run the full suite. Failed
   runs leave traces + videos in `test-results/`.
4. For art/feel work, pull screenshots from the test attachments (the smoke
   suite captures one per world) or run `pnpm dev` and open the browser.
5. If a feature added new observable state, ensure there's an event + a test
   that asserts the event fires.

## Adding things — quick recipes

- **New enemy:** sprite in `art/sprites.ts` (+ `TEX` key), entity class in
  `entities/`, spawn in `GameScene`, emit a `spawn` variant with a new `kind`.
- **New world:** new `WorldDef` in `worlds/worlds.ts` — palette + optional
  `decorate(scene, rng, layer)` for set-pieces.
- **Retune difficulty:** edit the `LEVELS` array in `src/levels/levels.ts`.
  Mega cues are `{ atKill: N }` — when `killedThisLevel` reaches N, a
  megamelon spawns; megamelons take `megaHp` hits and shatter into 6 small
  melons on the killing blow.
- **New input action:** extend the `input` object in `GameBridge` (in
  `agent/events.ts`), bind it in `GameScene.create`, and expose a helper from
  `gameClient.ts`.

## Non-goals (for now)

- No audio.
- No asset binaries / sprite sheets on disk.
- No multiplayer / networking.
- No persistence — score resets on game-over.

Keep additions aligned with these unless explicitly expanding scope.
