// Tiny retro SFX engine. All sounds are synthesized live via WebAudio so the
// repo stays binary-asset-free (matches the procedural-sprite philosophy).
//
// This is intentionally simple — sine/square/sawtooth oscillators with an ADSR
// envelope, plus filtered white noise for explosions. Plenty good for arcade
// blips; we can swap in a richer engine (sfxr/jsfxr port, real samples) later.

export type SfxName =
  | "fire"
  | "hit"
  | "megaHit"
  | "megaDestroy"
  | "shipHit"
  | "escape"
  | "levelStart"
  | "levelClear"
  | "gameOver"
  | "restart"
  | "powerup"
  | "bomb";

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  endFreq?: number; // slide from freq → endFreq across duration
  wave?: Wave; // default "square"
  duration: number; // seconds
  attack?: number; // seconds (default 0.005)
  release?: number; // seconds (default duration)
  volume?: number; // 0..1 (default 0.15)
  detune?: number; // cents
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.6;

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private getCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      return null;
    }
    return this.ctx;
  }

  // Many browsers suspend the AudioContext until the user interacts. Phaser
  // input handlers count as gestures, so calling this from "down" handlers is
  // the right place. Safe to call repeatedly.
  resume(): void {
    const ctx = this.getCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  private tone(opts: ToneOpts, t0: number): void {
    const ctx = this.getCtx();
    if (!ctx || !this.master) return;
    const {
      freq,
      endFreq,
      wave = "square",
      duration,
      attack = 0.005,
      release,
      volume = 0.15,
      detune = 0,
    } = opts;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (typeof endFreq === "number") {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
    }
    if (detune) osc.detune.value = detune;

    const rel = release ?? duration;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + rel);

    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + attack + rel + 0.02);
  }

  private noiseBurst(duration: number, volume: number, t0: number, lowpass = 1500): void {
    const ctx = this.getCtx();
    if (!ctx || !this.master) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  play(name: SfxName): void {
    if (this.muted) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      switch (name) {
        case "fire":
          // Quick high pew descending — classic shooter blip.
          this.tone({ freq: 980, endFreq: 420, wave: "square", duration: 0.08, volume: 0.08 }, now);
          break;
        case "hit":
          // Sharp short pluck on a watermelon pop.
          this.tone(
            { freq: 520, endFreq: 220, wave: "triangle", duration: 0.1, volume: 0.16 },
            now,
          );
          this.noiseBurst(0.06, 0.06, now, 2400);
          break;
        case "megaHit":
          // Non-killing mega hit — meatier thud.
          this.tone({ freq: 280, endFreq: 180, wave: "square", duration: 0.12, volume: 0.18 }, now);
          break;
        case "megaDestroy":
          // Big boom: low sweep + noise burst.
          this.tone({ freq: 220, endFreq: 60, wave: "sawtooth", duration: 0.35, volume: 0.2 }, now);
          this.noiseBurst(0.32, 0.18, now, 900);
          break;
        case "shipHit":
          // Player damage — sad descending wobble.
          this.tone(
            { freq: 360, endFreq: 90, wave: "sawtooth", duration: 0.45, volume: 0.18 },
            now,
          );
          this.noiseBurst(0.2, 0.08, now + 0.05, 1200);
          break;
        case "escape":
          // Bummer — descending blip in a minor flavor.
          this.tone({ freq: 320, endFreq: 140, wave: "square", duration: 0.18, volume: 0.1 }, now);
          break;
        case "levelStart":
          // Three-note rising arpeggio.
          this.tone({ freq: 440, wave: "square", duration: 0.08, volume: 0.1 }, now);
          this.tone({ freq: 587, wave: "square", duration: 0.08, volume: 0.1 }, now + 0.09);
          this.tone({ freq: 880, wave: "square", duration: 0.14, volume: 0.12 }, now + 0.18);
          break;
        case "levelClear":
          // Triumphant arpeggio, longer.
          this.tone({ freq: 523, wave: "square", duration: 0.1, volume: 0.12 }, now);
          this.tone({ freq: 659, wave: "square", duration: 0.1, volume: 0.12 }, now + 0.11);
          this.tone({ freq: 784, wave: "square", duration: 0.1, volume: 0.12 }, now + 0.22);
          this.tone({ freq: 1047, wave: "square", duration: 0.22, volume: 0.14 }, now + 0.33);
          break;
        case "gameOver":
          // Sad descending arpeggio.
          this.tone({ freq: 523, wave: "triangle", duration: 0.18, volume: 0.14 }, now);
          this.tone({ freq: 392, wave: "triangle", duration: 0.18, volume: 0.14 }, now + 0.2);
          this.tone({ freq: 330, wave: "triangle", duration: 0.18, volume: 0.14 }, now + 0.4);
          this.tone({ freq: 220, wave: "sawtooth", duration: 0.55, volume: 0.16 }, now + 0.6);
          break;
        case "restart":
          this.tone(
            { freq: 660, endFreq: 1320, wave: "square", duration: 0.18, volume: 0.12 },
            now,
          );
          break;
        case "powerup":
          // Bright rising power-up chime — "you got something good".
          this.tone({ freq: 660, wave: "square", duration: 0.08, volume: 0.12 }, now);
          this.tone({ freq: 990, wave: "square", duration: 0.08, volume: 0.12 }, now + 0.08);
          this.tone(
            { freq: 1320, endFreq: 1760, wave: "square", duration: 0.16, volume: 0.14 },
            now + 0.16,
          );
          break;
        case "bomb":
          // Heavy area-blast detonation — deep sweep + long noise.
          this.tone(
            { freq: 180, endFreq: 40, wave: "sawtooth", duration: 0.45, volume: 0.22 },
            now,
          );
          this.noiseBurst(0.4, 0.22, now, 700);
          break;
      }
    } catch {
      // Audio failures must never crash gameplay.
    }
  }
}

// Singleton — one shared AudioContext for the whole app.
export const sfx = new Sfx();
