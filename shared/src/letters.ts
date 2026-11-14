import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import type { Letters } from "./phrase.js";
import { Tile, tileAt, walkable, type Point, type WorldMap } from "./world.js";
import { BIOMES, forageLetter, GATHER_CHANCE, roll, type Help, type Roll } from "./biome.js";

/** Seconds one gathering action takes. */
export const GATHER_SECONDS = 2;
/** How close, in tiles, two players must be to hand letters over. */
export const GIVE_RANGE = 3;

/**
 * Letters that come from actions and need no letters and no property (PLAN.md, "Letter
 * economy"): what you do, and where, decides what you get. Everything else comes from what
 * words make (`produce_*`), or, for F and V, from what you do with words.
 */
export const ACTION_SOURCES: Readonly<Record<string, string>> = {
  e: "foraging, anywhere on land (each biome finds its own letters, and often nothing)",
  o: "fishing beside water",
  u: "caves beside mountains (scarce)",
  g: "digging in hills and at the foot of mountains",
  h: "hunting wild creatures",
  d: "destroying objects and structures, ruins included",
  k: "killing people and the people who follow them",
  j: "being first into a region nobody has explored",
  x: "digging up buried caches, sometimes breaking ruins",
  q: "the map's one temple",
  t: "trading at a city market",
};
export const ACTION_LETTERS = Object.keys(ACTION_SOURCES).join("");

/**
 * Letters that come from deeds done with words or against other people's words: F from things
 * destroyed by fire (burnt as a sacrifice, your own or anyone's), V from beating something
 * another player owns (their things and their creatures).
 */
export const DEED_SOURCES: Readonly<Record<string, string>> = {
  f: "things destroyed by fire",
  v: "beating another player's things and creatures",
};

/** Common letters a transmutation takes for one Z, unless something you own (`transmute_in`, a LAB) does it for fewer. */
export const TRANSMUTE_RATIO = 10;

/** One kind of ground deposit: the letter, how many a patch holds, and seconds to grow one back (0: never). */
export interface DepositKind { letter: string; stock: number; regen: number; weight: number }

/**
 * What gathering by hand finds, per PATCH_TILES square of map. A patch gives up its stock and
 * then grows back slowly; caves never come back fast. Weights say which is found first where
 * several are to hand.
 */
export const DEPOSITS = {
  forage: { letter: "e", stock: 6, regen: 60, weight: 4 },
  fish: { letter: "o", stock: 4, regen: 90, weight: 3 },
  dig: { letter: "g", stock: 3, regen: 120, weight: 3 },
  cave: { letter: "u", stock: 2, regen: 600, weight: 3 },
} as const satisfies Record<string, DepositKind>;
export type Deposit = keyof typeof DEPOSITS;
const KINDS = Object.keys(DEPOSITS) as Deposit[];

/** Width in tiles of the square patches deposits are counted in. */
export const PATCH_TILES = 8;

/** True if any tile within one of a point is of the given kind. */
function beside(map: WorldMap, x: number, y: number, kinds: Tile[]): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (kinds.includes(tileAt(map, x + dx, y + dy))) return true;
    }
  }
  return false;
}

/** The deposits within reach of someone standing at a point: foraging anywhere on land, fishing by water... */
export function depositsAt(map: WorldMap, x: number, y: number): Deposit[] {
  if (!walkable(map, x, y)) return [];
  const out: Deposit[] = BIOMES[tileAt(map, x, y)] ? ["forage"] : [];
  if (beside(map, x, y, [Tile.Water, Tile.DeepWater])) out.push("fish");
  const mountain = beside(map, x, y, [Tile.Mountain]);
  const ground = tileAt(map, x, y);
  if (mountain || ground === Tile.Hill || ground === Tile.Badlands) out.push("dig");
  if (mountain) out.push("cave");
  return out;
}

/** A place on the map that gives one letter to whoever gathers beside it: a cache (X) or the temple (Q). */
export interface Site {
  id: string;
  x: number;
  y: number;
  letter: string;
  stock: number;
  max: number;
  /** Seconds to grow one back; 0 for never (a cache, once dug out, is gone). */
  regen: number;
  /** Tiles from it a gatherer may stand. */
  radius: number;
  /** Room time `stock` was last brought up to date. */
  at: number;
}

/**
 * What one gathering found: a letter, or why not. `emptied` names a site that has nothing left
 * for good. `roll` is the chance it had and what made it (missing where nothing was rolled).
 */
export type Gathered = { letter: string; from: string; emptied?: string; roll?: Roll } | { letter: ""; why: string; roll?: Roll };

/** A cache's X does not come at every dig: this chance, before a SHOVEL helps. */
export const CACHE_CHANCE = 0.35;

/** What helps a person gather each kind ("forage", "fish", "dig", "cave", "cache"): their tools. */
export type GatherHelp = (kind: string) => Help[];

/**
 * The map's deposits and sites, and how much each has left. Stock grows back lazily: worked
 * out from the time whenever a patch or site is looked at. Owned by the server; pure so it can
 * be tested here.
 */
export class Deposits {
  /** Patch index -> stock of each kind (in KINDS order) and when it was last brought up to date. */
  private patches = new Map<number, { stock: number[]; at: number }>();
  readonly sites = new Map<string, Site>();

  constructor(readonly map: WorldMap) {}

  addSite(site: Omit<Site, "at" | "max"> & { max?: number }, now = 0): void {
    this.sites.set(site.id, { ...site, max: site.max ?? site.stock, at: now });
  }

  /**
   * A patch brought up to date. `growth` scales how fast it grows back (RAIN 1.5, DROUGHT 0.1,
   * BLIGHT 0: the place's rules, shared `growthOf`); stock above the usual (after a HARVEST) is
   * kept until it is gathered down.
   */
  private patch(x: number, y: number, now: number, growth = 1) {
    const key = Math.floor(y / PATCH_TILES) * 4096 + Math.floor(x / PATCH_TILES);
    let p = this.patches.get(key);
    if (!p) this.patches.set(key, (p = { stock: KINDS.map((k) => DEPOSITS[k].stock), at: now }));
    const since = now - p.at;
    if (since > 0) {
      KINDS.forEach((k, i) => {
        const d = DEPOSITS[k], have = p!.stock[i]!;
        if (d.regen > 0 && have < d.stock) p!.stock[i] = Math.min(d.stock, have + (since * Math.max(0, growth)) / d.regen);
      });
      p.at = now;
    }
    return p;
  }

  /**
   * Multiplies the deposits of every patch within `radius` tiles of a point by `factor`, as an
   * area with `deposit_factor` begins: 0 strips the ground (BLIGHT), 3 fills it to three times its
   * usual stock (HARVEST). Returns how many patches it touched.
   */
  scale(x: number, y: number, radius: number, now: number, factor: number): number {
    const r = Math.max(0, radius), n = this.map.size;
    let touched = 0;
    for (let py = Math.max(0, Math.floor((y - r) / PATCH_TILES)); py <= Math.min(n - 1, y + r) / PATCH_TILES; py++) {
      for (let px = Math.max(0, Math.floor((x - r) / PATCH_TILES)); px <= Math.min(n - 1, x + r) / PATCH_TILES; px++) {
        const cx = (px + 0.5) * PATCH_TILES, cy = (py + 0.5) * PATCH_TILES;
        if (Math.hypot(cx - x, cy - y) > r + PATCH_TILES / 2) continue;
        const p = this.patch(cx, cy, now);
        KINDS.forEach((k, i) => { p.stock[i] = factor === 0 ? 0 : Math.max(p.stock[i]!, DEPOSITS[k].stock * factor); });
        touched++;
      }
    }
    return touched;
  }

  private grow(s: Site, now: number) {
    if (s.regen > 0 && now > s.at) s.stock = Math.min(s.max, s.stock + (now - s.at) / s.regen);
    s.at = now;
  }

  /** The nearest site in reach of a point that still has a whole letter, if any. */
  siteAt(x: number, y: number, now: number): Site | undefined {
    let best: Site | undefined, bestD = Infinity;
    for (const s of this.sites.values()) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > s.radius || d >= bestD) continue;
      this.grow(s, now);
      if (s.stock >= 1) { best = s; bestD = d; }
    }
    return best;
  }

  /** Whole letters to be had at a point right now, by letter. */
  available(x: number, y: number, now: number, growth = 1): Letters {
    const out: Letters = {};
    const site = this.siteAt(x, y, now);
    if (site) out[site.letter] = Math.floor(site.stock);
    const here = depositsAt(this.map, x, y);
    if (!here.length) return out;
    const p = this.patch(x, y, now, growth);
    for (const k of here) {
      const n = Math.floor(p.stock[KINDS.indexOf(k)]!);
      if (n > 0) out[DEPOSITS[k].letter] = (out[DEPOSITS[k].letter] ?? 0) + n;
    }
    return out;
  }

  /** Why gathering at a point would find nothing right now, or null if it would find a letter. */
  problem(x: number, y: number, now: number): string | null {
    if (Object.keys(this.available(x, y, now)).length) return null;
    return depositsAt(this.map, x, y).length ? "This ground is picked clean for now: move on" : "Nothing to gather here";
  }

  /**
   * One gathering action at a point: a site in reach first, else a deposit here, weighted, that
   * has stock left. Most tries find nothing (shared `biome.ts`: the biome's forage chance, or
   * `GATHER_CHANCE`, plus what `help` says the gatherer's tools add); a miss takes nothing.
   */
  gather(x: number, y: number, now: number, rng: Rng, growth = 1, help: GatherHelp = () => []): Gathered {
    const site = this.siteAt(x, y, now);
    if (site) {
      const r = site.letter === "x" ? roll(CACHE_CHANCE, "cache", help("cache"), rng) : undefined;
      if (r && !r.ok) return { letter: "", why: "nothing", roll: r };
      site.stock -= 1;
      const gone = site.regen === 0 && site.stock < 1;
      if (gone) this.sites.delete(site.id);
      return { letter: site.letter, from: site.id, ...(gone ? { emptied: site.id } : {}), ...(r ? { roll: r } : {}) };
    }
    const here = depositsAt(this.map, x, y);
    if (!here.length) return { letter: "", why: "Nothing to gather here" };
    const p = this.patch(x, y, now, growth);
    const open = here.filter((k) => p.stock[KINDS.indexOf(k)]! >= 1);
    if (!open.length) return { letter: "", why: "This ground is picked clean for now: move on" };
    const total = open.reduce((n, k) => n + DEPOSITS[k].weight, 0);
    let pick = rng() * total;
    const kind = open.find((k) => (pick -= DEPOSITS[k].weight) < 0) ?? open.at(-1)!;
    const biome = BIOMES[tileAt(this.map, x, y)];
    const r = kind === "forage"
      ? roll(biome?.forage ?? 0.2, biome?.name ?? "ground", help("forage"), rng)
      : roll(GATHER_CHANCE[kind], kind === "fish" ? "water" : kind === "dig" ? "digging" : "cave", help(kind), rng);
    if (!r.ok) return { letter: "", why: "nothing", roll: r };
    p.stock[KINDS.indexOf(kind)]! -= 1;
    const letter = kind === "forage" && biome ? forageLetter(biome, rng) : DEPOSITS[kind].letter;
    return { letter, from: kind, roll: r };
  }
}

/**
 * Width in tiles of an exploration region: the first person into each gives one J (PLAN.md:
 * "exploring undiscovered tiles; this depletes"), so a map holds only so many.
 */
export const REGION_TILES = 64;
export const regionOf = (x: number, y: number): number => Math.floor(y / REGION_TILES) * 4096 + Math.floor(x / REGION_TILES);

/** How many of each source a map gets, besides a market in every city. */
export const MAP_SOURCES = { caches: 8, ruins: 10, animals: 40 };
/** X a buried cache holds; it never refills. */
export const CACHE_X = 1;
/** Letters a cache's last dig turns up besides its X: the prize for finding it. */
export const CACHE_PRIZE = 3;
/** What a cache's prize is drawn from: everyday letters, so the prize is always useful. */
const PRIZE_LETTERS = "eeeaaaiioonnrrsstthldcmpbgwy";

/** The prize at the bottom of a cache: CACHE_PRIZE everyday letters. */
export function cachePrize(rng: Rng): string {
  let out = "";
  for (let i = 0; i < CACHE_PRIZE; i++) out += PRIZE_LETTERS[Math.floor(rng() * PRIZE_LETTERS.length)];
  return out;
}
/** X a ruin gives when it is broken, besides the D for breaking it, one time in RUIN_X_CHANCE. */
export const RUIN_X = 1;
export const RUIN_X_CHANCE = 0.25;
/** What a ruin has left standing: it starts badly broken, so bare hands can finish it. */
export const RUIN_INTEGRITY = 250;
/** The temple's Q: how many it holds and seconds to grow one back. */
export const TEMPLE_Q = { stock: 2, regen: 120 };
/** Tiles from a cache or the temple a gatherer may stand. */
export const SITE_RADIUS = 2.5;

/** Wild creatures put on a map for hunting, and how often each is chosen. All are peaceable. */
export const WILD_ANIMALS: Readonly<Record<string, number>> = { chicken: 5, turkey: 3, duck: 4, sheep: 4, pig: 3, fox: 2, cow: 1 };

export function pickAnimal(rng: Rng): string {
  const entries = Object.entries(WILD_ANIMALS);
  let roll = rng() * entries.reduce((n, [, w]) => n + w, 0);
  for (const [word, w] of entries) if ((roll -= w) < 0) return word;
  return entries[0]![0];
}

/**
 * Markets: neutral NPC traders, one in every city. Give MARKET_RATIO letters for one of your
 * choice (not the rare ones), and every trade also pays one T. A market has a few trades in
 * hand and takes on more slowly.
 */
export const MARKET = { ratio: 3, range: 4, stock: 8, regen: 20, refuses: "jqxz" };

/** Letters a market asks for one where its place's rules (shared `tradeRateOf`) scale the price: never under 1. */
export function marketRatio(rate: number): number {
  return Math.max(1, Math.round(MARKET.ratio * (Number.isFinite(rate) ? rate : 1)));
}

/** Reads "trade eee for o": what is given and what is wanted. Null if the text is not a trade. */
export function readTrade(text: string): { give: string; get: string } | null {
  const m = /^\s*trade\s+([a-z]+)\s+for\s+([a-z]+)\s*$/i.exec(text);
  return m ? { give: m[1]!.toLowerCase(), get: m[2]!.toLowerCase() } : null;
}

/** Why a market trade cannot happen, or null if it can (letters held are checked by the caller). */
export function tradeProblem(give: string, get: string, ratio: number = MARKET.ratio): string | null {
  if (give.length !== get.length * ratio) {
    return `The market takes ${ratio} letter${ratio === 1 ? "" : "s"} for each one: ${get.length * ratio} for ${get.toUpperCase()}`;
  }
  const rare = [...get].filter((ch) => MARKET.refuses.includes(ch));
  if (rare.length) return `No market sells ${[...new Set(rare)].join(" ").toUpperCase()}`;
  return null;
}

/**
 * The parts of the map where every person can reach every other: the largest set of walkable
 * tiles joined edge to edge. 1 for a tile in it.
 */
export function mainland(map: WorldMap): Uint8Array {
  const n = map.size, label = new Int32Array(n * n).fill(-1);
  let best = -1, bestSize = 0, next = 0;
  const queue = new Int32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (label[i] !== -1 || !walkable(map, (i % n) + 0.5, Math.floor(i / n) + 0.5)) continue;
    let head = 0, tail = 0, size = 0;
    queue[tail++] = i; label[i] = next;
    while (head < tail) {
      const c = queue[head++]!, x = c % n, y = (c - x) / n;
      size++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (label[j] === -1 && walkable(map, nx + 0.5, ny + 0.5)) { label[j] = next; queue[tail++] = j; }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
    next++;
  }
  const out = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) if (label[i] === best) out[i] = 1;
  return out;
}

/** Where a map's sources go: a market per city, the temple, caches, ruins and wild animals. */
export interface SourcePlaces { markets: Point[]; temple: Point; caches: Point[]; ruins: Point[]; animals: Point[] }

/**
 * Places the map's sources from a seeded generator, on the mainland only, out of cities:
 * caches and ruins at least 10 tiles from each other and from any city; the temple near the
 * middle of the map, where everyone must go for it.
 */
export function placeSources(map: WorldMap, rng: Rng, land = mainland(map)): SourcePlaces {
  const n = map.size;
  const onLand = (p: Point) => {
    const x = Math.floor(p.x), y = Math.floor(p.y);
    return x >= 0 && y >= 0 && x < n && y < n && land[y * n + x] === 1 && tileAt(map, x, y) !== Tile.City && tileAt(map, x, y) !== Tile.Road;
  };
  const awayFromCities = (p: Point, gap: number) => map.cities.every((c) => Math.hypot(c.x - p.x, c.y - p.y) > c.radius + gap);
  const spot = (ok: (p: Point) => boolean): Point | null => {
    for (let i = 0; i < 400; i++) {
      const p = { x: Math.floor(rng() * n) + 0.5, y: Math.floor(rng() * n) + 0.5 };
      if (onLand(p) && ok(p)) return p;
    }
    return null;
  };
  const spread = (count: number, taken: Point[]) => {
    const out: Point[] = [];
    for (let i = 0; i < count; i++) {
      const p = spot((q) => awayFromCities(q, 6) && [...taken, ...out].every((o) => Math.hypot(o.x - q.x, o.y - q.y) >= 10))
        ?? spot(() => true);
      if (p) out.push(p);
    }
    return out;
  };
  const markets = map.cities.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
  let temple: Point | null = null;
  for (let r = 0; r < n / 2 && !temple; r += 2) {
    temple = spot((p) => Math.hypot(p.x - n / 2, p.y - n / 2) <= r + 4 && awayFromCities(p, 8));
  }
  temple ??= spot(() => true) ?? { x: n / 2, y: n / 2 };
  const caches = spread(MAP_SOURCES.caches, [temple]);
  const ruins = spread(MAP_SOURCES.ruins, [temple, ...caches]);
  const animals: Point[] = [];
  for (let i = 0; i < MAP_SOURCES.animals; i++) { const p = spot((q) => awayFromCities(q, 3)); if (p) animals.push(p); }
  return { markets, temple, caches, ruins, animals };
}

/**
 * Where people start: on the mainland, out of cities, the farthest of a few hundred tries from
 * those already placed, which keeps eight people at least SPAWN_APART tiles from each other on
 * a 256-tile map.
 */
export const SPAWN_APART = 60;
export function spawnPoint(map: WorldMap, land: Uint8Array, taken: readonly Point[], rng: Rng): Point {
  const n = map.size;
  let best: Point | null = null, bestGap = -1;
  for (let i = 0; i < 300; i++) {
    const p = { x: Math.floor(rng() * n) + 0.5, y: Math.floor(rng() * n) + 0.5 };
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (land[y * n + x] !== 1 || tileAt(map, x, y) === Tile.City) continue;
    const gap = taken.reduce((g, o) => Math.min(g, Math.hypot(o.x - p.x, o.y - p.y)), Infinity);
    if (gap > bestGap) { best = p; bestGap = gap; }
  }
  return best ?? { x: n / 2, y: n / 2 };
}

/** What a kill pays: K for a person or a follower who is a person (sentient); V for beating someone's creature; H for a wild one. */
export function killLetters(victim: "person" | "owned" | "wild", sentient: boolean): string {
  if (victim === "person") return "k";
  if (victim === "wild") return "h";
  return sentient ? "vk" : "v";
}

/** What destroying a thing pays: D, V if it was another player's, F if fire did it, X for a ruin that had one (`RUIN_X_CHANCE`). */
export function destroyLetters(theirs: boolean, fire: boolean, ruin: boolean): string {
  return `d${theirs ? "v" : ""}${fire ? "f" : ""}${ruin ? "x".repeat(RUIN_X) : ""}`;
}

/** Letters an object generates each minute, from its produce_* properties. */
export function production(stats: Stats): Letters {
  const out: Letters = {};
  for (const [id] of stats.entries()) {
    if (id.startsWith("produce_")) {
      const rate = stats.num(id);
      if (rate > 0) out[id.slice(8).toLowerCase()] = rate;
    }
  }
  return out;
}

export function addLetters(held: Letters, letters: string): void {
  for (const ch of letters) held[ch] = (held[ch] ?? 0) + 1;
}

/** The few words a letter popup says about where a gathered letter came from: "E · forage". */
export const GATHER_REASONS: Readonly<Record<Deposit, string>> = { forage: "forage", fish: "fishing", dig: "digging", cave: "cave" };

/**
 * The alphabet guide under the spell window: how to get each letter in this build, in a few
 * words. `words` are things that make the letter (each test-checked to have its `produce_*`);
 * `later` names a source PLAN.md plans that is not built yet.
 */
export interface LetterHow { how: string; words?: string[]; later?: string }
export const LETTER_GUIDE: Readonly<Record<string, LetterHow>> = {
  a: { how: "crops on tilled land", words: ["hoe", "farm"] },
  b: { how: "furniture, claimed", words: ["bed", "chair"] },
  c: { how: "crafting, worked", words: ["kiln", "forge"] },
  d: { how: "destroy things" },
  e: { how: "forage (G), most biomes" },
  f: { how: "burn things" },
  g: { how: "dig hills (G)" },
  h: { how: "hunt animals" },
  i: { how: "livestock, pets", words: ["dog", "cow"] },
  j: { how: "first into new land" },
  k: { how: "kill people" },
  l: { how: "land held: claims", words: ["hedge", "fence"] },
  m: { how: "machines eat vowels", words: ["press", "engine"] },
  n: { how: "hired labour", words: ["aide", "worker"] },
  o: { how: "fish by water (G)", words: ["well"] },
  p: { how: "plants, harvested", words: ["hedge", "oak"] },
  q: { how: "the temple (G)" },
  r: { how: "roads you lay", words: ["lane", "road"] },
  s: { how: "citizens: rule a city", words: ["flag", "conquest"] },
  t: { how: "trade at a market" },
  u: { how: "caves by mountains (G)", words: ["mushroom"] },
  v: { how: "beat others' things" },
  w: { how: "mills, with the wind", words: ["mill", "windmill"] },
  x: { how: "caches (G), some ruins" },
  y: { how: "age: things kept", words: ["clock", "oak"] },
  z: { how: "bosses, transmute 10" },
};
