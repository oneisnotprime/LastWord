import { missing, type Dictionary, type Letters, type LoadoutDetail } from "@lastword/shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** A Use button for something carried that does something when used. */
const useButton = (g: LoadoutDetail["gear"][number]) => (g.usable ? `<button data-use="${g.index}">Use</button>` : "");

/** Things on the ground in reach that you can use, each with a Use button. */
const nearby = (d: LoadoutDetail | null) =>
  d?.nearby.map((t) => `<div class="row"><span class="what">${t.phrase}</span><span class="slot">ground</span><button data-use-thing="${t.id}">Use</button></div>`).join("") ||
  `<div class="row"><span class="empty">Nothing to use</span></div>`;

/** The overlay drawn in HTML on top of the game: status, letters held, spelling box. */
export class Hud {
  private held: Letters = {};
  private readonly input = $<HTMLInputElement>("spell");
  private toastTimer = 0;
  private detail: LoadoutDetail | null = null;
  private open: "inventory" | "loadout" | null = null;

  constructor(
    onSpell: (text: string) => void,
    private readonly dict: Dictionary,
    private readonly onDrop: (index: number) => void,
    /** Use something carried (its index) or on the ground (its thing id). */
    private readonly onUse: (which: number | string) => void,
  ) {
    window.addEventListener("keydown", (e) => {
      if (this.typing || e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === "i") this.show(this.open === "inventory" ? null : "inventory");
      else if (key === "l") this.show(this.open === "loadout" ? null : "loadout");
      else if (key === "escape") this.show(null);
    });
    $("panel").addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest("button");
      if (!el) return;
      if (el.dataset.drop !== undefined) this.onDrop(Number(el.dataset.drop));
      if (el.dataset.use !== undefined) this.onUse(Number(el.dataset.use));
      if (el.dataset.useThing !== undefined) this.onUse(el.dataset.useThing);
      if (el.dataset.word) { this.show(null); this.input.value = el.dataset.word; this.input.focus(); this.drawLetters(); }
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement !== this.input) {
        this.input.focus();
        e.preventDefault();
      }
    });
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // typing must not walk the player
      if (e.key === "Enter" && this.input.value.trim()) {
        onSpell(this.input.value);
        this.input.value = "";
        this.drawLetters();
      } else if (e.key === "Escape" || e.key === "Enter") {
        this.input.blur();
      }
    });
    this.input.addEventListener("input", () => this.drawLetters());
  }

  /** True while the player is typing a spelling. */
  get typing(): boolean {
    return document.activeElement === this.input;
  }

  status(text: string) {
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
      <h2>INVENTORY</h2><div class="hint">I or Esc to close · click a word to put it in the spelling box · U uses the last thing you can eat, drink or take</div>
      <h3>Letters held (${total})</h3>
      <div class="bag">${letters.map(([ch, n]) => `<div class="tile">${ch.toUpperCase()}<small>${n}</small></div>`).join("") || `<span class="hint">None</span>`}</div>
      <div class="cols">
        <div><h3>Carrying (${d?.gear.length ?? 0})</h3>${d?.gear.map((g) => `<div class="row"><span class="what">${g.phrase}</span><span class="slot">${g.slot}</span>${useButton(g)}</div>`).join("") || `<div class="row"><span class="empty">Nothing</span></div>`}
          <h3>Within reach (${d?.nearby.length ?? 0})</h3>${nearby(d)}</div>
        <div><h3>Creatures (${d?.creatures.length ?? 0})</h3>${d?.creatures.map((c) => `<div class="row"><span class="what">${c.name}</span><div class="meter"><i style="width:${c.health}%"></i></div></div>`).join("") || `<div class="row"><span class="empty">None</span></div>`}</div>
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
      }${useButton(g)}<button data-drop="${g.index}">Drop</button></div>`);
    });
    const damage = Object.entries(d.attack.damage).map(([type, n]) => `${n} ${type}`).join(", ") || "none";
    const stat = (name: string, value: string) => `<div class="stat"><span>${name}</span><b>${value}</b></div>`;
    return `
      <h2>LOADOUT</h2><div class="hint">L or Esc to close · damage lands on what you ride, then armor and shield, then you</div>
      <div class="cols">
        <div><h3>Worn, held and ridden</h3>${rows.join("")}
          <h3>Within reach</h3>${nearby(d)}</div>
        <div><h3>You</h3>
          ${stat("Health", `${d.health.now} of ${d.health.max}`)}
          ${stat("Speed", `${d.speed} m/s${d.flying ? " (flying)" : ""}`)}
          ${stat("Sight", `${d.sight} m`)}
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

  /** Tints the whole view for the time of day and the weather. */
  sky(daylight: string, weather: string) {
    const tint: Record<string, string> = {
      rain: "rgba(60, 80, 110, 0.25)", storm: "rgba(20, 25, 45, 0.45)", fog: "rgba(225, 228, 232, 0.6)",
      snow: "rgba(240, 245, 250, 0.3)",
    };
    $("sky").style.backgroundColor = tint[weather] ?? (daylight === "night" ? "rgba(8, 12, 40, 0.55)" : "transparent");
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

  /** One tile per letter held; tiles the current spelling would use are lit, shortfalls in red. */
  private drawLetters() {
    const typed = this.input.value.toLowerCase().replace(/[^a-z]/g, "");
    const need: Letters = {};
    for (const ch of typed) need[ch] = (need[ch] ?? 0) + 1;
    const short = new Set(missing(this.held, typed));
    const letters = new Set([...Object.keys(this.held).filter((ch) => this.held[ch]! > 0), ...short]);
    $("letters").replaceChildren(
      ...[...letters].sort().map((ch) => {
        const tile = document.createElement("div");
        tile.className = `tile${short.has(ch) ? " short" : need[ch] ? " used" : ""}`;
        tile.innerHTML = `${ch.toUpperCase()}<small>${this.held[ch] ?? 0}</small>`;
        return tile;
      }),
    );
  }
}
