import type { Dictionary } from "./dictionary.js";
import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import { Tile, tileAt, type WorldMap } from "./world.js";

/**
 * Biomes: what each kind of ground is called, what foraging finds there and how often, what
 * lives there. Large regions laid by `generateMap` from temperature and moisture; terrain words
 * (DESERT, JUNGLE, MARSH...) lay them too.
 */
export interface BiomeInfo {
  /** The name shown in the letter popup: "JUNGLE". */
  name: string;
  /** The `habitat` tag creatures that live here carry. */
  habitat: string;
  /** Chance a forage here finds anything, before tools. */
  forage: number;
  /** What a forage finds, each letter as often as it appears. */
  finds: string;
  /** Food a forage puts in the food store, found or not. */
  food: number;
}

const B = (name: string, habitat: string, forage: number, finds: string, food: number): BiomeInfo => ({ name, habitat, forage, finds, food });

/**
 * A biome's finds from whole percents, E first ({ e: 35, a: 20 } -> 35 e's then 20 a's): each
 * letter is found that share of the time. The shares must add up to 100.
 */
export function pool(shares: Readonly<Record<string, number>>): string {
  const total = Object.values(shares).reduce((n, k) => n + k, 0);
  if (total !== 100) throw new Error(`forage pool adds up to ${total}, not 100`);
  return Object.entries(shares).map(([ch, k]) => ch.repeat(k)).join("");
}

/**
 * Every kind of ground's biome. E is the everyday find everywhere (about a third), and each biome
 * leans on letters that fit it, from the systems PLAN.md's letter table names: forest P N T R,
 * meadows A L I, marsh O U M, hills G B, shore O C S, taiga W Y U, cities S T C M B, roads R T.
 * Hostile ground (desert, badlands, tundra, snow, volcanic ash) finds less often but can turn up
 * rare letters: J, K, V, Y, X, and on ash a one-in-a-hundred Z. Never Q (the temple's alone).
 * Water and walls have none.
 */
export const BIOMES: Partial<Record<Tile, BiomeInfo>> = {
  [Tile.Sand]: B("shore", "shore", 0.5, pool({ e: 34, o: 26, s: 16, c: 14, l: 5, a: 5 }), 0.02),
  [Tile.Grass]: B("grassland", "meadow", 0.6, pool({ e: 36, a: 20, l: 15, i: 12, t: 9, n: 8 }), 0.1),
  [Tile.Meadow]: B("meadow", "meadow", 0.65, pool({ e: 32, a: 18, l: 14, i: 14, p: 12, n: 10 }), 0.12),
  [Tile.Forest]: B("forest", "forest", 0.6, pool({ e: 34, p: 18, n: 14, t: 14, r: 12, l: 8 }), 0.15),
  [Tile.Taiga]: B("taiga", "taiga", 0.5, pool({ e: 35, p: 15, u: 14, w: 14, y: 12, n: 10 }), 0.08),
  [Tile.Jungle]: B("jungle", "jungle", 0.7, pool({ e: 30, a: 12, i: 10, o: 10, p: 10, u: 8, r: 8, n: 7, m: 5 }), 0.2),
  [Tile.Savanna]: B("savanna", "savanna", 0.5, pool({ e: 35, a: 20, s: 12, r: 10, t: 10, i: 8, l: 5 }), 0.06),
  [Tile.Desert]: B("desert", "desert", 0.25, pool({ e: 34, s: 24, d: 14, r: 12, t: 8, j: 4, y: 2, x: 2 }), 0.01),
  [Tile.Badlands]: B("badlands", "badlands", 0.3, pool({ e: 32, g: 22, b: 16, d: 8, k: 8, r: 6, j: 4, v: 3, x: 1 }), 0.01),
  [Tile.Tundra]: B("tundra", "tundra", 0.3, pool({ e: 34, u: 20, y: 14, w: 14, j: 6, k: 5, v: 4, o: 3 }), 0.02),
  [Tile.Marsh]: B("marsh", "marsh", 0.6, pool({ e: 35, o: 22, u: 15, m: 15, r: 8, n: 5 }), 0.08),
  [Tile.Swamp]: B("swamp", "marsh", 0.55, pool({ e: 32, o: 20, u: 20, m: 18, r: 5, n: 5 }), 0.05),
  [Tile.Ash]: B("volcanic", "volcanic", 0.2, pool({ e: 33, g: 21, f: 12, k: 8, v: 8, j: 6, d: 6, x: 5, z: 1 }), 0),
  [Tile.Hill]: B("hills", "hills", 0.5, pool({ e: 36, g: 24, b: 14, l: 10, r: 8, t: 8 }), 0.04),
  [Tile.Snow]: B("snow", "tundra", 0.15, pool({ e: 30, u: 18, w: 14, y: 14, j: 10, v: 6, k: 6, x: 2 }), 0),
  [Tile.City]: B("city", "city", 0.4, pool({ e: 34, s: 16, t: 16, c: 14, m: 10, b: 10 }), 0),
  [Tile.Road]: B("road", "meadow", 0.4, pool({ e: 36, r: 24, t: 16, s: 8, l: 8, n: 8 }), 0),
  [Tile.Field]: B("tilled land", "meadow", 0.6, pool({ e: 35, a: 30, p: 10, l: 10, i: 8, n: 7 }), 0.2),
};

/** The biome of a point on the map, or undefined where nobody can stand. */
export function biomeAt(map: WorldMap, x: number, y: number): BiomeInfo | undefined {
  return BIOMES[tileAt(map, x, y)];
}

/** Success chances of gathering that is not foraging (fishing, digging, caves), before tools. */
export const GATHER_CHANCE = { fish: 0.6, dig: 0.55, cave: 0.45 } as const;

/**
 * What a tool's `harvest_sources` must name for its `harvest_bonus` to help each kind of
 * gathering: a SHOVEL (dig) digs, a NET or HOOK (fishing) fishes, an AXE (tree) and a BASKET
 * (forage) forage, a BOW or KNIFE (hunting) hunts.
 */
export const HARVEST_SOURCES: Readonly<Record<string, readonly string[]>> = {
  forage: ["forage", "field", "tree", "plant"],
  fish: ["fishing", "river"],
  dig: ["dig", "quarry", "mine"],
  cave: ["mine", "dig"],
  chest: ["chest", "cache", "dig"],
  hunt: ["hunting"],
};

/** Percentage points of success each point of `harvest_bonus` above 1 adds: a SHOVEL (2) adds 10. */
export const TOOL_POINTS = 0.1;

/** One thing that helps: its name and the chance it adds. */
export interface Help { by: string; chance: number }

/**
 * What a person's body and gear add to one kind of gathering: each thing whose
 * `harvest_sources` names that kind adds TOOL_POINTS for every point of its `harvest_bonus`
 * above 1.
 */
export function toolHelp(kind: string, things: readonly { name: string; stats: Stats }[]): Help[] {
  const wants = HARVEST_SOURCES[kind] ?? [kind];
  const out: Help[] = [];
  for (const t of things) {
    const sources = t.stats.tags("harvest_sources");
    const bonus = t.stats.num("harvest_bonus");
    if (bonus > 1 && sources.some((s) => wants.includes(s))) out.push({ by: t.name, chance: (bonus - 1) * TOOL_POINTS });
  }
  return out;
}

/** A gathering roll: whether it found anything, its chance, and what the chance was made of. */
export interface Roll { ok: boolean; chance: number; base: number; place: string; help: Help[] }

/** Rolls one gathering of a kind with a base chance and what helps: never below 2%, never above 95%. */
export function roll(base: number, place: string, help: Help[], rng: Rng): Roll {
  const chance = Math.min(0.95, Math.max(0.02, base + help.reduce((n, h) => n + h.chance, 0)));
  return { ok: rng() < chance, chance, base, place, help };
}

/** The breakdown under a letter popup: "JUNGLE 35% · +10% SHOVEL". */
export function rollText(r: Pick<Roll, "base" | "place" | "help">): string {
  return [`${r.place.toUpperCase()} ${Math.round(r.base * 100)}%`, ...r.help.map((h) => `+${Math.round(h.chance * 100)}% ${h.by.toUpperCase()}`)].join(" · ");
}

/**
 * What foraging here tends to give, for the HUD: each letter's share of finds, commonest first,
 * as whole percents ("E 34 · P 18 · N 14 · T 14 · R 12 · L 8").
 */
export function forageOdds(b: BiomeInfo): { letter: string; pct: number }[] {
  const n = new Map<string, number>();
  for (const c of b.finds) n.set(c, (n.get(c) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([letter, k]) => ({ letter, pct: Math.round((k / b.finds.length) * 100) }));
}

/** A letter drawn from a biome's finds. */
export function forageLetter(b: BiomeInfo, rng: Rng): string {
  return b.finds[Math.floor(rng() * b.finds.length)] ?? "e";
}

/**
 * The wild creatures of a habitat, with how often each is chosen: every creature in the
 * dictionary whose `habitat` names it, the smaller and the more peaceable more often (a herd
 * of gazelles for every lion). Only living, wild-born creatures that are not people.
 */
export function wildlife(dict: Dictionary, habitat: string): [string, number][] {
  const out: [string, number][] = [];
  for (const [word, def] of dict.words) {
    if (def.role !== "noun" || def.class !== "creature") continue;
    const h = def.set.habitat;
    if (!Array.isArray(h) || !h.includes(habitat)) continue;
    const mass = Number(def.set.mass ?? 1), aggression = Number(def.set.aggression ?? 0);
    // Fewer of the big and the fierce: a lion for every few gazelles, a mammoth now and then.
    const weight = (1 / (1 + Math.log10(Math.max(1, mass)) * 0.5)) * (aggression >= 5 ? 0.35 : 1);
    out.push([word, weight]);
  }
  return out;
}

/** A wild creature for a habitat, or null if nothing lives there. */
export function pickWild(table: readonly [string, number][], rng: Rng): string | null {
  if (!table.length) return null;
  let r = rng() * table.reduce((n, [, w]) => n + w, 0);
  for (const [word, w] of table) if ((r -= w) < 0) return word;
  return table.at(-1)![0];
}

/** Letters across the lexicon, rarest first: what a hunt's lucky extra letter favours. */
const RAREST = "qjzxkvwfbyhgpmudclsrtnoiae";

/**
 * What a hunt pays, besides the H every wild kill gives: the animal's first letter (FOX -> F),
 * and bonuses from what was killed and how.
 * - a body over 100 kg gives one more of its name's letters, over 1000 kg two;
 * - a sharp blade (`sharpness` 6 or more) skins it: one more letter, and half as much food again;
 * - a ranged weapon (`attack_range` 10 m or more) brings a bird down whole: one more letter;
 * - anything whose `harvest_sources` names hunting adds its `harvest_bonus` above 1 in letters;
 * - a creature from far-off ground (not meadow or forest) may give its rarest letter (one in four).
 * Returns the letters, extra food (a multiplier) and the reasons, for the popup.
 */
export interface HuntYield { letters: string; food: number; why: string[] }
export function huntYield(
  noun: string, prey: Stats, weapon: { name: string; stats: Stats } | null,
  tools: readonly { name: string; stats: Stats }[], rng: Rng,
): HuntYield {
  const name = noun.toLowerCase().replace(/[^a-z]/g, "") || "h";
  // Extra letters come from the name's everyday letters; the rare ones only from the lucky roll below.
  const plain = name.replace(/[jqxz]/g, "") || "h";
  const pick = () => plain[Math.floor(rng() * plain.length)]!;
  let letters = "h" + name[0]!;
  let food = 1;
  const why: string[] = [];
  const mass = prey.num("mass");
  const big = mass > 1000 ? 2 : mass > 100 ? 1 : 0;
  if (big) { for (let i = 0; i < big; i++) letters += pick(); why.push(`big +${big}`); }
  if (weapon && weapon.stats.num("sharpness") >= 6) { letters += pick(); food = 1.5; why.push(`${weapon.name.toUpperCase()} skins +1, food ×1.5`); }
  if (weapon && weapon.stats.num("attack_range") >= 10 && prey.num("speed_air") > 0) { letters += pick(); why.push(`${weapon.name.toUpperCase()} on a bird +1`); }
  for (const h of toolHelp("hunt", tools)) {
    const n = Math.floor(h.chance / TOOL_POINTS);
    if (n > 0) { for (let i = 0; i < n; i++) letters += pick(); why.push(`${h.by.toUpperCase()} +${n}`); }
  }
  const habitat = prey.tags("habitat");
  if (habitat.length && !habitat.some((h) => h === "meadow" || h === "forest") && rng() < 0.25) {
    const rare = [...RAREST].find((ch) => name.includes(ch));
    if (rare) { letters += rare; why.push(`rare ${rare.toUpperCase()}`); }
  }
  return { letters, food, why };
}
