import type { Dictionary } from "./dictionary.js";
import { HAND_FILL, STARTING_HAND, starterWords } from "./economy.js";
import { HARVEST_SOURCES, TOOL_POINTS } from "./biome.js";
import { keyStats, opText } from "./inspect.js";
import { parsePhrase, type Letters } from "./phrase.js";
import { placeRules, rulesText, type PlaceRules } from "./place.js";
import { needsText, producerOf } from "./produce.js";
import type { Rng } from "./rng.js";
import { claimOf } from "./sense.js";
import { Stats } from "./stats.js";
import type { Op, Value, WordDef } from "./types.js";
import { outputs, SUPPLIES } from "./upkeep.js";
import { TILE_METERS } from "./world.js";

/**
 * Starting kits (PLAN.md "Starting kits"): at the start of a round each person picks one of three
 * kits. A kit is a job, a building placed at their spawn, a sealed legendary word and a starting
 * hand. The tables come from `data/kits.json` (tools/build_kits.py).
 *
 * A job is worn like an invisible tool for the whole round, so it acts only through shared
 * properties: its own `set` is read as any carried tool's (`harvest_sources` and `harvest_bonus`
 * for gathering and hunting, `command_limit`, `authority`, `recruit_rate`), its body operations
 * change its holder as an item's do (sight, speed, strength, armour...), and its `produce_<L>`
 * operations and `trade_rate` are a place's rules that go wherever its holder goes (shared
 * `placeRules`): every L they earn, and every market price they pay.
 */
export interface JobDef { word: string; set: Record<string, Value>; ops: Op[]; letters: string; core?: boolean }
export type UnlockKind = "minutes" | "letters" | "land" | "boss" | "producers" | "regions" | "hunts" | "trades" | "city" | "kills";
export interface Unlock { kind: UnlockKind; need?: number }
export interface LegendDef { word: string; unlock: Unlock; counter: string }
export interface KitData { jobs: JobDef[]; buildings: string[]; legendaries: LegendDef[] }

/** Kits offered to each person. */
export const KIT_CHOICES = 3;
/** Seconds to pick a kit before one is picked for you. */
export const KIT_SECONDS = 20;

/** One kit: what it gives, by name, and the starting hand. */
export interface Kit { job: string; building: string; legend: string; hand: Letters }

/** A line on a kit card: an icon and a few words. */
export interface KitLine { icon: string; text: string }
/** What a kit card shows. */
export interface KitCard {
  job: { word: string; lines: KitLine[] };
  building: { word: string; lines: KitLine[] };
  legend: { word: string; unlock: string; counter: string; lines: KitLine[] };
  letters: string;
}

/** A job as a word definition, for the shared readers of words (`placeRules`). */
const jobDef = (job: JobDef): WordDef => ({ role: "noun", class: "person", archetype: "job", set: job.set, ops: job.ops });
const yieldOp = ([id]: Op) => /^produce_[A-Z]$/.test(id) || id === "harvest_bonus";

/** A job's own properties, read as a carried tool's. */
export function jobStats(dict: Dictionary, job: JobDef): Stats {
  const s = new Stats(dict);
  for (const [id, v] of Object.entries(job.set)) s.set(id, v);
  return s;
}

/** What a job does to its holder's body (the operations that are not letter yields). */
export function jobBodyOps(job: JobDef): Op[] {
  return job.ops.filter((o) => !yieldOp(o));
}

/** The rules a job carries wherever its holder goes: letter yields and market prices, or null. */
export function jobRules(dict: Dictionary, job: JobDef): PlaceRules | null {
  return placeRules(jobDef(job), jobStats(dict, job));
}

const KIND_TEXT: Record<string, [string, string]> = {
  fish: ["🎣", "fishing"], forage: ["🌿", "foraging"], dig: ["⛏", "digging"], cave: ["🕳", "caves"], cache: ["🗝", "caches"],
};
const fmt = (n: number) => String(+n.toFixed(2));
const pct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.round(Math.abs(n) * 100)}%`;
const BODY_ICON: Record<string, string> = {
  sight_range: "👁", speed_land: "👟", strength: "💪", armor: "🛡", integrity: "❤", accuracy: "🎯", stealth: "🥷",
};

/** A job's perks in a few words each. */
export function jobLines(job: JobDef): KitLine[] {
  const out: KitLine[] = [];
  const sources = Array.isArray(job.set.harvest_sources) ? (job.set.harvest_sources as string[]) : [];
  const bonus = Number(job.set.harvest_bonus ?? 1);
  if (bonus > 1) {
    for (const [kind, wants] of Object.entries(HARVEST_SOURCES)) {
      if (!sources.some((s) => wants.includes(s))) continue;
      if (kind === "hunt") out.push({ icon: "🏹", text: `+${Math.floor(bonus - 1)} letters a hunt` });
      else if (KIND_TEXT[kind]) out.push({ icon: KIND_TEXT[kind]![0], text: `${KIND_TEXT[kind]![1]} ${pct((bonus - 1) * TOOL_POINTS)}` });
    }
  }
  const yields = job.ops.filter(yieldOp).map(([id, op, n]) => `${id === "harvest_bonus" ? "all" : id.slice(8)} ${op === "mul" ? `×${fmt(n)}` : `+${fmt(n)}`}`);
  if (yields.length) out.push({ icon: "🔤", text: yields.join(" · ") });
  const rate = Number(job.set.trade_rate ?? 1);
  if (rate !== 1) out.push({ icon: "⚖", text: `markets ask ×${fmt(rate)}` });
  if (Number(job.set.command_limit) > 0) out.push({ icon: "👥", text: `+${fmt(Number(job.set.command_limit))} creatures follow you` });
  if (Number(job.set.authority) > 0) out.push({ icon: "👑", text: `authority +${fmt(Number(job.set.authority))}` });
  if (Number(job.set.recruit_rate) > 0) out.push({ icon: "🙌", text: "draws wild creatures to you" });
  for (const o of jobBodyOps(job)) {
    const [id, op, n] = o;
    const text = id === "strength" ? `strength +${fmt(n)} (carry +${fmt(n * 4)} kg)`
      : op === "mul" ? `${opText(o).replace(/ ×.*/, "")} ${pct(n - 1)}`
      : id === "accuracy" || id.startsWith("res_") ? `${opText(o).replace(/ [+−].*/, "")} ${pct(n)}`
      : opText(o);
    out.push({ icon: BODY_ICON[id] ?? (id.startsWith("res_") ? "🧪" : "✦"), text });
  }
  return out;
}

/** What a starting building does, in a few words each, through the shared systems it touches. */
export function buildingLines(dict: Dictionary, word: string): KitLine[] {
  const out: KitLine[] = [];
  const def = dict.word(word);
  if (!def) return out;
  const s = parsePhrase(dict, word).stats;
  const spec = producerOf(s);
  const rates = Object.entries(spec.rates);
  if (rates.length) {
    const needs = needsText(spec);
    out.push({ icon: "🔤", text: `makes ${rates.map(([ch, n]) => `${ch.toUpperCase()} ${fmt(n)}/min`).join(", ")}${needs ? ` (${needs})` : ""}` });
  }
  const claim = claimOf(s);
  if (claim) out.push({ icon: "🚩", text: `claims ${fmt(claim.radius)} tiles, ${Math.round(claim.shelter * 100)}% shelter` });
  if (s.num("field_radius") > 0) {
    const what = [...def.ops.filter((o) => !yieldOp(o)).map(opText), ...((r) => (r ? rulesText(r) : []))(placeRules(def, s))];
    if (what.length) out.push({ icon: "✨", text: `within ${fmt(s.num("field_radius") / TILE_METERS)} tiles: ${what.slice(0, 3).join(", ")}` });
  }
  if (s.num("heals") > 0) out.push({ icon: "❤", text: `heals your side ${fmt(s.num("heals"))}/s` });
  if (s.num("luminosity") > 0) out.push({ icon: "💡", text: "lights the night" });
  const made = outputs(s);
  for (const k of SUPPLIES) if (made[k] > 0) out.push({ icon: k === "food" ? "🍞" : k === "fuel" ? "🪵" : "⚡", text: `${k} +${fmt(made[k])}/min` });
  if (s.num("water_output") > 0) out.push({ icon: "💧", text: "waters the ground around it" });
  if (s.num("command_limit") > 0) out.push({ icon: "👥", text: `+${fmt(s.num("command_limit"))} creatures follow you` });
  if (s.num("recruit_rate") > 0) out.push({ icon: "🙌", text: "draws wild creatures to you" });
  out.push({ icon: "🧱", text: `integrity ${fmt(s.num("integrity"))}` });
  return out;
}

/** The letters a legendary is unsealed with, under the "letters" condition: every other one of its letters. */
export function sealedLetters(word: string): string {
  return [...word].filter((_, i) => i % 2 === 1).join("");
}

/** A legendary's unlock condition in a few words. */
export function unlockText(l: LegendDef): string {
  const n = l.unlock.need ?? 0;
  switch (l.unlock.kind) {
    case "minutes": return `after ${n} min`;
    case "letters": return `pay ${sealedLetters(l.word).toUpperCase().split("").join(" ")} (half its letters)`;
    case "land": return `hold ${n} tiles of land`;
    case "boss": return "slay a roaming boss";
    case "producers": return `own ${n} things that make letters`;
    case "regions": return `explore ${n} regions`;
    case "hunts": return `hunt ${n} wild animals`;
    case "trades": return `make ${n} trades`;
    case "city": return "rule a city";
    case "kills": return `kill ${n} ${n === 1 ? "person" : "people"}`;
  }
}

/** How far toward unlocking: what counts, and what is needed. "letters" needs every sealed letter held. */
export function unlockNeed(l: LegendDef): number {
  return l.unlock.kind === "letters" ? sealedLetters(l.word).length : l.unlock.kind === "boss" || l.unlock.kind === "city" ? 1 : l.unlock.need ?? 1;
}

/** A legendary's card lines: its key numbers. */
export function legendLines(dict: Dictionary, word: string): KitLine[] {
  const s = parsePhrase(dict, word).stats;
  return keyStats(s).slice(0, 3).map((text) => ({ icon: "⚔", text }));
}

let starterMakes: { dict: Dictionary; makes: Map<string, string> } | null = null;
/** Each starter word's letters made, once per dictionary. */
function makesOf(dict: Dictionary): Map<string, string> {
  if (starterMakes?.dict === dict) return starterMakes.makes;
  const makes = new Map<string, string>();
  for (const w of starterWords(dict)) makes.set(w, Object.keys(producerOf(parsePhrase(dict, w).stats).rates).join(""));
  starterMakes = { dict, makes };
  return makes;
}

/**
 * A starting hand for a job: STARTING_HAND letters around a starter word (shared `starterWords`,
 * so the hand can always spell a producer), picked among those that make or are spelled with the
 * job's letters where any are; then half the rest from the job's letters (never J, Q, X or Z,
 * which only actions give) and the rest by how common each letter is.
 */
export function kitHand(dict: Dictionary, job: JobDef, rng: Rng): Letters {
  const words = starterWords(dict), makes = makesOf(dict);
  const lean = [...job.letters.toLowerCase()].filter((ch) => /[a-z]/.test(ch) && !"jqxz".includes(ch));
  const fits = words.filter((w) => lean.some((ch) => makes.get(w)?.includes(ch) || w.includes(ch)));
  const pool = fits.length ? fits : words;
  const word = pool[Math.floor(rng() * pool.length)] ?? "";
  const hand: Letters = {};
  const add = (ch: string) => { hand[ch] = (hand[ch] ?? 0) + 1; };
  for (const ch of word) add(ch);
  const rest = STARTING_HAND - word.length, leaned = lean.length ? Math.ceil(rest / 2) : 0;
  for (let i = 0; i < rest; i++) add(i < leaned ? lean[i % lean.length]! : HAND_FILL[Math.floor(rng() * HAND_FILL.length)]!);
  return hand;
}

/** `n` picks from a list, all different (fewer if the list is shorter). */
function distinct<T>(list: readonly T[], n: number, rng: Rng): T[] {
  const left = [...list], out: T[] = [];
  while (out.length < n && left.length) out.push(left.splice(Math.floor(rng() * left.length), 1)[0]!);
  return out;
}

/** Deals KIT_CHOICES kits: different jobs, different buildings and different legendaries. */
export function dealKits(data: KitData, dict: Dictionary, rng: Rng, n = KIT_CHOICES): Kit[] {
  const jobs = distinct(data.jobs, n, rng), buildings = distinct(data.buildings, n, rng), legends = distinct(data.legendaries, n, rng);
  return jobs.map((job, i) => ({
    job: job.word, building: buildings[i % buildings.length]!, legend: legends[i % legends.length]!.word, hand: kitHand(dict, job, rng),
  }));
}

/** The card for a kit. */
export function kitCard(data: KitData, dict: Dictionary, kit: Kit): KitCard {
  const job = data.jobs.find((j) => j.word === kit.job)!;
  const legend = data.legendaries.find((l) => l.word === kit.legend)!;
  return {
    job: { word: kit.job, lines: jobLines(job) },
    building: { word: kit.building, lines: buildingLines(dict, kit.building) },
    legend: { word: kit.legend, unlock: unlockText(legend), counter: legend.counter, lines: legendLines(dict, kit.legend) },
    letters: Object.entries(kit.hand).flatMap(([ch, k]) => Array(k).fill(ch)).sort().join(""),
  };
}

/** How a bot rates a kit: a building that makes letters first, then the job with the most to it. */
export function kitScore(data: KitData, dict: Dictionary, kit: Kit): number {
  const job = data.jobs.find((j) => j.word === kit.job);
  const makes = Object.keys(producerOf(parsePhrase(dict, kit.building).stats).rates).length;
  return makes * 3 + (job ? Object.keys(job.set).length + job.ops.length : 0);
}

/**
 * What spelling costs with an unsealed legendary in it: the phrase's letters less the
 * legendary's own (adjectives and a plural S still cost). Returns null if the noun is not it.
 */
export function legendCost(letters: string, noun: string, legend: string): string | null {
  if (noun !== legend) return null;
  let left = letters;
  for (const ch of legend) left = left.replace(ch, "");
  return left;
}

/** A job by its word. */
export const jobOf = (data: KitData, word: string): JobDef | undefined => data.jobs.find((j) => j.word === word);
/** A legendary by its word. */
export const legendOf = (data: KitData, word: string): LegendDef | undefined => data.legendaries.find((l) => l.word === word);
