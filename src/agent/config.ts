export interface AgentConfig {
  seed: number;
  startLevel: number;
  debug: boolean;
  autoplay: boolean;
  invincible: boolean;
  paused: boolean;
}

const DEFAULTS: AgentConfig = {
  seed: 0xC0FFEE,
  startLevel: 1,
  debug: false,
  autoplay: false,
  invincible: false,
  paused: false,
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
  };
}
