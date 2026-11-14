import { LETTER_GUIDE, missing, parsePhrase, type Card, type Dictionary, type Letters, type LoadoutDetail } from "@lastword/shared";
import { BADGE } from "./art/paper.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** A Use button for something carried that does something when used. */
const useButton = (g: LoadoutDetail["gear"][number]) => (g.usable ? `<button data-use="${g.index}">Use</button>` : "");

/** Things on the ground in reach that you can use, each with a Use button. */
const nearby = (d: LoadoutDetail | null) =>
  d?.nearby.map((t) => `<div class="row"><span class="what">${t.phrase}</span><span class="slot">ground</span><button data-use-thing="${t.id}">Use</button></div>`).join("") ||
  `<div class="row"><span class="empty">Nothing to use</span></div>`;

/** How a creature is doing, if it is not well: hungry, fleeing. */
const mood = (c: LoadoutDetail["creatures"][number]) =>
  [c.hungry ? "hungry" : "", c.fleeing ? "fleeing" : ""].filter(Boolean).map((m) => `<span class="slot status">${m}</span>`).join("");

/** A store as shown: what is held, and what is drawn and made a minute. */
const store = (s: LoadoutDetail["stores"]["food"]) =>
  `${s.have}${s.need || s.make ? ` <small>(${s.make ? `+${s.make}` : ""}${s.make && s.need ? " " : ""}${s.need ? `−${s.need}` : ""}/min)</small>` : ""}`;

/** What the top-left HUD shows that does not come from the loadout: the round, and your health now. */
export interface HudFrame {
  name: string;
  /** Health as a percentage, from the shared state (the loadout is not sent every frame). */
  hp: number;
  alive: number;
  /** Seconds since the round began. */
  clock: number;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** A labelled bar: health, armour, what you ride. */
function bar(label: string, now: number, max: number, kind = "") {
  const pct = max > 0 ? Math.max(0, Math.min(100, (100 * now) / max)) : 0;
  const tone = kind || (pct > 50 ? "" : pct > 25 ? "mid" : "low");
  return `<div class="bar"><span>${label}</span><div class="track"><i class="${tone}" style="width:${pct}%"></i><em>${Math.round(now)} / ${Math.round(max)}</em></div></div>`;
}

/** A card: what something is, its numbers and what it does (the spell preview and the inspect card). */
export function cardHtml(card: Card, extra: string[] = []): string {
  const list = (items: string[], cls: string) => (items.length ? `<ul class="${cls}">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
  return `<div class="title">${esc(card.title)}</div>${card.kind ? `<div class="kind">${esc(card.kind)}</div>` : ""}` +
    list(extra, "extra") + list(card.stats, "stats") + list(card.does, "does");
}

/** Something a spelling is aimed at before it is cast: a person, creature or thing, by id. */
export interface Aimed { id: string; name: string }

/** A coloured paper chip, in a status badge's colours. */
function chip(status: string, left?: number) {
  const b = BADGE[status] ?? { ink: "#4a3f33", paper: "#e6d3a3", text: status.toUpperCase() };
  return `<span class="chip" style="background:${b.paper};color:${b.ink}">${esc(b.text)}${left !== undefined && left > 0 ? `<small>${left}s</small>` : ""}</span>`;
}

/** The overlay drawn in HTML on top of the game: the HUD, letters held, the spell window, toasts and screens. */
export class Hud {
  private held: Letters = {};
  private readonly input = $<HTMLInputElement>("spell");
  private readonly win = $("spellwin");
  private toastTimer = 0;
  private detail: LoadoutDetail | null = null;
  private open: "inventory" | "loadout" | null = null;
  private frame: HudFrame | null = null;
  private drawnHud = "";
  private place = "";
  /** Adjectives spelled alone waiting for a target, or null. */
  private aiming: string | null = null;
  /** No spelling: dead, spectating, or the round is over. */
  private locked = false;
  /** What the spell window is aimed at (from an inspect card's Add adjective), or null. */
  private target: Aimed | null = null;
  /** Called with what is being inspected's "Add adjective". */
  private inspected: Aimed | null = null;
  /** Something waits for a click (adjectives or an event): Esc cancels that, not opens the menu. */
  private aimingAny = false;
  /** The spelling as it last stood, to put back a letter you do not hold. */
  private lastText = "";
  private rejectTimer = 0;
  /** Knocked out, and whom you are watching. */
  private out: string | null = null;

  constructor(
    onSpell: (text: string, target: Aimed | null) => void,
    private readonly dict: Dictionary,
    private readonly onDrop: (index: number) => void,
    /** Use something carried (its index) or on the ground (its thing id). */
    private readonly onUse: (which: number | string) => void,
    /** Put the adjectives being aimed on a piece of your own gear, by index. */
    private readonly onAimGear: (index: number) => void = () => {},
    /** Knocked out: start a new round in a fresh room. */
    private readonly onAgain: () => void = () => {},
  ) {
    $("abc").innerHTML = alphabet();
    // The knocked out card's button (pointer events are off on the rest of the HUD).
    $("status").addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("button.again")) this.onAgain(); });
    window.addEventListener("keydown", (e) => {
      if (this.typing || e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "i") this.show(this.open === "inventory" ? null : "inventory");
      else if (key === "l") this.show(this.open === "loadout" ? null : "loadout");
      else if (key === "escape") {
        // Esc closes what is open first (a screen, the menu, an aim, an inspect card), else opens the menu.
        if (this.open) this.show(null);
        else if (this.menuOpen) this.menu(false);
        else if (!this.aimingAny && !this.inspected) this.menu(true);
      }
    });
    $("resume").addEventListener("click", () => this.menu(false));
    $("panel").addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest("button");
      if (!el) return;
      if (el.dataset.drop !== undefined) this.onDrop(Number(el.dataset.drop));
      if (el.dataset.use !== undefined) this.onUse(Number(el.dataset.use));
      if (el.dataset.useThing !== undefined) this.onUse(el.dataset.useThing);
      if (el.dataset.aimGear !== undefined) { this.onAimGear(Number(el.dataset.aimGear)); this.show(null); }
      if (el.dataset.word) { this.show(null); this.openSpell(el.dataset.word); }
    });
    // Enter opens the spell window. While it is open every key goes to it and nothing else.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !this.typing) {
        e.preventDefault();
        this.openSpell();
      }
    });
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // no hotkey, movement or screen sees a key typed here
      if (e.key === "Enter") {
        e.preventDefault();
        const text = this.input.value, target = this.target;
        this.closeSpell();
        if (text.trim()) onSpell(text, target);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.closeSpell();
      }
    });
    // Key releases are not stopped here: the game must see an arrow let go while the window was open.
    this.input.addEventListener("input", () => this.typed());
    $("inspect").addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest("button");
      if (!el) return;
      const target = this.inspected;
      this.closeInspect();
      if (el.dataset.adjective !== undefined && target) this.openSpell("", target);
    });
    // A click outside the card keeps the window open and the cursor in it.
    this.win.addEventListener("mousedown", (e) => { if (e.target !== this.input) { e.preventDefault(); this.input.focus(); } });
    this.input.addEventListener("blur", () => { if (this.typing) setTimeout(() => this.typing && this.input.focus(), 0); });
  }

  /** True while the Esc menu is up. */
  get menuOpen(): boolean {
    return $("menu").classList.contains("show");
  }

  private menu(open: boolean) {
    $("menu").className = open ? "show" : "";
  }

  /**
   * The letters a spelling spends: all of it, or for "give player2 abc" and "trade eee for o"
   * only the letters handed over (the name, "give", "trade" and what you ask for cost nothing).
   */
  private spends(text: string): string {
    const t = text.toLowerCase().trimStart();
    const give = /^give\s+\S+\s+(.*)$/.exec(t);
    if (give) return give[1]!.replace(/[^a-z]/g, "");
    if (/^give(\s+\S*)?\s*$/.test(t) || (t && ("give".startsWith(t) || "trade".startsWith(t)))) return "";
    // "trade eee for o" at a market: only the letters handed over.
    const trade = /^trade\s+(\S*)/.exec(t);
    if (trade) return trade[1]!.replace(/[^a-z]/g, "");
    return t.replace(/[^a-z]/g, "");
  }

  /** A letter typed that you do not hold (one E too many counts) is not added: the window flashes red and shakes. */
  private typed() {
    const text = this.input.value;
    const short = (t: string) => missing(this.held, this.spends(t)).length;
    if (short(text) > short(this.lastText)) {
      const caret = Math.max(0, (this.input.selectionStart ?? text.length) - (text.length - this.lastText.length));
      this.input.value = this.lastText;
      this.input.setSelectionRange(caret, caret);
      this.reject();
      return;
    }
    this.lastText = text;
    this.drawLetters();
  }

  private reject() {
    const card = this.win.querySelector(".card") as HTMLElement;
    card.classList.remove("reject");
    void card.offsetWidth; // restart the animation
    card.classList.add("reject");
    clearTimeout(this.rejectTimer);
    this.rejectTimer = window.setTimeout(() => card.classList.remove("reject"), 450);
  }

  /** True while the spell window is open: every key goes to it. */
  get typing(): boolean {
    return this.win.classList.contains("show");
  }

  /** Opens the spell window, optionally with a word already in it and aimed at something. Not while you cannot spell. */
  openSpell(text = "", target: Aimed | null = null) {
    if (this.locked) return;
    this.show(null);
    this.closeInspect();
    this.target = target;
    $("spellfor").innerHTML = target ? `on <b>${esc(target.name.toUpperCase())}</b>` : "";
    this.win.className = "show";
    this.input.value = text;
    this.lastText = text;
    this.input.focus();
    this.drawLetters();
  }

  closeSpell() {
    this.win.className = "";
    this.input.value = "";
    this.lastText = "";
    this.target = null;
    this.input.blur();
    this.drawLetters();
  }

  /** Stops all spelling for good (dead, spectating, round over), closing the window if open. */
  lock() {
    if (this.locked) return;
    this.locked = true;
    if (this.typing) this.closeSpell();
    this.closeInspect();
  }

  /** The inspect card (right-click): what something in the world is, by the pointer, with Add adjective. */
  inspect(card: Card, extra: string[], target: Aimed, x: number, y: number) {
    const el = $("inspect");
    this.inspected = target;
    el.innerHTML = cardHtml(card, extra) + (this.locked ? "" : `<button data-adjective>Add adjective</button>`) + `<button data-close>Close</button>`;
    el.className = "show";
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x + 14))}px`;
    el.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, y - 10))}px`;
  }

  closeInspect() {
    this.inspected = null;
    $("inspect").className = "";
  }

  /** The id being inspected, to ring it. */
  get inspecting(): string | null {
    return this.inspected?.id ?? null;
  }

  /** Bottom-left: the ground under you and your tile. */
  corner(ground: string, x: number, y: number) {
    const html = `<b>${esc(ground.replace(/([a-z])([A-Z])/g, "$1 $2"))}</b><span>tile ${x}, ${y}</span>`;
    const el = $("corner");
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  /** Letters held right now. */
  get letters(): Letters {
    return this.held;
  }

  /**
   * Shows that a spelling waits for a click on its target, or (null) that none does: adjectives
   * (`describe`), or an event aimed at `someone` or `anywhere`.
   */
  aim(words: string | null, how: "describe" | "someone" | "anywhere" = "describe") {
    this.aiming = how === "describe" ? words : null;
    this.aimingAny = !!words;
    const banner = $("aim"), cursor = $("aimcursor");
    document.body.classList.toggle("aiming", !!words);
    banner.className = cursor.className = words ? "show" : "";
    if (words) {
      const W = esc(words.toUpperCase());
      banner.innerHTML = `${W} <small>${how === "anywhere" ? "click where" : "click a target"}${how === "describe" ? " · L: your gear" : ""} · Esc cancels</small>`;
      cursor.textContent = words.toUpperCase();
    }
    this.drawPanel();
  }

  /** Moves the aiming label beside the pointer. */
  pointer(x: number, y: number) {
    const cursor = $("aimcursor");
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  }

  /** Where you are, shown on the loadout screen. */
  where(text: string) {
    if (text === this.place) return;
    this.place = text;
    if (this.open === "loadout") this.drawPanel();
  }

  /** The top-left HUD, redrawn only when what it shows changes. */
  hud(frame: HudFrame) {
    this.frame = frame;
    this.drawHud();
  }

  private drawHud() {
    const f = this.frame, d = this.detail;
    if (!f) return;
    const parts = [`<div class="top"><span class="me">${esc(f.name.toUpperCase())}</span><span class="round"><b>${f.alive}</b> alive · <b>${clock(f.clock)}</b></span></div>`];
    if (this.out !== null) {
      // Knocked out: no bars, no gear; just that, and whom the camera follows.
      parts.push(`<div class="out">KNOCKED OUT</div>${this.out ? `<div class="watch">watching ${esc(this.out.toUpperCase())}</div>` : ""}` +
        `<button class="again">Start new round</button>`);
    } else {
      const max = d?.health.max ?? 100;
      parts.push(bar("Health", (f.hp / 100) * max, max));
      const gear = d?.gear ?? [];
      for (const g of gear) if (g.max && g.slot !== "ride") parts.push(bar("Armor", g.integrity ?? 0, g.max, "armor"));
      for (const g of gear) if (g.max && g.slot === "ride") parts.push(bar("Ride", g.integrity ?? 0, g.max, "ride"));
      const list = (slots: string[]) => gear.filter((g) => slots.includes(g.slot)).map((g) => esc(g.phrase)).join(", ");
      const rides = gear.filter((g) => g.slot === "ride");
      // A mount that lives (a HORSE, an ASS) is one of your animals too, ridden.
      const animals = rides.filter((g) => this.alive(g.phrase)).map((g) => `${esc(g.phrase)} (ridden)`);
      const creatures = [...(d?.creatures.length ? [`${d.creatures.length} of ${d.command.limit}`] : []), ...animals].join(", ");
      const rows: [string, string][] = [
        ["Hands", list(["held"])],
        ["Wears", list(["head", "face", "neck", "body", "back", "hands", "feet", "finger", "graft"])],
        ["Rides", rides.length ? `${list(["ride"])} <small>R: off</small>` : ""],
        ["Creatures", creatures],
      ];
      const shown = rows.filter(([, text]) => text).map(([label, text]) => `<span>${label}</span><b>${text}</b>`).join("");
      if (shown) parts.push(`<div class="gear">${shown}</div>`);
      const chips = [
        ...(d?.statuses ?? []).map((s) => chip(s.status, s.left)),
        ...(["food", "fuel", "power"] as const).filter((k) => (d?.stores[k].have ?? 0) > 0).map((k) =>
          `<span class="chip store">${k.toUpperCase()} ${Math.round(d!.stores[k].have * 10) / 10}</span>`),
        ...(d?.short ?? []).map((t) => chip("hungry").replace("HUNGRY", esc(t.toUpperCase()))),
      ];
      if (chips.length) parts.push(`<div class="chips">${chips.join("")}</div>`);
    }
    const html = parts.join("");
    if (html === this.drawnHud) return;
    this.drawnHud = html;
    $("status").innerHTML = html;
  }

  /** True if a phrase names something alive (a HORSE you ride is an animal, a CAR is not). */
  private alive(phrase: string): boolean {
    try { return parsePhrase(this.dict, phrase).stats.flag("alive"); } catch { return false; }
  }

  /** Knocked out: the HUD says so, and whom the camera now follows (null for nobody yet). */
  knockedOut(watching: string | null) {
    this.out = watching ?? "";
    this.drawHud();
  }

  /** A plain line in place of the HUD, before the game starts or once it cannot. */
  status(text: string) {
    this.frame = null;
    this.drawnHud = "";
    $("status").textContent = text;
  }

  setLetters(held: Letters) {
    this.held = held;
    this.drawLetters();
    this.drawPanel();
  }

  setLoadout(detail: LoadoutDetail) {
    this.detail = detail;
    this.drawPanel();
    this.drawHud();
  }

  /** True while a screen is open, so clicks on it do not walk the player. */
  get screen(): boolean {
    return this.open !== null;
  }

  private show(which: "inventory" | "loadout" | null) {
    this.open = which;
    $("panel").className = which ? "show" : "";
    this.drawPanel();
  }

  private drawPanel() {
    if (!this.open) return;
    $("panel").innerHTML = this.open === "inventory" ? this.inventory() : this.loadout();
  }

  /** Words the player holds the letters for right now, shortest first. */
  private affordable(): { word: string; role: string }[] {
    const out: { word: string; role: string }[] = [];
    for (const [word, def] of this.dict.words) {
      if ((def.role === "noun" || def.role === "verb") && !missing(this.held, word)) out.push({ word, role: def.role });
    }
    return out.sort((a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word));
  }

  private inventory(): string {
    const letters = Object.entries(this.held).filter(([, n]) => n > 0).sort();
    const total = letters.reduce((n, [, c]) => n + c, 0);
    const d = this.detail;
    const words = this.affordable();
    const list = (role: string) =>
      words.filter((w) => w.role === role).slice(0, 80).map((w) => `<button data-word="${w.word}">${w.word}</button>`).join("") ||
      `<span class="hint">Nothing yet</span>`;
    return `
      <h2>INVENTORY</h2><div class="hint">I or Esc to close · click a word to open it in the spell window · U uses the last thing you can eat, drink or take</div>
      <h3>Letters held (${total})</h3>
      <div class="bag">${letters.map(([ch, n]) => `<div class="tile">${ch.toUpperCase()}<small>${n}</small></div>`).join("") || `<span class="hint">None</span>`}</div>
      <div class="cols">
        <div><h3>Carrying (${d?.gear.length ?? 0})</h3>${d?.gear.map((g) => `<div class="row"><span class="what">${g.phrase}</span><span class="slot">${g.slot}</span>${useButton(g)}</div>`).join("") || `<div class="row"><span class="empty">Nothing</span></div>`}
          <h3>Within reach (${d?.nearby.length ?? 0})</h3>${nearby(d)}</div>
        <div><h3>Creatures (${d?.creatures.length ?? 0}${d ? ` of ${d.command.limit}` : ""})</h3>${d?.creatures.map((c) => `<div class="row"><span class="what">${c.name}</span>${mood(c)}<div class="meter"><i style="width:${c.health}%"></i></div></div>`).join("") || `<div class="row"><span class="empty">None</span></div>`}</div>
      </div>
      <h3>Things you can spell now (${words.filter((w) => w.role === "noun").length})</h3><div class="words">${list("noun")}</div>
      <h3>Verbs you can cast now (${words.filter((w) => w.role === "verb").length})</h3><div class="words">${list("verb")}</div>`;
  }

  private loadout(): string {
    const d = this.detail;
    if (!d) return `<h2>LOADOUT</h2><div class="hint">Waiting for the server…</div>`;
    const slots = ["head", "face", "neck", "body", "back", "hands", "feet", "finger", "held", "graft", "ride"];
    const rows = slots.flatMap((slot) => {
      const items = d.gear.filter((g) => g.slot === slot);
      if (!items.length) return [`<div class="row"><span class="slot">${slot}</span><span class="empty">empty</span></div>`];
      return items.map((g) => `<div class="row"><span class="slot">${slot}</span><span class="what">${g.phrase}</span>${
        g.max ? `<div class="meter" title="${g.integrity} of ${g.max}"><i style="width:${(100 * (g.integrity ?? 0)) / g.max}%"></i></div>` : ""
      }${this.aiming ? `<button class="aim" data-aim-gear="${g.index}">${esc(this.aiming.toUpperCase())} here</button>` : ""}${useButton(g)}<button data-drop="${g.index}">Drop</button></div>`);
    });
    const damage = Object.entries(d.attack.damage).map(([type, n]) => `${n} ${type}`).join(", ") || "none";
    const stat = (name: string, value: string) => `<div class="stat"><span>${name}</span><b>${value}</b></div>`;
    return `
      <h2>LOADOUT</h2><div class="hint">L or Esc to close · damage lands on what you ride, then armor and shield, then you${this.aiming ? ` · click "${esc(this.aiming.toUpperCase())} here" to put it on your own gear` : ""}</div>
      <div class="cols">
        <div><h3>Worn, held and ridden</h3>${rows.join("")}
          <h3>Within reach</h3>${nearby(d)}</div>
        <div><h3>You</h3>
          ${this.place ? stat("Where", esc(this.place)) : ""}
          ${stat("Health", `${d.health.now} of ${d.health.max}`)}
          ${stat("Speed", `${d.speed} m/s${d.flying ? " (flying)" : ""}`)}
          ${stat("Sight", `${d.sight} m`)}
          ${stat("Morale", `${d.morale}${d.morale <= 0 ? " (fleeing)" : d.morale < 3 ? " (shaken: aim halved)" : ""}`)}
          ${stat("Command", `${d.command.have} of ${d.command.limit} creatures`)}
          <h3>Stores</h3>
          ${stat("Food", store(d.stores.food))}
          ${stat("Fuel", store(d.stores.fuel))}
          ${stat("Power", store(d.stores.power))}
          ${d.short.map((t) => stat("SHORT", t).replace('class="stat"', 'class="stat status"')).join("")}
          <h3>Attack</h3>
          ${stat("With", d.attack.with.toUpperCase())}
          ${stat("Damage a strike", damage)}
          ${stat("Strikes a second", String(d.attack.rate))}
          ${stat("Reach", `${d.attack.reach} m`)}
          <h3>In force</h3>
          ${[
            ...(d.statuses ?? []).map((s) => stat(s.status.toUpperCase(), `${s.left} s left`).replace('class="stat"', 'class="stat status"')),
            ...d.effects.map((e) => stat(e.word.toUpperCase(), e.left < 0 ? "while you stand in it" : `${e.left} s left`)),
          ].join("") || `<div class="hint">Nothing</div>`}
        </div>
      </div>`;
  }

  /** The paper banner naming the fields over the whole map: HEAVEN, LOVE. */
  overMap(words: string[]) {
    const text = words.map((w) => w.toUpperCase()).join(" · ");
    const el = $("overmap");
    if (el.dataset.text === text) return;
    el.dataset.text = text;
    el.innerHTML = text ? `<small>over the map</small>${text}` : "";
    el.className = text ? "show" : "";
  }

  /** What you can do where you stand, over the letters ("G: dig the cache"), or nothing. */
  prompt(key: string, text: string) {
    const el = $("prompt");
    const html = text ? `<kbd>${esc(key)}</kbd>${esc(text)}` : "";
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  /** A message that stays up: death or victory. */
  banner(text: string) {
    const el = $("banner");
    el.textContent = text;
    el.className = "show";
  }

  toast(text: string, kind: "good" | "bad") {
    const el = $("toast");
    el.textContent = text;
    el.className = `show ${kind}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.className = ""), 2500);
  }

  /**
   * The letters held, at the bottom: a tile for each copy (E E E), or one tile with a count for a
   * letter held more than COPIES_SHOWN times. Copies the current spelling would use are lit.
   */
  private drawLetters() {
    const typed = this.typing ? this.spends(this.input.value) : "";
    const need: Letters = {};
    for (const ch of typed) need[ch] = (need[ch] ?? 0) + 1;
    const tiles: HTMLElement[] = [];
    const tile = (ch: string, cls: string, count?: number) => {
      const el = document.createElement("div");
      el.className = `tile${cls ? ` ${cls}` : ""}`;
      el.innerHTML = `${ch.toUpperCase()}${count !== undefined ? `<small>${count}</small>` : ""}`;
      el.dataset.letter = ch;
      tiles.push(el);
    };
    for (const ch of Object.keys(this.held).filter((c) => this.held[c]! > 0).sort()) {
      const n = this.held[ch]!, used = need[ch] ?? 0;
      if (n > COPIES_SHOWN) tile(ch, used ? "used" : "", n);
      else for (let i = 0; i < n; i++) tile(ch, i < used ? "used" : "");
    }
    $("letters").replaceChildren(...tiles);
    // The alphabet guide lights the letters you hold.
    for (const el of $("abc").children) el.classList.toggle("have", (this.held[(el as HTMLElement).dataset.letter!] ?? 0) > 0);
  }
}

/** A letter held more often than this shows as one tile with a count. */
const COPIES_SHOWN = 4;

/**
 * The alphabet under the spell box: each letter and how to get it now (shared `LETTER_GUIDE`),
 * words that make it in capitals, and a source still to come, small, as "later".
 */
function alphabet(): string {
  return Object.entries(LETTER_GUIDE).map(([ch, g]) =>
    `<div data-letter="${ch}" title="${esc(`${ch.toUpperCase()}: ${g.how}${g.words ? ` (${g.words.join(", ").toUpperCase()})` : ""}${g.later ? `; ${g.later} later` : ""}`)}"><b>${ch.toUpperCase()}</b>${esc(g.how)}` +
    `${g.words ? ` <em>${esc(g.words[0]!.toUpperCase())}</em>` : ""}${g.later ? ` <small>· later</small>` : ""}</div>`).join("");
}
