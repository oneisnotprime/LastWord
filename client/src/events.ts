/**
 * Event chips: what is in force where you stand (weather, night, WAR, a DROUGHT, a FESTIVAL...),
 * as small paper chips at the top middle of the screen with an icon, a short name and the time
 * left. Clicking one opens a short card: what it is, who brought it, what it changes in plain
 * numbers (shared `eventCard`) and the words that end it.
 */
import { eventCard, type Dictionary } from "@lastword/shared";
import { zoneStyle } from "./zones.js";

/** One thing in force: its word, when it ends on the round clock (0: lasts), and who brought it. */
export interface InForce { word: string; until: number; by: string; kind: "weather" | "night" | "zone" }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const left = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`);

/** A plain glyph for a word: by the word, then its archetype. Text symbols, not emoji, so every font has them. */
const BY_WORD: Record<string, string> = {
  war: "⚔", battle: "⚔", warfare: "⚔", skirmish: "⚔", crusade: "✠", siege: "♜", blockade: "♜", night: "☾", eclipse: "◐", blackout: "◼",
  rain: "☂", monsoon: "☂", drizzle: "☂", torrent: "☂", storm: "ϟ", thunderstorm: "ϟ", hurricane: "@", typhoon: "@", cyclone: "@", tornado: "@",
  snow: "❄", blizzard: "❄", winter: "❄", fog: "≋", sandstorm: "≋", drought: "☼", heat: "☼", summer: "☼", sun: "☼", famine: "ϕ",
  plague: "☠", epidemic: "☠", pandemic: "☠", pox: "☠", disease: "☠", blight: "✶", pestilence: "☠", festival: "♫", carnival: "♫",
  holiday: "♫", parade: "♫", fiesta: "♫", gala: "♫", truce: "☮", peace: "☮", armistice: "☮", sanctuary: "☮", curfew: "⌛", lockdown: "⌛",
  harvest: "✿", plenty: "✿", spring: "✿", autumn: "✿", tax: "$", tithe: "$", toll: "$", tariff: "$", inflation: "$", recession: "$",
  bonanza: "◆", lode: "◆", jackpot: "◆", meteor: "✸", asteroid: "✸", comet: "✸", earthquake: "≈", quake: "≈", riot: "✊", rebellion: "✊",
};
const BY_ARCHETYPE: Record<string, string> = {
  weather: "☁", season: "✿", conflict: "⚔", attack: "⚔", disaster: "!", affliction: "☠", feeling: "♥", attribute: "✦", ceremony: "♫",
  possession: "$", phenomenon: "✦", act: "✦", event: "✦",
};

export class Events {
  private readonly bar: HTMLElement;
  private readonly card: HTMLElement;
  private shown = "";
  private open: InForce | null = null;
  private now = 0;
  private list: InForce[] = [];

  constructor(private readonly dict: Dictionary) {
    this.bar = document.getElementById("events")!;
    this.card = document.getElementById("eventcard")!;
    this.bar.addEventListener("click", (e) => {
      const word = (e.target as HTMLElement).closest<HTMLElement>("[data-word]")?.dataset.word;
      const hit = this.list.find((f) => f.word === word) ?? null;
      this.open = hit && this.open?.word !== hit.word ? hit : null;
      this.drawCard();
    });
    this.card.addEventListener("click", () => { this.open = null; this.drawCard(); });
  }

  /** What is in force at a point: the weather, night, and every zone covering it (not claimed ground). */
  static at(state: any, x: number, y: number): InForce[] {
    const out = new Map<string, InForce>();
    const add = (f: InForce) => { const o = out.get(f.word); if (!o || (f.until && f.until > o.until)) out.set(f.word, f); };
    if (state.daylight === "night") add({ word: state.daylightWord || "night", until: state.daylightUntil ?? 0, by: state.daylightBy ?? "", kind: "night" });
    if (state.weather) add({ word: state.weatherWord || state.weather, until: state.weatherUntil ?? 0, by: state.weatherBy ?? "", kind: "weather" });
    state.zones?.forEach((z: any) => {
      if (z.owner) return; // claimed ground has its own fence
      if (z.radius > 0 && Math.hypot(z.x - x, z.y - y) > z.radius) return;
      add({ word: z.word, until: z.until ?? 0, by: z.by ?? "", kind: "zone" });
    });
    return [...out.values()];
  }

  /** Redraws the chips if what is in force, or the time left, changed. `clock` is the round clock in seconds. */
  update(list: InForce[], clock: number) {
    this.now = clock;
    this.list = list;
    const key = list.map((f) => `${f.word}:${f.until ? Math.max(0, f.until - clock) : ""}`).join("|");
    if (key === this.shown) return;
    this.shown = key;
    this.bar.innerHTML = list.map((f) => {
      const def = this.dict.word(f.word);
      const style = zoneStyle(this.dict, f.word);
      const glyph = BY_WORD[f.word] ?? (def && BY_ARCHETYPE[def.archetype]) ?? "✦";
      const t = f.until ? `<small>${left(Math.max(0, f.until - clock))}</small>` : "";
      return `<button class="ev" data-word="${esc(f.word)}" style="--c:${style.colour};--k:${style.ink}"><i>${glyph}</i>${esc(f.word.toUpperCase())}${t}</button>`;
    }).join("");
    if (this.open && !list.some((f) => f.word === this.open!.word)) this.open = null;
    this.drawCard();
  }

  private drawCard() {
    const f = this.open ? this.list.find((x) => x.word === this.open!.word) ?? this.open : null;
    if (!f) { this.card.className = ""; this.card.innerHTML = ""; return; }
    const card = eventCard(this.dict, f.word);
    const meta = [card.kind || f.kind, f.by ? `by ${f.by}` : "", f.until ? `${left(Math.max(0, f.until - this.now))} left` : ""].filter(Boolean).join(" · ");
    const lines = card.lines.length ? card.lines : ["changes nothing yet"];
    const ends = card.counters.slice(0, 8).map((w) => w.toUpperCase()).join(", ");
    this.card.innerHTML = `<div class="title">${esc(card.title)}</div><div class="kind">${esc(meta)}</div>` +
      `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` +
      (ends ? `<div class="ends"><b>Ends it:</b> ${esc(ends)}</div>` : "");
    this.card.className = "show";
  }
}
