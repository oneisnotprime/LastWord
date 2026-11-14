import type { Dictionary } from "./dictionary.js";
import { production } from "./letters.js";
import { parsePhrase, type Phrase } from "./phrase.js";
import type { Stats } from "./stats.js";
import type { Op, Value } from "./types.js";
import { improvisable } from "./unit.js";
import { needs, outputs, STARTING_SUPPLY_MINUTES, SUPPLIES } from "./upkeep.js";
import { useObject } from "./verb.js";
import { TILE_TYPES } from "./world.js";

/**
 * How a spelled object enters the world (the server's `make` follows this):
 * - `creature`: able to move, not something you ride, and alive, sentient or self-propelled (a
 *   WOLF, a GHOST, a ZOMBIE, a ROBOT): a walker of its own that follows its master and fights for them;
 * - `terrain`: it has a `tile_type` and reshapes the land;
 * - `worn`: it has an `equip_slot` or is `mountable`, so it goes onto the speller if there is room;
 * - `ground`: anything else lies where it was spelled (pick it up with E if it is light enough).
 */
export type Becomes = "creature" | "terrain" | "worn" | "ground";

export function becomes(stats: Stats): Becomes {
  const moves = Math.max(stats.num("speed_land"), stats.num("speed_air")) > 0;
  const acts = stats.flag("alive") || stats.flag("sentient") || stats.flag("self_propelled");
  if (moves && acts && !stats.flag("mountable")) return "creature";
  if (TILE_TYPES[String(stats.get("tile_type"))] !== undefined) return "terrain";
  if (stats.flag("mountable") || stats.get("equip_slot") !== "none") return "worn";
  return "ground";
}

/**
 * What a spelling must be pointed at once it is cast: `someone` (a creature, person or thing:
 * THEFT, MURDER, RESCUE, REPAIR), `anywhere` (a spot or someone: FIRE, a targeted field), or
 * null for spellings that act on the speller or around them. Follows the server's `happen`,
 * `field` and `cast`.
 */
export function aimOf(p: Phrase): "someone" | "anywhere" | null {
  const s = p.stats;
  if (p.kind === "verb") {
    const eventful = s.flag("destroys_target") || s.flag("transfers_ownership") || s.num("moves_target") > 0;
    return s.get("effect_target") === "touched" && eventful ? "someone" : null;
  }
  if (p.kind === "field") return s.get("placement") === "target" ? "anywhere" : null;
  if (p.kind !== "event") return null;
  if (s.flag("transfers_ownership") || s.flag("destroys_target") || s.num("letter_steal") > 0 || s.num("moves_target") > 0 ||
    s.num("restores") > 0 || s.num("produce_T") > 0 || (s.num("inflict_stun") > 0 && s.get("event_target") === "character")) return "someone";
  if (s.flag("frees_target")) return null;
  const regional = s.get("placement") === "region" || s.get("placement") === "map";
  return regional ? null : "anywhere";
}

/** A card telling what something is: shown as you spell it, and when you right-click it in the world. */
export interface Card {
  /** WORST WOLF ×3. */
  title: string;
  /** What kind of word it is: "creature · animal", "event", "adjectives". */
  kind: string;
  /** Key numbers in plain words: "integrity 200", "damage 50 (30 psychic, 20 cold)". */
  stats: string[];
  /** What it does: "follows you and fights for you", "worn: body", "draws 0.1 fuel a minute". */
  does: string[];
  /** Every letter it costs, lower case ("" for something already in the world). */
  letters: string;
}

const num = (n: number) => (!Number.isFinite(n) ? "total" : Math.abs(n) >= 100 ? Math.round(n).toLocaleString("en-US") : String(+n.toPrecision(2)));
const words = (s: string) => s.replaceAll("_", " ");
/** Plain names for properties whose ids do not read well. */
const NAMES: Record<string, string> = {
  speed_land: "speed", speed_air: "flying speed", speed_water: "swimming speed", sight_range: "sight", attack_rate: "attack rate",
  attack_range: "reach", field_radius: "field reach", food_need: "food need", fear_aura: "fear aura",
};
const plain = (id: string) =>
  NAMES[id] ?? words(id.replace(/^dmg_(.*)$/, "$1 damage").replace(/^res_(.*)$/, "$1 resistance").replace(/^inflict_(.*)$/, "inflicts $1").replace(/^immune_(.*)$/, "immune to $1"));

/** One change a word makes, in plain words: "integrity ×0.2", "speed +3", "now flying". */
export function opText([id, op, amount]: Op): string {
  return op === "mul" ? `${plain(id)} ×${num(amount)}` : `${plain(id)} ${amount >= 0 ? "+" : "−"}${num(Math.abs(amount))}`;
}
function setText(id: string, v: Value): string | null {
  if (v === true) return `${plain(id)}`;
  if (v === false) return `not ${plain(id)}`;
  if (v === "ABS") return `${plain(id)} total`;
  if (typeof v === "number") return `${plain(id)} ${num(v)}`;
  if (Array.isArray(v)) return v.length ? `${plain(id)}: ${words(v.join(", "))}` : null;
  return v && v !== "none" ? `${plain(id)}: ${words(v)}` : null;
}

/** Damage a strike: the total, then each type, biggest first. */
function damage(s: Stats): string | null {
  const parts: [string, number][] = [];
  for (const [id] of s.entries()) if (id.startsWith("dmg_")) { const n = s.num(id); if (n > 0) parts.push([id.slice(4), n]); }
  if (!parts.length) return null;
  parts.sort((a, b) => b[1] - a[1]);
  const total = parts.reduce((t, [, n]) => t + n, 0);
  return parts.length === 1 ? `damage ${num(total)} ${parts[0]![0]}` : `damage ${num(total)} (${parts.map(([t, n]) => `${num(n)} ${t}`).join(", ")})`;
}

/** The numbers worth knowing about a body or a thing, in plain words. */
export function keyStats(s: Stats): string[] {
  const out: string[] = [];
  const add = (id: string, unit = "") => {
    const n = s.num(id);
    if (n > 0) out.push(`${plain(id)} ${num(n)}${unit && Number.isFinite(n) ? ` ${unit}` : ""}`);
  };
  add("integrity");
  const hit = damage(s);
  if (hit) {
    out.push(hit);
    add("attack_rate", "a second");
    if (s.num("attack_range") > 1) add("attack_range", "m");
  }
  add("armor");
  if (s.num("evasion") > 0) out.push(`evasion ${Math.round(s.num("evasion") * 100)}%`);
  add("mass", "kg");
  add("speed_land", "m/s");
  add("speed_air", "m/s");
  add("speed_water", "m/s");
  if (s.num("sight_range") !== 10) add("sight_range", "m");
  for (const [id] of s.entries()) if (id.startsWith("res_") && s.num(id) > 0) out.push(`${plain(id)} ${Math.round(s.num(id) * 100)}%`);
  for (const [id] of s.entries()) if (id.startsWith("inflict_") && s.num(id) > 0) out.push(`${plain(id)} ${num(s.num(id))} s`);
  return out;
}

/** What a body or thing does in the world, from its properties: follows you, worn, radiates, needs fuel. */
export function behaviours(s: Stats, count = 1): string[] {
  const out: string[] = [];
  switch (becomes(s)) {
    case "creature":
      out.push("walks with you and defends you");
      out.push(s.flag("sentient") ? "attacks what you attack" : "takes no orders (not sentient)");
      if (!s.flag("alive")) out.push("not alive: needs no food");
      break;
    case "terrain":
      out.push(`reshapes the land into ${words(String(s.get("tile_type")))}${s.num("radius") > 0 ? `, radius ${num(s.num("radius"))} tile${s.num("radius") === 1 ? "" : "s"}` : ""}`);
      break;
    case "worn":
      if (s.flag("mountable")) out.push("you ride it: it moves and takes hits for you");
      else out.push(`equip slot: ${words(String(s.get("equip_slot")))}`);
      break;
    case "ground":
      out.push(Math.max(s.num("speed_land"), s.num("speed_air")) > 0 && !s.flag("alive")
        ? "stays where it is made (not alive, sentient or self-propelled, so it does not follow you)"
        : "lies where it is made");
      if (improvisable(s) && s.flag("portable")) out.push("pick it up (E) to swing it");
      break;
  }
  if (s.num("aggression") > 0) out.push(`aggression ${num(s.num("aggression"))}: attacks on its own when wild`);
  if (s.num("field_radius") > 0) {
    const what = String(s.get("field_property"));
    const effect = what && s.num("field_delta") ? `${plain(what)} ${s.num("field_delta") > 0 ? "+" : "−"}${num(Math.abs(s.num("field_delta")))}` : "";
    out.push(`radiates a field${effect ? ` (${effect})` : ""} ${Number.isFinite(s.num("field_radius")) ? `${num(s.num("field_radius"))} m around it` : "over the whole map"}`);
  }
  if (s.num("luminosity") > 0) out.push("gives off light");
  if (s.num("fear_aura") > 0) out.push(`frightens enemies (fear ${num(s.num("fear_aura"))})`);
  if (s.num("heals") > 0) out.push(`heals allies ${num(s.num("heals"))} a second`);
  const need = needs(s, count), make = outputs(s, count);
  for (const k of SUPPLIES) {
    if (need[k] > 0) out.push(`draws ${num(need[k])} ${k} a minute${s.flag("alive") ? "" : ` (comes with ${STARTING_SUPPLY_MINUTES} min)`}`);
  }
  for (const k of SUPPLIES) if (make[k] > 0) out.push(`makes ${num(make[k])} ${k} a minute`);
  const letters = Object.entries(production(s));
  if (letters.length) out.push(`makes letters: ${letters.map(([ch, n]) => `${ch.toUpperCase()} ${num(n * count)}`).join(", ")} a minute`);
  if (s.flag("phase")) out.push("passes through walls");
  if (s.flag("hover") || s.num("speed_air") > 0) out.push("flies");
  if (s.flag("edible") || s.num("nutrition") > 0) out.push(`edible (${num(s.num("nutrition"))} food)`);
  return out;
}

/** What using a carried object (U) does, if anything. */
function useText(dict: Dictionary, noun: string, adjectives: readonly string[]): string | null {
  const use = useObject(dict, noun, adjectives);
  if (!use) return null;
  const s = use.stats, parts: string[] = [];
  if (s.num("restores") > 0) parts.push(`restores ${num(s.num("restores"))} health`);
  if (s.tags("effect_status").length) parts.push(`cures ${s.tags("effect_status").join(", ")}`);
  if (s.num("nutrition") > 0) parts.push(`${num(s.num("nutrition"))} food`);
  const lasting = [...use.ops.map(opText), ...Object.entries(use.set).map(([k, v]) => setText(k, v)).filter((x): x is string => !!x)];
  if (lasting.length && s.num("duration") > 0) parts.push(`${lasting.slice(0, 3).join(", ")} for ${num(s.num("duration"))} s`);
  return `usable (U): ${parts.join("; ")}`;
}

/** The kind line: role, class and archetype. */
const kindOf = (dict: Dictionary, noun: string, label = "") => {
  const def = dict.word(noun);
  return [label, def?.class ?? "", def?.archetype ?? ""].filter((x, i, a) => x && a.indexOf(x) === i).map(words).join(" · ");
};

/** A card for a phrase already parsed. */
export function cardOf(dict: Dictionary, p: Phrase): Card {
  const s = p.stats;
  const title = [...(p.kind === "verb" ? p.adverbs : p.adjectives), p.noun].join(" ").toUpperCase() + (p.count > 1 ? ` ×${p.count}` : "");
  const card: Card = { title, kind: "", stats: [], does: [], letters: p.letters };
  const aim = aimOf(p);
  const aimed = aim === "someone" ? "cast it, then click whom or what it acts on" : aim === "anywhere" ? "cast it, then click where it lands (or on someone)" : null;
  if (p.kind === "verb") {
    card.kind = kindOf(dict, p.noun, "verb");
    if (s.num("restores") > 0) card.stats.push(`restores ${num(s.num("restores"))} health`);
    if (s.num("duration") > 0) card.stats.push(`lasts ${num(s.num("duration"))} s`);
    const e = p.effect ?? { set: {}, ops: [] };
    card.does.push(...e.ops.map(opText), ...Object.entries(e.set).map(([k, v]) => setText(k, v)).filter((x): x is string => !!x));
    if (s.tags("effect_status").length) card.does.push(`cures ${s.tags("effect_status").join(", ")}`);
    card.does.push(aimed ?? "acts on you");
    return card;
  }
  if (p.kind === "event") {
    card.kind = kindOf(dict, p.noun, "event");
    const hit = damage(s);
    if (hit) card.stats.push(hit);
    if (s.num("event_radius") > 0) card.stats.push(`radius ${num(s.num("event_radius"))} m`);
    if (s.num("event_duration") > 0) card.stats.push(`lasts ${num(s.num("event_duration"))} min`);
    if (s.flag("destroys_target")) card.does.push("destroys its target outright");
    if (s.flag("transfers_ownership")) card.does.push("makes its target yours");
    if (s.num("letter_steal") > 0) card.does.push(`steals ${num(s.num("letter_steal"))} letters from a thing's owner`);
    if (s.num("moves_target") > 0) card.does.push("brings its target to you");
    if (s.num("restores") > 0) card.does.push("repairs a thing");
    if (s.flag("frees_target")) card.does.push("frees everything around you from its owners");
    if (s.flag("sets_hostile")) card.does.push("everyone in it fights everyone");
    for (const [id] of s.entries()) if (id.startsWith("inflict_") && s.num(id) > 0) card.does.push(`${plain(id)} ${num(s.num(id))} s`);
    if (s.get("contest_with") && s.get("contested_by")) card.does.push(`your ${words(String(s.get("contest_with")))} against their ${words(String(s.get("contested_by")))}`);
    card.does.push(aimed ?? "lands around you");
    return card;
  }
  if (p.kind === "sky" || p.kind === "field") {
    card.kind = kindOf(dict, p.noun, p.kind);
    if (s.get("sets_daylight") !== "none") card.does.push(`makes it ${s.get("sets_daylight")}`);
    if (s.get("sets_weather")) card.does.push(`brings ${s.get("sets_weather")}`);
    if (s.tags("clears_weather").length) card.does.push(`clears ${s.tags("clears_weather").join(", ")}`);
    card.does.push(...behaviours(s).filter((b) => !b.startsWith("lies where") && !b.startsWith("pick it up")));
    if (aimed) card.does.push(aimed);
    return card;
  }
  card.kind = kindOf(dict, p.noun);
  card.stats = becomes(s) === "terrain" ? [] : keyStats(s);
  card.does = behaviours(s, p.count);
  const use = useText(dict, p.noun, p.adjectives);
  if (use) card.does.push(use);
  return card;
}

/** Adjectives spelled alone: what each one changes, to be put on something with a click. */
export function adjectiveCard(dict: Dictionary, adjectives: readonly string[]): Card {
  const does: string[] = [];
  for (const a of adjectives) {
    const def = dict.lookup(a)?.def;
    if (!def) continue;
    const lines = [...def.ops.map(opText), ...Object.entries(def.set).map(([k, v]) => setText(k, v)).filter((x): x is string => !!x)];
    if (lines.length) does.push(`${a.toUpperCase()}: ${lines.slice(0, 4).join(", ")}`);
  }
  does.push("cast it, then click a thing, a creature, a person or yourself");
  return { title: adjectives.join(" ").toUpperCase(), kind: "adjectives", stats: [], does, letters: adjectives.join("") };
}

/**
 * A card for what a player typed, or the reason it cannot be spelled (`error`). Adjectives alone
 * read as a description to aim; anything else as `parsePhrase` reads it.
 */
export function inspectText(dict: Dictionary, text: string): { card: Card } | { error: string } {
  const all = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (all.length && all.every((w) => /^[a-z]+$/.test(w) && dict.lookup(w)?.def.role === "adjective")) return { card: adjectiveCard(dict, all) };
  try {
    return { card: cardOf(dict, parsePhrase(dict, text)) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
