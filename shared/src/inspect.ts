import type { Dictionary } from "./dictionary.js";
import { GROW_PACE, needsText, producerOf, SEEDLING } from "./produce.js";
import { parsePhrase, type Phrase } from "./phrase.js";
import type { Stats } from "./stats.js";
import type { Op, Value } from "./types.js";
import { improvisable } from "./unit.js";
import { claimOf, senseOf } from "./sense.js";
import { needs, outputs, STARTING_SUPPLY_MINUTES, SUPPLIES } from "./upkeep.js";
import { useObject } from "./verb.js";
import { placeRules, rulesText } from "./place.js";
import { resolve } from "./stats.js";
import { pluralize } from "./plural.js";
import { effectSeconds, statusSeconds, type Status } from "./status.js";
import { toolHelp } from "./biome.js";
import { TILE_TYPES } from "./world.js";
import { materialText } from "./material.js";
import { foodText } from "./food.js";
import { jobText } from "./work.js";
import { breachText, pactOf } from "./law.js";

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
  if (pactOf(s) || s.flag("transfers_ownership") || s.flag("destroys_target") || s.num("letter_steal") > 0 || s.num("moves_target") > 0 ||
    s.num("restores") > 0 || s.num("produce_T") > 0 || (s.num("inflict_stun") > 0 && s.get("event_target") === "character")) return "someone";
  // Passed on a person (ARREST, EXILE, PARDON): its statuses or cures land on whoever is clicked.
  if (s.get("event_target") === "character" && !(s.num("event_radius") > 0) && (inflictsAny(s) || s.tags("effect_status").length)) return "someone";
  if (s.flag("frees_target")) return null;
  const regional = s.get("placement") === "region" || s.get("placement") === "map" || s.get("placement") === "self";
  return regional ? null : "anywhere";
}

const inflictsAny = (s: Stats) => s.entries().some(([id, v]) => id.startsWith("inflict_") && typeof v === "number" && v > 0);

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
  for (const [id] of s.entries()) if (id.startsWith("inflict_") && s.num(id) > 0) out.push(`${plain(id)} ${num(statusSeconds(id.slice(8) as Status, s.num(id)))} s`);
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
      out.push(...jobText(s));
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
  const claim = claimOf(s);
  if (claim) out.push(`claims ${num(claim.radius)} tiles around it: your things there take ${Math.round(claim.shelter * 100)}% less damage and are harder to steal`);
  if (s.num("luminosity") > 0) out.push("gives off light");
  if (s.num("fear_aura") > 0) out.push(`frightens enemies (fear ${num(s.num("fear_aura"))})`);
  if (s.num("heals") > 0) out.push(`heals allies ${num(s.num("heals"))} a second`);
  const need = needs(s, count), make = outputs(s, count);
  for (const k of SUPPLIES) {
    if (need[k] > 0) out.push(`draws ${num(need[k])} ${k} a minute${s.flag("alive") ? "" : ` (comes with ${STARTING_SUPPLY_MINUTES} min)`}`);
  }
  for (const k of SUPPLIES) if (make[k] > 0) out.push(`makes ${num(make[k])} ${k} a minute`);
  const spec = producerOf(s, count);
  const letters = Object.entries(spec.rates);
  if (letters.length) {
    const needs = needsText(spec);
    out.push(`makes ${letters.map(([ch, n]) => `${ch.toUpperCase()} +${num(n)}/min`).join(", ")} while yours${needs ? `, ${needs}` : ""}`);
  }
  if (spec.age > 0) out.push(`ages into Y faster than most (+${num(spec.age)})`);
  if (spec.grows > 0) out.push(`planted where it is made: grows to full yield in ${num(spec.grows * GROW_PACE * (1 - SEEDLING))} min, faster in rain and rich soil`);
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
  if (lasting.length && s.num("duration") > 0) parts.push(`${lasting.slice(0, 3).join(", ")} for ${num(effectSeconds(s.num("duration")))} s`);
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
    if (s.num("duration") > 0) card.stats.push(`lasts ${num(effectSeconds(s.num("duration")))} s`);
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
    const pact = pactOf(s);
    if (pact) card.does.push(`binds you and ${pact.size - 1} other${pact.size === 2 ? "" : "s"} you pick to one side for ${num(pact.minutes)} min; whoever breaks it pays ${breachText(pact.penalty)}`);
    if (s.flag("sets_hostile")) card.does.push("creatures in it attack everyone not on your side");
    card.does.push(...placeLines(dict, p.noun, s));
    for (const [id] of s.entries()) if (id.startsWith("inflict_") && s.num(id) > 0) card.does.push(`${plain(id)} ${num(statusSeconds(id.slice(8) as Status, s.num(id)))} s`);
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
    card.does.push(...placeLines(dict, p.noun, s));
    if (aimed) card.does.push(aimed);
    return card;
  }
  card.kind = kindOf(dict, p.noun);
  const sense = senseOf(dict, p.noun, s);
  if (sense) {
    const reach = (n: number) => (Number.isFinite(n) ? `${num(n)} tiles` : "the whole map");
    card.does = [`goes on your screen as a minimap, not on the ground`, ...[
      sense.reveal ? `shows the land within ${reach(sense.reveal)}` : "",
      sense.letters ? `shows letter sources within ${reach(sense.letters)}` : "",
      sense.life ? `shows living things within ${reach(sense.life)}` : "",
    ].filter(Boolean)];
    return card;
  }
  card.stats = becomes(s) === "terrain" ? [] : keyStats(s);
  card.does = behaviours(s, p.count);
  const use = useText(dict, p.noun, p.adjectives);
  if (use) card.does.push(use);
  card.does.push(...foodText(dict, s), ...materialText(dict, s));
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

/** What a word's area does to letters, acts and the land, in short lines (shared `placeRules`), plus what it summons or lays. */
export function placeLines(dict: Dictionary, word: string, s: Stats): string[] {
  const def = dict.word(word);
  const out = def ? rulesText(placeRules(def, s) ?? { yields: {}, growth: 1, deposits: 1, tax: 0, lode: [], lodeShare: 0, lodeStock: 0, tradeRate: 1, law: [], fine: 0 }) : [];
  const summons = String(s.get("summons"));
  if (summons && s.num("summon_count") > 0) {
    const n = s.num("summon_count");
    out.push(`brings ${num(n)} ${(n > 1 ? pluralize(summons) : summons).toUpperCase()}${s.flag("summon_owned") ? " to fight for its maker" : " (wild)"}`);
  }
  const tile = String(s.get("tile_type"));
  if (def?.class === "event" && tile !== "none" && s.num("radius") > 0) out.push(`turns ${num(s.num("radius"))} tiles to ${words(tile)}`);
  return out;
}

/** Words that end a word's area or weather: those whose `counters` name it, or that clear it as weather. */
export function countersOf(dict: Dictionary, word: string): string[] {
  const out: string[] = [];
  const weather = String(dict.word(word)?.set.sets_weather ?? word);
  // Night and day undo each other: a word that brings day ends one that brought night.
  const light = word === "night" ? "night" : String(dict.word(word)?.set.sets_daylight ?? "none");
  const undo = light === "night" ? "day" : light === "day" ? "night" : "";
  for (const [w, def] of dict.words) {
    const c = def.set.counters, clears = def.set.clears_weather;
    if ((undo && def.set.sets_daylight === undo && def.role === "noun") || (Array.isArray(c) && c.includes(word)) || (Array.isArray(clears) && (clears.includes(word) || clears.includes(weather)))) out.push(w);
  }
  return out.sort((a, b) => a.length - b.length || a.localeCompare(b));
}

/**
 * A short explanation of something in force over a place (an event, a field, weather, night),
 * for the event chips: what it changes to bodies, letters and acts in plain numbers, and the
 * words that end it.
 */
export function eventCard(dict: Dictionary, word: string): { title: string; kind: string; lines: string[]; counters: string[] } {
  const def = dict.word(word);
  if (!def) return { title: word.toUpperCase(), kind: "", lines: [], counters: countersOf(dict, word) };
  const s = resolve(dict, word, []);
  const lines: string[] = [];
  const hit = damage(s);
  if (hit) lines.push(`${hit}${s.num("attack_rate") > 0 ? ` every ${num(1 / s.num("attack_rate"))} s` : ""}`);
  for (const [id] of s.entries()) if (id.startsWith("inflict_") && s.num(id) > 0) lines.push(`${plain(id)} ${num(statusSeconds(id.slice(8) as Status, s.num(id)))} s`);
  if (s.flag("sets_hostile")) lines.push("creatures here attack everyone not on its maker's side");
  if (s.num("contagion") > 0) lines.push(`spreads to people inside (${Math.round(s.num("contagion") * 100)}% a minute)`);
  if (s.get("sets_daylight") !== "none") lines.push(`makes it ${s.get("sets_daylight")}`);
  lines.push(...placeLines(dict, word, s));
  const body = def.ops.filter(([id]) => !/^produce_[A-Z]$/.test(id) && id !== "harvest_bonus").map(opText);
  if (body.length) lines.push(`on everyone it reaches: ${body.slice(0, 6).join(", ")}`);
  const kind = [def.class === "event" ? "event" : def.archetype === "weather" ? "weather" : "field", def.archetype].filter((x, i, a) => a.indexOf(x) === i).map(words).join(" · ");
  return { title: word.toUpperCase(), kind, lines, counters: countersOf(dict, word) };
}

/** A thing's kind in a word or two for a short line: "material", "weapon", "feeling". */
const kindWord = (dict: Dictionary, noun: string) => words(dict.word(noun)?.archetype ?? dict.word(noun)?.class ?? "thing");

/**
 * What carrying, wearing or riding something does for you, in one short line for the HUD,
 * loadout and inventory: "damage 40 slash · reach 2 m", "+10% digging", "light · frightens foes",
 * "U: 4 food". When it does nothing held, it says so plainly, with what it is good for instead:
 * "material · burns · builds: no effect held".
 */
export function heldText(dict: Dictionary, phrase: string): string {
  let p: Phrase;
  try { p = parsePhrase(dict, phrase); } catch { return ""; }
  const s = p.stats, out: string[] = [];
  const hit = damage(s);
  if (hit && s.get("equip_slot") === "held") out.push(`${hit}${s.num("attack_range") > 1.5 ? `, reach ${num(s.num("attack_range"))} m` : ""}`);
  if (s.num("armor") > 0) out.push(`armor ${num(s.num("armor"))}`);
  if (s.flag("mountable") && Math.max(s.num("speed_land"), s.num("speed_air"), s.num("speed_water")) > 0) {
    out.push(`ride at ${num(Math.max(s.num("speed_land"), s.num("speed_air"), s.num("speed_water")))} m/s`);
  }
  const KINDS: [string, string][] = [["forage", "foraging"], ["fish", "fishing"], ["dig", "digging"], ["cache", "caches"], ["hunt", "hunting"]];
  for (const [kind, name] of KINDS) {
    const h = toolHelp(kind, [{ name: p.noun, stats: s }]);
    if (h.length) out.push(kind === "hunt" ? `more letters ${name}` : `+${Math.round(h[0]!.chance * 100)}% ${name}`);
  }
  for (const [id] of s.entries()) if (id.startsWith("res_") && s.num(id) > 0 && out.length < 4) out.push(`${plain(id)} ${Math.round(s.num(id) * 100)}%`);
  if (s.num("luminosity") > 0) out.push("light");
  if (s.num("fear_aura") > 0) out.push("frightens foes");
  if (s.num("heals") > 0) out.push(`heals ${num(s.num("heals"))}/s around you`);
  if (s.num("sight_range") > 10 && s.get("equip_slot") !== "none") out.push(`sight ${num(s.num("sight_range"))} m`);
  const letters = Object.entries(producerOf(s, p.count).rates);
  if (letters.length) out.push(`makes ${letters.map(([ch, n]) => `${ch.toUpperCase()} ${num(n)}`).join(", ")}/min`);
  const claim = claimOf(s);
  if (claim) out.push(`claims ${num(claim.radius)} tiles`);
  for (const [id, op, amount] of dict.word(p.noun)?.ops ?? []) {
    if (out.length >= 4 || /^produce_|^harvest/.test(id)) continue;
    if (typeof amount === "number") out.push(opText([id, op, amount]));
  }
  const use = useObject(dict, p.noun, p.adjectives);
  if (use) {
    const u = use.stats, bits: string[] = [];
    if (u.num("restores") > 0) bits.push(`+${num(u.num("restores"))} health`);
    if (u.num("nutrition") > 0) bits.push(`${num(u.num("nutrition"))} food`);
    if (u.tags("effect_status").length) bits.push(`cures ${u.tags("effect_status").join(", ")}`);
    out.push(`U: ${bits.join(", ") || "use it"}`);
  }
  if (out.length) return out.slice(0, 3).join(" · ");
  // Nothing held: say what it is and what it is good for.
  const traits = [kindWord(dict, p.noun)];
  if (s.num("flammability") >= 5) traits.push("burns");
  if (dict.word(p.noun)?.class === "material") traits.push("builds");
  if (improvisable(s) && s.flag("portable")) traits.push("can be swung");
  return `${traits.join(" · ")}: no effect held`;
}

/** What something in force on you (a verb cast, a field you stand in: HOPE, RUN) does, in one short line. */
export function effectText(dict: Dictionary, word: string): string {
  const noun = word.toLowerCase().trim().split(/\s+/).at(-1) ?? word;
  const def = dict.word(noun);
  if (!def) return "";
  const lines = [...def.ops.filter(([id]) => !/^produce_|^harvest/.test(id)).map(opText), ...(def.role === "noun" ? placeLines(dict, noun, resolve(dict, noun, [])) : [])];
  return lines.slice(0, 3).join(" · ") || `${kindWord(dict, noun)}: no effect on you`;
}
