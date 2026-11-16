import type { Move } from "@lastword/shared";

/** A fighter as the server's `battle` message shows it. */
interface FighterSheet {
  id: string; name: string; side: number; gone: string; ready: boolean; weapon: string; load: string; windup: string; speed: number;
  bars: { name: string; hp: number; max: number; body: boolean }[];
  statuses: { status: string; rounds: number }[];
}
/** The battle as one fighter sees it (server `sendBattle`), or its end. */
export interface BattleSheet {
  word?: string; round?: number; cap?: number; phase?: "plan" | "show"; left?: number; you?: string; fighters?: FighterSheet[]; moves?: Move[]; chosen?: string; pot?: number; fatigue?: number;
  over?: { why: string; won: boolean; draw: boolean; rounds: number; text: string };
}
export interface BattleRound { round: number; lines: string[]; events: { kind: string; by?: string; on?: string; who?: string; hit?: boolean }[] }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const KEYS: Record<string, string> = { attack: "1", defend: "2", spell: "3", flee: "4" };
/** Milliseconds the result stays up once a battle ends. */
const RESULT_MS = 2600;

/**
 * The battle panel (docs/TURN_BASED_PLAN.md, prototype): a plain sheet over the map while you
 * are in a battle. Bars for each layer of each fighter, the round and its timer, four moves
 * (keys 1 to 4; 3 or Enter opens the usual spell window, and what you spell is your move), and
 * the log of the round just played. The server decides everything; this only shows and asks.
 */
export class BattleView {
  private readonly root: HTMLElement;
  private sheet: BattleSheet | null = null;
  private log: string[] = [];
  /** When the planning timer ends, by this clock. */
  private until = 0;
  private timer = 0;
  private hide = 0;

  constructor(private readonly act: (move: string) => void, private readonly openSpell: () => void, private readonly typing: () => boolean) {
    this.root = document.createElement("div");
    this.root.id = "battle";
    document.body.append(this.root);
    this.root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-move]");
      if (el && !el.classList.contains("off")) this.choose(el.dataset.move!);
    });
    this.root.addEventListener("mousedown", (e) => e.stopPropagation());
    // While a battle is on, 1 to 4 choose a move; every other game key waits (Enter still opens the spell window).
    window.addEventListener("keydown", (e) => {
      if (!this.active || this.typing()) return;
      if (e.key === "Enter") return; // the spell window: what is spelled there is the move
      e.stopImmediatePropagation();
      const move = Object.entries(KEYS).find(([, k]) => k === e.key)?.[0];
      if (move && !e.repeat) { e.preventDefault(); this.choose(move); }
    }, true);
  }

  /** In a battle now (not just showing how one ended). */
  get active(): boolean {
    return !!this.sheet && !this.sheet.over;
  }

  private choose(move: string) {
    const m = this.sheet?.moves?.find((x) => x.id === move);
    if (!m || !m.legal || this.sheet?.phase !== "plan") return;
    if (move === "spell") this.openSpell();
    else this.act(move);
  }

  /** The server's `battle` message. */
  set(sheet: BattleSheet) {
    window.clearTimeout(this.hide);
    if (sheet.over) {
      if (!this.sheet) return;
      this.sheet = { ...this.sheet, over: sheet.over };
      this.draw();
      this.hide = window.setTimeout(() => { this.sheet = null; this.log = []; this.draw(); }, RESULT_MS);
      return;
    }
    if (!this.sheet || this.sheet.over) this.log = [];
    this.sheet = sheet;
    this.until = performance.now() + (sheet.left ?? 0) * 1000;
    this.draw();
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 200);
  }

  /** The server's `battleEvents` message: the round as it played, in order. */
  played(round: BattleRound) {
    this.log = [...this.log, `<i>round ${round.round}</i>`, ...round.lines.map((l) => esc(l))].slice(-9);
    this.draw();
  }

  private tick() {
    const el = this.root.querySelector<HTMLElement>(".clock");
    if (!this.active) { window.clearInterval(this.timer); return; }
    if (el && this.sheet?.phase === "plan") {
      const s = Math.max(0, Math.ceil((this.until - performance.now()) / 1000));
      el.textContent = `0:${String(s).padStart(2, "0")}`;
      el.classList.toggle("low", s <= 3);
    }
  }

  private draw() {
    const s = this.sheet;
    this.root.classList.toggle("show", !!s);
    document.body.classList.toggle("battling", !!s && !s.over);
    if (!s) { this.root.innerHTML = ""; return; }
    const me = s.fighters?.find((f) => f.id === s.you);
    const order = [...(s.fighters ?? [])].sort((a, b) => (a.id === s.you ? -1 : b.id === s.you ? 1 : a.side - b.side));
    const fighter = (f: FighterSheet) => {
      const bars = f.bars.map((b) => `<div class="bar${b.body ? " body" : ""}"><span>${esc(b.body ? "HP" : b.name.toUpperCase())}</span><div><i style="width:${Math.max(0, Math.min(100, (b.hp / Math.max(1, b.max)) * 100))}%"></i></div><em>${b.hp}/${b.max}</em></div>`).join("");
      const tags = [
        f.weapon, f.load ? `loading ${f.load}` : "", `speed ${f.speed}`,
        ...f.statuses.map((a) => `${a.status} ${a.rounds}`),
      ].filter(Boolean).map((t) => `<b>${esc(t)}</b>`).join("");
      const heavy = f.windup ? `<div class="heavy">! heavy blow on ${esc(f.windup === s.you ? "YOU" : s.fighters?.find((o) => o.id === f.windup)?.name.toUpperCase() ?? "")} next</div>` : "";
      const state = f.gone ? `<u>${f.gone === "fled" ? "ran" : "down"}</u>` : s.phase === "plan" ? `<u class="${f.ready ? "in" : ""}">${f.ready ? "ready" : "choosing"}</u>` : "";
      return `<section class="${f.id === s.you ? "me" : "foe"}${f.gone ? " gone" : ""}"><h3>${esc(f.id === s.you ? "YOU" : f.name.toUpperCase())}${state}</h3>${bars}<div class="tags">${tags}</div>${heavy}</section>`;
    };
    const coming = (s.fighters ?? []).some((f) => f.windup === s.you && !f.gone);
    const moves = (s.moves ?? []).map((m) => {
      const picked = s.chosen === m.id || (m.id === "spell" && !!s.chosen?.startsWith("spell"));
      const hint = m.id === "defend" && coming ? " hint" : "";
      const text = !m.legal && m.why ? m.why : m.id === "spell" && s.chosen?.startsWith("spell ") ? s.chosen.slice(6) : m.text;
      return `<button data-move="${m.id}" class="${m.legal && s.phase === "plan" ? "" : "off"}${picked ? " picked" : ""}${hint}${m.aff ? ` ${m.aff}` : ""}"><kbd>${KEYS[m.id]}</kbd><b>${esc(m.name)}</b><span>${esc(text)}</span></button>`;
    }).join("");
    const status = s.over ? `<div class="result ${s.over.won ? "won" : s.over.draw ? "" : "lost"}">${esc(s.over.text.toUpperCase())}<small>${s.over.rounds} round${s.over.rounds === 1 ? "" : "s"}</small></div>`
      : s.phase === "show" ? `<div class="wait">…</div>`
      : s.chosen ? `<div class="wait">${esc(s.chosen.toUpperCase())} · waiting</div>` : `<div class="wait pick">choose: 1 to 4${me?.windup ? "" : ""}</div>`;
    const tired = (s.fatigue ?? 1) > 1 ? `<b class="tired">fatigue ×${(s.fatigue ?? 1).toFixed(2)}</b>` : "";
    this.root.innerHTML = `<div class="sheet">
      <header><b>${esc(s.word ?? "BATTLE")}</b><span>ROUND ${s.round}/${s.cap}</span>${tired}<span class="clock">${s.phase === "plan" && !s.over ? "" : "–"}</span>${s.pot ? `<span class="pot">pot ${s.pot}</span>` : ""}</header>
      <div class="lines">${order.map(fighter).join('<div class="vs">vs</div>')}</div>
      <div class="log">${this.log.map((l) => `<div>${l}</div>`).join("")}</div>
      <div class="moves">${moves}</div>${status}
    </div>`;
    this.tick();
  }
}
