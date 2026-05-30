import Phaser from "phaser";

// Gamepad support for keyboard-parity play on a DualShock or a true-USB arcade
// encoder. Keyboard-emulating arcade cabinets already work via the WASD/arrows +
// space bindings in the scenes, so this module only covers the Gamepad-API path.
//
// `gamepadIntent` is a pure function (no Phaser/DOM deps) so the button/axis
// mapping is reviewable and unit-test-ready in isolation. `Controls` wraps it
// with the live Phaser pad plus the per-frame history that rising-edge detection
// (confirm/back/pause/mute) needs. Held movement/fire is OR'd in by each scene
// alongside the keyboard and the headless agent bridge, so gamepad input is
// purely additive — with no pad connected every getter returns false.

// W3C "standard" mapping button indices. A DualShock in standard mode and most
// USB arcade encoders expose the same layout.
const BTN = {
  fire: [0, 4, 5], // Cross / L1 / R1 — shoulder alts are arcade-friendly
  confirm: [0, 9], // Cross / Options — start & restart
  back: [1, 8], // Circle / Share — game-over → menu
  pause: [9], // Options
  mute: [2], // Square
} as const;

const DPAD = { up: 12, down: 13, left: 14, right: 15 } as const;

// Generous deadzone — covers DS4 stick drift and loose arcade joysticks. The
// dpad is digital and ignores this.
const STICK_DEADZONE = 0.35;

export interface GamepadIntent {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  // Discrete actions reported as instantaneous "is down" — Controls derives the
  // rising edge from frame-to-frame history.
  confirm: boolean;
  back: boolean;
  pause: boolean;
  mute: boolean;
}

const EMPTY: GamepadIntent = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  confirm: false,
  back: false,
  pause: false,
  mute: false,
});

const anyDown = (buttons: readonly boolean[], idxs: readonly number[]): boolean =>
  idxs.some((i) => buttons[i] === true);

/**
 * Map a snapshot of pressed buttons + stick axes to an intent. Pure: same input
 * always yields the same output, no Phaser or browser state involved.
 */
export function gamepadIntent(
  buttons: readonly boolean[],
  axes: readonly number[],
  deadzone: number = STICK_DEADZONE,
): GamepadIntent {
  const ax = axes[0] ?? 0;
  const ay = axes[1] ?? 0; // up is negative Y in the standard mapping
  return {
    left: ax < -deadzone || buttons[DPAD.left] === true,
    right: ax > deadzone || buttons[DPAD.right] === true,
    up: ay < -deadzone || buttons[DPAD.up] === true,
    down: ay > deadzone || buttons[DPAD.down] === true,
    fire: anyDown(buttons, BTN.fire),
    confirm: anyDown(buttons, BTN.confirm),
    back: anyDown(buttons, BTN.back),
    pause: anyDown(buttons, BTN.pause),
    mute: anyDown(buttons, BTN.mute),
  };
}

export class Controls {
  private readonly scene: Phaser.Scene;
  // Snapshot taken once per frame in update(), so all getters within a frame are
  // consistent and the pad is read only once.
  private intent: GamepadIntent = EMPTY;
  private prev: GamepadIntent = EMPTY;
  private edge = { confirm: false, back: false, pause: false, mute: false };
  private connected = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Call first in the owning scene's update(). Snapshots state + edges. */
  update(): void {
    const pad = this.scene.input.gamepad?.getPad(0);
    if (!pad || !pad.connected) {
      // No pad → inert. Clear prev so a reconnect can't fire a stale edge from
      // a button that happened to be down at disconnect.
      this.intent = EMPTY;
      this.prev = EMPTY;
      this.edge = { confirm: false, back: false, pause: false, mute: false };
      this.connected = false;
      return;
    }
    const buttons = pad.buttons.map((b) => b.pressed);
    const axes = [pad.leftStick.x, pad.leftStick.y];
    const cur = gamepadIntent(buttons, axes);
    this.edge = {
      confirm: cur.confirm && !this.prev.confirm,
      back: cur.back && !this.prev.back,
      pause: cur.pause && !this.prev.pause,
      mute: cur.mute && !this.prev.mute,
    };
    this.prev = cur;
    this.intent = cur;
    this.connected = true;
  }

  get left(): boolean {
    return this.intent.left;
  }
  get right(): boolean {
    return this.intent.right;
  }
  get up(): boolean {
    return this.intent.up;
  }
  get down(): boolean {
    return this.intent.down;
  }
  get fire(): boolean {
    return this.intent.fire;
  }

  // Rising-edge helpers — true only on the frame the action transitions to
  // pressed. Safe to call multiple times per frame (read precomputed edges).
  confirmPressed(): boolean {
    return this.edge.confirm;
  }
  backPressed(): boolean {
    return this.edge.back;
  }
  pausePressed(): boolean {
    return this.edge.pause;
  }
  mutePressed(): boolean {
    return this.edge.mute;
  }

  /** Any control currently active — used for the best-effort audio-resume gesture. */
  anyButtonPressed(): boolean {
    const i = this.intent;
    return (
      this.connected &&
      (i.fire || i.confirm || i.back || i.pause || i.mute || i.left || i.right || i.up || i.down)
    );
  }
}
