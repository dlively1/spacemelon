export interface AgentConfig {
  seed: number;
  startLevel: number;
  debug: boolean;
  autoplay: boolean;
  invincible: boolean;
  paused: boolean;
  muted: boolean;
  // Run the whole game N× faster (1–8). Scales physics, clocks, tweens, fire
  // cooldown, and entity steering so seeded runs stay equivalent — built for
  // tests that otherwise wait wall-clock minutes for level clears.
  timeScale: number;
  // Worst-case load scenario for perf measurement: relentless spawns, no
  // level clear. See STRESS_TUNING in src/levels/levels.ts.
  stress: boolean;
}

const DEFAULTS: AgentConfig = {
  seed: 0xc0ffee,
  startLevel: 1,
  debug: false,
  autoplay: false,
  invincible: false,
  paused: false,
  muted: false,
  timeScale: 1,
  stress: false,
};

function asInt(v: string | null, fallback: number): number {
  if (v == null) return fallback;
  const n = v.startsWith("0x") ? parseInt(v.slice(2), 16) : parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(v: string | null, fallback: boolean): boolean {
  if (v == null) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export function readAgentConfig(search: string = location.search): AgentConfig {
  const p = new URLSearchParams(search);
  return {
    seed: asInt(p.get("seed"), DEFAULTS.seed),
    startLevel: asInt(p.get("level"), DEFAULTS.startLevel),
    debug: asBool(p.get("debug"), DEFAULTS.debug),
    autoplay: asBool(p.get("autoplay"), DEFAULTS.autoplay),
    invincible: asBool(p.get("invincible"), DEFAULTS.invincible),
    paused: asBool(p.get("paused"), DEFAULTS.paused),
    muted: asBool(p.get("muted"), DEFAULTS.muted),
    timeScale: clamp(asFloat(p.get("timeScale"), DEFAULTS.timeScale), 1, 8),
    stress: asBool(p.get("stress"), DEFAULTS.stress),
  };
}

function asFloat(v: string | null, fallback: number): number {
  if (v == null) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
