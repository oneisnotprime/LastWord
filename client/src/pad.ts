/**
 * Controller input (the Gamepad API, standard mapping). Polled each animation frame:
 *
 * - The last input decides which button prompts show: `body.pad` for a controller, else keys.
 *   `keyGlyph` and `padGlyph` write both kinds; CSS shows one. `body.ps` swaps Xbox labels
 *   (A B X Y, LB) for PlayStation ones (✕ ○ □ △, L1).
 * - While a screen is open (a `Scope`: the letter picker, a menu, the loadout), the D-pad or left
 *   stick moves a focus ring between its buttons and items, A presses, B goes back (Esc).
 * - Otherwise the scene's `world` handler gets the frame: walking, attacking, inspecting, aiming.
 */

/** Buttons of the standard mapping, by index. */
export const BUTTONS = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, ls: 10, rs: 11, up: 12, down: 13, left: 14, right: 15 } as const;
export type Button = keyof typeof BUTTONS;

const XBOX: Record<Button, string> = { a: "A", b: "B", x: "X", y: "Y", lb: "LB", rb: "RB", lt: "LT", rt: "RT", back: "View", start: "Menu", ls: "LS", rs: "RS", up: "D↑", down: "D↓", left: "D←", right: "D→" };
const PLAYSTATION: Record<Button, string> = { ...XBOX, a: "✕", b: "○", x: "□", y: "△", lb: "L1", rb: "R1", lt: "L2", rt: "R2", back: "Share", start: "Options" };

/** Keyboard keys and the controller button that does the same, for prompts and hints. */
export const KEY_BUTTON: Record<string, Button> = {
  G: "a", E: "x", R: "b", Q: "lb", U: "rb", Enter: "y", Esc: "b", L: "up", I: "down", T: "right",
};

/** A controller button's label, as shown (hidden unless the controller was used last). */
export function padGlyph(b: Button): string {
  return `<kbd class="p" data-b="${b}" data-x="${XBOX[b]}" data-s="${PLAYSTATION[b]}"></kbd>`;
}

/** A key's label for keyboard players and its button's for controller players; CSS shows one. */
export function keyGlyph(key: string): string {
  const b = KEY_BUTTON[key];
  return `<kbd class="k">${key}</kbd>${b ? padGlyph(b) : ""}`;
}

/** Text for one kind of player only: `only("click a target", "A on a target")`. */
export function only(keys: string, controller: string): string {
  return `<span class="konly">${keys}</span><span class="ponly">${controller}</span>`;
}

/** A screen the controller can move around in. Lower rank wins when several are open. */
export interface Scope {
  rank: number;
  /** The open screen's element, or null while it is closed. */
  el: () => HTMLElement | null;
  /** A button pressed while this screen is open; true if handled (else A presses, B is Esc). */
  press?: (b: Button, focused: HTMLElement | null) => boolean;
  /** The focus moved (null: it left this screen). */
  focus?: (el: HTMLElement | null) => void;
  /** Where the focus starts. */
  first?: (items: HTMLElement[]) => HTMLElement | undefined;
}

/** What can take the focus on a screen. */
const FOCUSABLE = "button:not([disabled]), [data-inspect], [data-pick], input, select, [data-pad]";
const DEADZONE = 0.25;
/** A held direction repeats after this long, then this often (ms). */
const REPEAT_DELAY = 360, REPEAT_EVERY = 110;

const CSS = `
kbd.p { display: none; }
body.pad kbd.p { display: inline-block; }
body.pad kbd.k { display: none; }
kbd.p::after { content: attr(data-x); }
body.ps kbd.p::after { content: attr(data-s); }
kbd.p { min-width: 1.2em; text-align: center; font: 700 11px/1.5 var(--round, sans-serif); font-style: normal; padding: 0 5px; margin: 0 3px 0 0; border-radius: 9px;
  color: #fff; background: #6a5d4c; box-shadow: 0 1px 0 rgba(0,0,0,.35); vertical-align: middle; }
body:not(.ps) kbd.p[data-b="a"] { background: #4f8a3a; } body:not(.ps) kbd.p[data-b="b"] { background: #c9453f; }
body:not(.ps) kbd.p[data-b="x"] { background: #2f6aa8; } body:not(.ps) kbd.p[data-b="y"] { background: #c9962a; }
body.ps kbd.p[data-b="a"] { background: #4a6fb8; } body.ps kbd.p[data-b="b"] { background: #c9453f; }
body.ps kbd.p[data-b="x"] { background: #b85a9a; } body.ps kbd.p[data-b="y"] { background: #3f9a7a; }
body.pad .konly { display: none; }
body:not(.pad) .ponly { display: none; }
body.pad .padfocus { outline: 3px solid #2f8aa8 !important; outline-offset: 2px; border-radius: 3px; }
body.pad .tile.padfocus { outline-offset: 1px; transform: translateY(-3px) scale(1.12) !important; z-index: 1; }
body.pad .padonly { display: block; }
.padonly { display: none; }
body.pad .keysonly { display: none; }
`;

function visible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

/** A name for a focused element that survives a redraw (screens redraw when letters arrive). */
function keyOf(el: HTMLElement): string {
  const data = JSON.stringify({ ...el.dataset });
  return `${el.tagName}#${el.id}${data}${data === "{}" && !el.id ? el.textContent?.trim().slice(0, 30) : ""}`;
}

function centre(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** The item nearest `from` in a direction: mostly along it, a little across. */
export function nearestIn(from: HTMLElement, items: HTMLElement[], dx: number, dy: number): HTMLElement | undefined {
  const a = centre(from);
  let best: HTMLElement | undefined, score = Infinity;
  for (const el of items) {
    if (el === from) continue;
    const b = centre(el), along = (b.x - a.x) * dx + (b.y - a.y) * dy, across = Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx);
    if (along <= 2) continue;
    const s = along + across * 2.5;
    if (s < score) { score = s; best = el; }
  }
  return best;
}

export class Pad {
  mode: "keys" | "pad" = "keys";
  /** True once any controller has been seen. */
  connected = false;
  private now: boolean[] = [];
  private before: boolean[] = [];
  private axes = [0, 0, 0, 0];
  /** Left stick while walking is allowed (no screen open), for the scene's movement. */
  walk = { x: 0, y: 0 };
  /** Called each frame no screen has the controller. */
  world: ((pad: Pad, dt: number) => void) | null = null;
  private scopes: Scope[] = [];
  private scope: Scope | null = null;
  private scopeEl: HTMLElement | null = null;
  private focused: HTMLElement | null = null;
  private focusKey = "";
  private focusIndex = 0;
  private held = { dir: "", since: 0, last: 0 };
  private last = performance.now();

  constructor() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);
    window.addEventListener("keydown", (e) => { if (e.isTrusted) this.setMode("keys"); }, true);
    window.addEventListener("mousedown", (e) => { if (e.isTrusted) this.setMode("keys"); }, true);
    window.addEventListener("mousemove", (e) => { if (e.isTrusted && Math.abs(e.movementX) + Math.abs(e.movementY) > 6) this.setMode("keys"); }, true);
    const loop = () => { this.frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /** Adds a screen the controller can move around in. */
  add(scope: Scope) {
    this.scopes.push(scope);
    this.scopes.sort((a, b) => a.rank - b.rank);
  }

  setMode(mode: "keys" | "pad") {
    if (mode === this.mode) return;
    this.mode = mode;
    document.body.classList.toggle("pad", mode === "pad");
  }

  /** Pressed this frame (not held from before). */
  pressed(b: Button): boolean {
    const i = BUTTONS[b];
    return !!this.now[i] && !this.before[i];
  }

  down(b: Button): boolean {
    return !!this.now[BUTTONS[b]];
  }

  /** A stick (0 left, 1 right) past the deadzone, rescaled so its edge is 0 and full tilt 1. */
  stick(which: 0 | 1): { x: number; y: number; m: number } {
    const x = this.axes[which * 2] ?? 0, y = this.axes[which * 2 + 1] ?? 0, m = Math.hypot(x, y);
    if (m < DEADZONE) return { x: 0, y: 0, m: 0 };
    const k = Math.min(1, (m - DEADZONE) / (1 - DEADZONE)) / m;
    return { x: x * k, y: y * k, m: Math.min(1, (m - DEADZONE) / (1 - DEADZONE)) };
  }

  /** Presses a key as if typed (a synthetic keydown and keyup on the window). */
  key(key: string) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  }

  /** Clicks an element at its middle, as a mouse would. */
  click(el: HTMLElement) {
    const c = centre(el);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: c.x, clientY: c.y }));
  }

  /** The element with the focus ring, if a screen is open. */
  get focus(): HTMLElement | null {
    return this.focused;
  }

  private frame() {
    const t = performance.now(), dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    const gp = [...(navigator.getGamepads?.() ?? [])].find((g) => g && g.connected) ?? null;
    this.before = this.now;
    if (!gp) {
      this.now = []; this.axes = [0, 0, 0, 0]; this.walk = { x: 0, y: 0 };
      return;
    }
    this.connected = true;
    this.now = gp.buttons.map((b) => b.pressed || b.value > 0.5);
    this.axes = [...gp.axes];
    const pressedAny = this.now.some((d, i) => d && !this.before[i]);
    const was = this.mode;
    if (pressedAny || Math.hypot(this.axes[0] ?? 0, this.axes[1] ?? 0) > 0.5 || Math.hypot(this.axes[2] ?? 0, this.axes[3] ?? 0) > 0.5) {
      this.setMode("pad");
      // Sony's vendor id, or its names; "Wireless Controller" alone is how Chrome names a DualShock 4.
      document.body.classList.toggle("ps", /playstation|dualsense|dualshock|054c|sony/i.test(gp.id) || (/^wireless controller/i.test(gp.id) && !/xbox|045e/i.test(gp.id)));
    }
    if (this.mode !== "pad") { this.walk = { x: 0, y: 0 }; return; }
    this.route(t, dt, was !== "pad");
  }

  /** `woke`: the controller was just picked up, so on a screen this press only shows the focus ring. */
  private route(t: number, dt: number, woke = false) {
    let scope: Scope | null = null, el: HTMLElement | null = null;
    for (const s of this.scopes) { el = s.el(); if (el && visible(el)) { scope = s; break; } el = null; }
    if (scope !== this.scope || el !== this.scopeEl) {
      this.scope?.focus?.(null);
      this.setFocus(null);
      this.focusKey = ""; this.focusIndex = 0;
      this.scope = scope; this.scopeEl = el;
      this.held = { dir: "", since: 0, last: 0 };
    }
    if (!scope || !el) {
      const s = this.stick(0);
      this.walk = { x: s.x, y: s.y };
      this.world?.(this, dt);
      return;
    }
    this.walk = { x: 0, y: 0 };
    const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
    // The screen redrew: find the same element again, else the one in its place.
    if (!this.focused || !this.focused.isConnected || !el.contains(this.focused)) {
      const again = (this.focusKey && items.find((i) => keyOf(i) === this.focusKey)) || (this.focusKey ? items[Math.min(this.focusIndex, items.length - 1)] : undefined) || scope.first?.(items) || items[0];
      this.setFocus(again ?? null, !!this.focusKey && again !== undefined && keyOf(again) === this.focusKey);
    }
    const f = this.focused;
    if (woke) { this.held = { dir: "", since: t, last: t }; return; }
    for (const b of Object.keys(BUTTONS) as Button[]) {
      if (!this.pressed(b)) continue;
      if (scope.press?.(b, f)) continue;
      if (b === "a" && f) {
        if (f instanceof HTMLInputElement && f.type === "number") continue;
        if (f instanceof HTMLSelectElement) continue;
        this.click(f);
      } else if (b === "b") this.key("Escape");
    }
    // D-pad or left stick: move the focus (or change a number or a choice), repeating while held.
    const s = this.stick(0);
    const dir = this.down("up") || s.y < -0.6 ? "up" : this.down("down") || s.y > 0.6 ? "down" : this.down("left") || s.x < -0.6 ? "left" : this.down("right") || s.x > 0.6 ? "right" : "";
    if (!dir) { this.held.dir = ""; return; }
    if (dir === this.held.dir && (t - this.held.since < REPEAT_DELAY || t - this.held.last < REPEAT_EVERY)) return;
    if (dir !== this.held.dir) this.held = { dir, since: t, last: t }; else this.held.last = t;
    const cur = this.focused;
    if (!cur) return this.setFocus(items[0] ?? null);
    if ((dir === "left" || dir === "right") && this.adjust(cur, dir === "left" ? -1 : 1)) return;
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]!;
    const next = nearestIn(cur, items, dx!, dy!);
    if (next) this.setFocus(next);
    void dt;
  }

  /** Left and right on a number or a choice change it rather than move away. */
  private adjust(el: HTMLElement, by: number): boolean {
    if (el instanceof HTMLInputElement && el.type === "number") {
      const min = Number(el.min || -Infinity), max = Number(el.max || Infinity);
      el.value = String(Math.max(min, Math.min(max, (Number(el.value) || 0) + by)));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    if (el instanceof HTMLSelectElement) {
      el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + by));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  /** Moves the focus ring; `quiet` when it is the same element found again after a redraw. */
  private setFocus(el: HTMLElement | null, quiet = false) {
    this.focused?.classList.remove("padfocus");
    this.focused = el;
    if (!el) return;
    el.classList.add("padfocus");
    this.focusKey = keyOf(el);
    const items = this.scopeEl ? [...this.scopeEl.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible) : [];
    this.focusIndex = Math.max(0, items.indexOf(el));
    if (!quiet) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      this.scope?.focus?.(el);
    }
  }
}

/** The one controller reader for the page. */
export const pad = new Pad();

// Screens every page has: the Esc menu and the start screen. The HUD adds its own.
pad.add({
  rank: 20, el: () => document.querySelector<HTMLElement>("#menu.show .card"), first: (items) => items.find((i) => i.id === "resume"),
  press: (b) => { if (b === "start") { pad.key("Escape"); return true; } return false; },
});
pad.add({
  rank: 40, el: () => document.querySelector<HTMLElement>("#start .box"),
  first: (items) => items.find((i) => i.classList.contains("main")),
  // B does nothing here: Esc would open the menu behind the start screen.
  press: (b) => b === "b",
});
// The starting kits (kits.ts): the pick of three (B does nothing: a kit must be chosen), or your
// own kit card (B closes it).
pad.add({
  rank: 25, el: () => document.querySelector<HTMLElement>("#kits.show .sheet"),
  press: (b) => {
    if (b !== "b") return false;
    const close = document.querySelector<HTMLElement>("#kits.show button.close");
    if (close) pad.click(close);
    return true;
  },
});
// Any other screen that asks for it (data-pad-scope), such as a choice before the round.
pad.add({ rank: 45, el: () => [...document.querySelectorAll<HTMLElement>("[data-pad-scope]")].find(visible) ?? null, press: (b) => b === "b" });
