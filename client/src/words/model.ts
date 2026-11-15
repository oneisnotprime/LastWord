/**
 * The word browser's data side (words.html): an index over every playable word, the filters and
 * sorts the page offers, the query string they live in, and each word's lines in the game's own
 * words (shared `inspectText`, `heldText`, `effectText`, `eventCard`, `countersOf`). No DOM here.
 */
import { countersOf, effectText, eventCard, heldText, inspectText, opText, parsePhrase, type Card, type Dictionary, type Op, type PropertyDef, type Value, type WordDef } from "@lastword/shared";

/** One playable word with what the filters read, worked out once. */
export interface Entry {
  w: string;
  def: WordDef;
  /** Every property it sets or changes. */
  props: Set<string>;
  /** The groups of those properties. */
  groups: Set<string>;
}

/** Frequency and meaning from WordNet (client/public/words/lexicon.json). */
export type Lex = Record<string, [zipf: number, tier: string, gloss: string]>;

/**
 * The gameplay dimensions, as the properties that carry them (the shared modules that read them
 * in brackets). A word is in a dimension when it sets or changes any of them.
 */
export const DIMENSIONS: Record<string, string[]> = {
  nature: ["nature"], // affinity.ts
  luck: ["luck", "rerolls", "gamble"],
  size: ["size", "inflict_shrink", "immune_shrink"], // scale.ts
  control: ["inflict_drunk", "inflict_reverse", "inflict_hypnosis", "inflict_leash", "wobble", "reversed", "immune_drunk", "immune_reverse", "immune_hypnosis", "immune_leash"], // control.ts
  "screen, knowledge, comms": ["restores_panels", "read_properties", "read_inventory", "map_reveal", "detect_letters", "inflict_gag", "inflict_censor", "inflict_illiterate",
    "inflict_amnesia", "immune_gag", "immune_censor", "immune_illiterate", "immune_amnesia", "decoys", "jams"], // screen.ts, knowledge.ts, comms.ts
  "spelling rules": ["ban_letters", "spell_cost", "word_limit", "wild_letters", "double_letters", "misspell_ok", "free_speech"], // speech.ts
  command: ["command_limit", "authority", "loyalty", "mutiny", "mutiny_joins", "recruit_rate"], // mind.ts
  death: ["revives", "last_stand", "haunts", "raises", "entombs", "denies_revival", "prevents_death", "survives_death", "on_owner_death"], // death.ts
  round: ["sudden_death", "storm_pause", "storm_shift"], // round.ts
};

export const MODES = ["contains", "starts", "ends", "exact"] as const;
export type Mode = (typeof MODES)[number];
export const CMPS = ["has", ">", ">=", "<", "<=", "=", "!="] as const;
export type Cmp = (typeof CMPS)[number];

/** Everything the page can be asked for; each field is one query-string key. */
export interface Query {
  q: string;
  mode: Mode;
  /** Also match the WordNet meaning. */
  gloss: boolean;
  role: string;
  cls: string;
  arch: string;
  group: string;
  dim: string;
  prop: string;
  cmp: Cmp;
  val: string;
  /** "word", "length", "freq" or a numeric property id. */
  sort: string;
  desc: boolean;
  /** The word open in the detail panel. */
  w: string;
}

export const EMPTY: Query = { q: "", mode: "contains", gloss: false, role: "", cls: "", arch: "", group: "", dim: "", prop: "", cmp: "has", val: "", sort: "word", desc: false, w: "" };

/** The query in a URL's search string: only fields that differ from EMPTY. */
export function toSearch(q: Query): string {
  const p = new URLSearchParams();
  for (const k of Object.keys(EMPTY) as (keyof Query)[]) {
    const v = q[k];
    if (v === EMPTY[k]) continue;
    p.set(k, typeof v === "boolean" ? (v ? "1" : "0") : v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function fromSearch(search: string): Query {
  const p = new URLSearchParams(search), q: Query = { ...EMPTY };
  const str = (k: keyof Query) => p.get(k) ?? (EMPTY[k] as string);
  Object.assign(q, { q: str("q"), role: str("role"), cls: str("cls"), arch: str("arch"), group: str("group"), dim: str("dim"), prop: str("prop"), val: str("val"), sort: str("sort"), w: str("w") });
  const mode = p.get("mode") as Mode | null, cmp = p.get("cmp") as Cmp | null;
  if (mode && MODES.includes(mode)) q.mode = mode;
  if (cmp && CMPS.includes(cmp)) q.cmp = cmp;
  q.gloss = p.get("gloss") === "1";
  q.desc = p.get("desc") === "1";
  return q;
}

/** Builds the index: one entry per word, in the dictionary's order. */
export function buildIndex(dict: Dictionary): Entry[] {
  const out: Entry[] = [];
  for (const [w, def] of dict.words) {
    const props = new Set<string>([...Object.keys(def.set), ...def.ops.map(([id]) => id)]);
    const groups = new Set<string>();
    for (const id of props) { const g = dict.properties.get(id)?.group; if (g) groups.add(g); }
    out.push({ w, def, props, groups });
  }
  return out;
}

/** A word's number for a property: its own value, else what its changes add (a mul alone has none). */
export function valueOf(def: WordDef, id: string): number | undefined {
  const v = def.set[id];
  if (v !== undefined) return v === "ABS" ? Infinity : typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : undefined;
  let sum: number | undefined;
  for (const [p, op, n] of def.ops) if (p === id && op === "add") sum = (sum ?? 0) + n;
  return sum;
}

/** Whether a word's property passes `cmp val`: numbers compare, tags and text match by name. */
export function passes(def: WordDef, id: string, cmp: Cmp, val: string): boolean {
  if (cmp === "has" || val.trim() === "") return true;
  const raw = def.set[id];
  const want = val.trim().toLowerCase(), n = Number(want);
  if (raw !== undefined && typeof raw !== "number" && raw !== "ABS" && typeof raw !== "boolean") {
    const list = (Array.isArray(raw) ? raw : [raw]).map((x) => x.toLowerCase());
    const hit = list.includes(want);
    return cmp === "=" ? hit : cmp === "!=" ? !hit : false;
  }
  const v = valueOf(def, id);
  if (v === undefined || !Number.isFinite(n) && want !== "abs") return false;
  const x = want === "abs" ? Infinity : n;
  switch (cmp) {
    case ">": return v > x;
    case ">=": return v >= x;
    case "<": return v < x;
    case "<=": return v <= x;
    case "=": return v === x;
    case "!=": return v !== x;
  }
}

/** The words a query matches, sorted. `lex` gives frequency and meaning once loaded. */
export function search(index: Entry[], q: Query, lex: Lex | null = null): Entry[] {
  const text = q.q.trim().toLowerCase();
  const dim = q.dim ? DIMENSIONS[q.dim] ?? [] : null;
  const hit = (w: string) => {
    if (!text) return true;
    switch (q.mode) {
      case "starts": return w.startsWith(text);
      case "ends": return w.endsWith(text);
      case "exact": return w === text;
      default: return w.includes(text);
    }
  };
  const out = index.filter((e) => {
    const d = e.def;
    if (q.role && d.role !== q.role) return false;
    if (q.cls && d.class !== q.cls) return false;
    if (q.arch && d.archetype !== q.arch) return false;
    if (q.group && !e.groups.has(q.group)) return false;
    if (dim && !dim.some((id) => e.props.has(id))) return false;
    if (q.prop && (!e.props.has(q.prop) || !passes(d, q.prop, q.cmp, q.val))) return false;
    if (hit(e.w)) return true;
    return q.gloss && !!text && !!lex?.[e.w]?.[2].toLowerCase().includes(text);
  });
  const sign = q.desc ? -1 : 1;
  const alpha = (a: Entry, b: Entry) => (a.w < b.w ? -1 : a.w > b.w ? 1 : 0);
  // With a search, the word itself comes first, then words starting with it, then the rest.
  const rank = (w: string) => (!text ? 0 : w === text ? 0 : w.startsWith(text) ? 1 : w.includes(text) ? 2 : 3);
  let cmp: (a: Entry, b: Entry) => number;
  if (q.sort === "word") cmp = (a, b) => rank(a.w) - rank(b.w) || sign * alpha(a, b);
  else if (q.sort === "length") cmp = (a, b) => sign * (a.w.length - b.w.length) || alpha(a, b);
  else {
    // Numbers: words without one go last whichever way it runs.
    const num = q.sort === "freq" ? (e: Entry) => lex?.[e.w]?.[0] : (e: Entry) => valueOf(e.def, q.sort);
    const key = new Map(out.map((e) => [e, num(e)]));
    cmp = (a, b) => {
      const x = key.get(a), y = key.get(b);
      if (x === undefined || y === undefined) return x === undefined ? (y === undefined ? alpha(a, b) : 1) : -1;
      return x === y ? alpha(a, b) : sign * (x < y ? -1 : 1);
    };
  }
  return out.sort(cmp);
}

/** Counts by a key over the whole index, most first. */
export function tally(index: Entry[], key: (e: Entry) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const e of index) { const k = key(e); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** A property value as the page prints it. */
export function showValue(v: Value, p?: PropertyDef): string {
  if (v === "ABS") return "total";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.join(", ") || "none";
  if (typeof v === "number") return `${Number.isFinite(v) ? +v.toPrecision(4) : "∞"}${p?.unit ? ` ${p.unit}` : ""}`;
  return v.replaceAll("_", " ");
}

/** A word's card as the game draws it. An adverb alone cannot be spelled, so its card is its own changes. */
export function cardFor(dict: Dictionary, w: string): { card: Card } | { error: string } {
  const def = dict.word(w);
  if (def?.role === "adverb") {
    const does = [...def.ops.map(opText), ...Object.entries(def.set).map(([k, v]) => `${k.replaceAll("_", " ")}: ${showValue(v, dict.properties.get(k))}`)];
    does.push("spell it before a verb: it changes how that verb acts");
    return { card: { title: w.toUpperCase(), kind: ["adverb", def.archetype].filter(Boolean).join(" · "), stats: [], does, letters: w } };
  }
  return inspectText(dict, w);
}

/** What a word's kind is when spelled alone: object, event, field, sky, verb (null when it cannot be). */
export function kindOf(dict: Dictionary, w: string): string | null {
  try { return parsePhrase(dict, w).kind; } catch { return null; }
}

/** The list's line for a word: its lead numbers and one line of what it does, as the HUD says it. */
export interface Summary { lead: string[]; effect: string }

export function summaryOf(dict: Dictionary, w: string): Summary {
  const def = dict.word(w);
  if (!def) return { lead: [], effect: "" };
  const c = cardFor(dict, w);
  if ("error" in c) return { lead: [], effect: c.error };
  const lead = c.card.stats.slice(0, 3);
  if (def.role !== "noun") return { lead, effect: effectText(dict, w) };
  const kind = kindOf(dict, w);
  if (kind === "event" || kind === "field" || kind === "sky") {
    // Its blows first (the event card's), then what it does to whoever it reaches (the HUD's line).
    const hits = eventCard(dict, w).lines.filter((l) => /^damage |^inflicts /.test(l));
    const body = effectText(dict, w);
    const parts = [...hits, ...(/no effect on you$/.test(body) ? [] : body.split(" · "))].slice(0, 3);
    return { lead, effect: parts.join(" · ") || c.card.does.slice(0, 2).join(" · ") };
  }
  // A creature's held line is about its aura; what it does is the first lines of its card.
  if (c.card.kind.startsWith("creature")) return { lead, effect: c.card.does.slice(0, 2).join(" · ") };
  return { lead, effect: heldText(dict, w) };
}

/** What a word ends (the words its `counters` and `clears_weather` name) and what ends it (shared `countersOf`). */
export function countersFor(dict: Dictionary, w: string): { ends: string[]; endedBy: string[] } {
  const def = dict.word(w);
  const list = (v: Value | undefined) => (Array.isArray(v) ? v : []);
  const ends = [...new Set([...list(def?.set.counters), ...list(def?.set.clears_weather)])];
  return { ends, endedBy: countersOf(dict, w) };
}

/** A word's own properties by group, in properties.json order, with each one's meaning. */
export function propertyRows(dict: Dictionary, def: WordDef): [group: string, rows: { id: string; value: Value; prop?: PropertyDef }[]][] {
  const order = [...dict.properties.keys()];
  const groups = new Map<string, { id: string; value: Value; prop?: PropertyDef }[]>();
  const ids = Object.keys(def.set).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const id of ids) {
    const prop = dict.properties.get(id), g = prop?.group ?? "other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ id, value: def.set[id]!, prop });
  }
  return [...groups];
}

/** A word's changes in plain words and raw form. */
export const opRows = (ops: Op[]): { text: string; raw: string }[] =>
  ops.map((o) => ({ text: opText(o), raw: `${o[0]} ${o[1] === "mul" ? "×" : "+"}${o[2]}` }));

/** Numeric properties some word sets, for the sort menu, by group. */
export function numericProps(dict: Dictionary, index: Entry[]): PropertyDef[] {
  const used = new Set<string>();
  for (const e of index) for (const [k, v] of Object.entries(e.def.set)) if (typeof v === "number" || v === "ABS") used.add(k);
  return [...dict.properties.values()].filter((p) => used.has(p.id));
}
