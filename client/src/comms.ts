/**
 * The screen, knowledge and communication on screen (shared screen.ts, knowledge.ts, comms.ts).
 *
 * - `ScreenView` draws what the server says is greyed, blanked or scrambled (loadout `screen`):
 *   a hidden panel is covered with its cause ("AMNESIA"), static is a grey noise over it, a
 *   scrambled one has its letters shuffled a few times a second. Panels given back show nothing.
 * - The intel panel (`#intel`) lists people read with insight: their rack, gear, what they can spell.
 * - The feed (`#calls`): spells said aloud in earshot ("BOT3 spelled SWORD") and pings.
 * - Pings: V opens the ping bar, a number pings that word at the pointer; middle-click pings HERE.
 *   Pings heard are marks on the map for PING_MS.
 */
import { PING_TEXT, PINGS, type Blot, type Intel, type Panel, type Ping, type Screen } from "@lastword/shared";

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const $ = (id: string) => document.getElementById(id);

/** What each panel is on the page. */
const PANEL_ELEMENTS: Record<Panel, string[]> = {
  minimap: ["minimap"], bars: [], preview: ["preview"], best: ["best"], inventory: ["panel"], trade: ["panel"],
  rack: ["letters"], chips: ["events", "eventcard"], feed: ["calls", "killfeed", "bigcast", "pingmarks"], cards: ["inspect", "tip", "canspell"], intel: ["intel"],
};

/** How long a ping's mark stays on the map, and a call in the feed. */
export const PING_MS = 6000;
const CALL_MS = 6000;
const CALL_LINES = 4;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A word's letters shuffled among letters (spaces, digits and marks kept), new each call. */
export function garble(text: string): string {
  return text.replace(/[A-Za-z]/g, (c) => {
    const r = LETTERS[Math.floor(Math.random() * 26)]!;
    return c === c.toLowerCase() ? r.toLowerCase() : r;
  });
}

export class ScreenView {
  private screen: Screen = { blots: {}, by: {}, restored: [] };
  private timer = 0;
  /** The inventory or trade screen open now (the two share one sheet). */
  sheet: () => "inventory" | "trade" | null = () => null;

  /** The screen from the loadout. */
  set(screen: Screen | undefined) {
    this.screen = screen ?? { blots: {}, by: {}, restored: [] };
    this.apply();
    clearInterval(this.timer);
    if (Object.values(this.screen.blots).includes("scramble")) this.timer = window.setInterval(() => this.scramble(), 180);
  }

  /** How a panel is shown now: hidden, static, scrambled, or untouched (undefined). */
  blot(panel: Panel): Blot | undefined {
    return this.screen.blots[panel];
  }

  /** Puts each panel's blot on its elements (data-blot, data-by), for the CSS. */
  apply() {
    const marks = new Map<string, { blot: Blot; by: string }>();
    for (const [panel, blot] of Object.entries(this.screen.blots) as [Panel, Blot][]) {
      // The inventory and the trade screen share one sheet: the blot follows the one open.
      if ((panel === "inventory" || panel === "trade") && this.sheet() !== panel) continue;
      for (const id of PANEL_ELEMENTS[panel]) {
        const had = marks.get(id);
        if (!had || blotRank(blot) < blotRank(had.blot)) marks.set(id, { blot, by: (this.screen.by[panel] ?? "").toUpperCase() });
      }
    }
    for (const id of new Set(Object.values(PANEL_ELEMENTS).flat())) {
      const el = $(id);
      if (!el) continue;
      const m = marks.get(id);
      if (m) { el.dataset.blot = m.blot; el.dataset.by = m.by; } else { delete el.dataset.blot; delete el.dataset.by; }
    }
    document.body.classList.toggle("blot-bars", this.screen.blots.bars === "hide");
  }

  /** Shuffles the letters of every scrambled panel's text. The panels redraw from their data, so nothing is lost. */
  private scramble() {
    for (const el of document.querySelectorAll<HTMLElement>("[data-blot=scramble]")) {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) n.nodeValue = garble(n.nodeValue ?? "");
    }
  }
}

const blotRank = (b: Blot) => ["hide", "static", "scramble"].indexOf(b);

/** The intel panel: people read through insight. */
export function drawIntel(list: Intel[]) {
  let el = $("intel");
  if (!el) { el = Object.assign(document.createElement("div"), { id: "intel" }); $("hud")!.append(el); }
  el.innerHTML = list.length ? `<h4>INTEL</h4>${list.map((p) =>
    `<div class="who"><b>${esc(p.name.toUpperCase())}</b><span class="rack">${esc(p.letters || "—")}</span>` +
    `${p.gear.length ? `<small>${esc(p.gear.slice(0, 3).join(", "))}</small>` : ""}` +
    `${p.words?.length ? `<em>can spell ${esc(p.words.join(", "))}</em>` : ""}</div>`).join("")}` : "";
  el.classList.toggle("show", list.length > 0);
}

/** One line in the feed: a spell said aloud, or a ping heard. */
export function feedLine(html: string, cls = "") {
  let el = $("calls");
  if (!el) { el = Object.assign(document.createElement("div"), { id: "calls" }); $("hud")!.append(el); }
  const line = document.createElement("div");
  line.className = cls;
  line.innerHTML = html;
  el.prepend(line);
  while (el.children.length > CALL_LINES) el.lastElementChild!.remove();
  window.setTimeout(() => { line.classList.add("gone"); window.setTimeout(() => line.remove(), 600); }, CALL_MS);
}

/** A spell said aloud in earshot. */
export function callLine(c: { name: string; word: string; ally?: boolean }) {
  feedLine(`<b>${esc(c.name.toUpperCase())}</b> spelled <i>${esc(c.word.toUpperCase())}</i>`, c.ally ? "ally" : "");
}

/** A ping heard: where, from whom, what it says. */
export interface Pinged { name: string; kind: Ping; x: number; y: number; ally: boolean }

/** Ping marks on the map (HTML over the canvas, placed each frame), and the ping bar. */
export class Pings {
  private marks: { p: Pinged; el: HTMLElement; until: number }[] = [];
  private readonly layer: HTMLElement;
  private readonly bar: HTMLElement;
  /** True while the ping bar waits for a number. */
  open = false;

  constructor(private readonly send: (kind: Ping) => void) {
    this.layer = Object.assign(document.createElement("div"), { id: "pingmarks" });
    this.bar = Object.assign(document.createElement("div"), { id: "pingbar" });
    this.bar.innerHTML = `<span>PING</span>${PINGS.map((k, i) => `<button data-ping="${k}"><kbd>${i + 1}</kbd>${PING_TEXT[k]}</button>`).join("")}`;
    this.bar.addEventListener("mousedown", (e) => e.stopPropagation());
    this.bar.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-ping]");
      if (b) { this.send(b.dataset.ping as Ping); this.toggle(false); }
    });
    document.body.append(this.layer, this.bar);
  }

  toggle(open = !this.open) {
    this.open = open;
    this.bar.classList.toggle("show", open);
  }

  /** A number key while the bar is open: that ping. True if it was one. */
  key(k: string): boolean {
    if (!this.open) return false;
    const i = Number(k) - 1;
    if (k === "escape") { this.toggle(false); return true; }
    if (!(i >= 0 && i < PINGS.length)) return false;
    this.send(PINGS[i]!);
    this.toggle(false);
    return true;
  }

  /** A ping heard: a mark on the map and a line in the feed. */
  heard(p: Pinged, me: string) {
    const el = document.createElement("div");
    el.className = `mark ${p.kind}${p.ally ? " ally" : ""}`;
    el.innerHTML = `<i></i><span>${esc(PING_TEXT[p.kind])}<small>${esc(p.name.toUpperCase() === me.toUpperCase() ? "you" : p.name.toUpperCase())}</small></span>`;
    this.layer.append(el);
    this.marks.push({ p, el, until: performance.now() + PING_MS });
    if (p.name.toUpperCase() !== me.toUpperCase()) feedLine(`<b>${esc(p.name.toUpperCase())}</b> ${esc(PING_TEXT[p.kind])}`, `ping ${p.kind}${p.ally ? " ally" : ""}`);
  }

  /** Each frame: marks follow the map; old ones go. */
  frame(project: (x: number, y: number) => { x: number; y: number }) {
    const now = performance.now();
    this.marks = this.marks.filter((m) => {
      if (now > m.until) { m.el.remove(); return false; }
      const s = project(m.p.x, m.p.y);
      m.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
      return true;
    });
  }
}
