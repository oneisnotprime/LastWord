import type { Dictionary } from "./dictionary.js";
import { parsePhrase } from "./phrase.js";
import { walkable, type WorldMap } from "./world.js";

/**
 * Territory and people (PLAN.md "Letter economy"): L per tile of land held, R per road tile held,
 * S per citizen of a city you rule, N from hired labour, T per trade, Z from roaming bosses and
 * transmuting. All of it runs down over a round (claims tire, roads wear, citizens leave), so the
 * map starves and what is left becomes worth fighting over.
 */

/** L a minute for each tile of land you alone hold, while the claim is fresh. */
export const LAND_RATE = 0.002;
/** Minutes in which what a claim's land pays halves: claimed ground tires. */
export const LAND_HALF = 15;
/** R a minute for each road tile you laid, while it is new. */
export const ROAD_RATE = 0.05;
/** Minutes in which a road's condition (and what it pays) halves. */
export const ROAD_HALF = 12;
/** What a map road inside your claim pays, as a fraction of a new road of your own. */
export const CLAIMED_ROAD = 0.5;
/** S a minute for each citizen of a city you rule. */
export const CITIZEN_S = 0.15;
/** Citizens a city starts with. */
export const CITIZENS = 6;
/** Seconds between citizens leaving a ruled city (taxed), and coming back to one nobody rules. */
export const CITIZEN_LEAVE = 240;
export const CITIZEN_RETURN = 120;
/** What hiring a worker at a market costs, as a multiple of the market's price for one letter. */
export const HIRE_PRICE = 2;
/** The word a hired citizen becomes. */
export const HIRED = "labourer";
/** Tiles apart two players may trade, and seconds an offer stands. */
export const TRADE_RANGE = 6;
export const OFFER_SECONDS = 60;
/** Seconds before the same two players' trades pay T again: a trade is a deal, not a loop. */
export const PAIR_COOLDOWN = 30;
/** Round seconds at which roaming bosses rise, and the Z each drops. */
export const BOSS_TIMES = [240, 540, 900] as const;
export const BOSS_Z = 3;
/** Everyday letters a slain boss drops besides its Z. */
export const BOSS_HOARD = 6;

/** How much a claim (or road) still pays after `minutes`, halving every `half`. */
export const taper = (minutes: number, half: number): number => 0.5 ** (Math.max(0, minutes) / half);

/** A claim on the ground: whose, where, how far, and when it was made (round seconds). */
export interface ClaimDisc { owner: string; x: number; y: number; radius: number; born: number }

/** Land each owner holds: tiles alone, tiles contested with others, and what they pay as a weight (tiles × taper). */
export interface Holding { tiles: number; contested: number; weight: number; x: number; y: number }

/**
 * Who holds what land: every walkable tile inside a claim belongs to its claim's owner; a tile
 * inside two owners' claims is contested and pays nobody. Each tile pays at the freshest of its
 * owner's claims over it (`taper` with LAND_HALF).
 */
export function landHeld(map: WorldMap, claims: readonly ClaimDisc[], now: number): Map<string, Holding> {
  const n = map.size;
  const owners: string[] = [];
  const who = new Int16Array(n * n).fill(-1); // -2: contested
  const pay = new Float32Array(n * n);
  for (const c of claims) {
    let o = owners.indexOf(c.owner);
    if (o < 0) o = owners.push(c.owner) - 1;
    const r = Math.max(0, c.radius), t = taper((now - c.born) / 60, LAND_HALF);
    for (let y = Math.max(0, Math.floor(c.y - r)); y <= Math.min(n - 1, Math.floor(c.y + r)); y++) {
      for (let x = Math.max(0, Math.floor(c.x - r)); x <= Math.min(n - 1, Math.floor(c.x + r)); x++) {
        if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) > r) continue;
        const i = y * n + x;
        if (who[i] === -1) { who[i] = o; pay[i] = t; } else if (who[i] === o) pay[i] = Math.max(pay[i]!, t);
        else who[i] = -2;
      }
    }
  }
  const out = new Map<string, Holding>();
  for (const c of claims) if (!out.has(c.owner)) out.set(c.owner, { tiles: 0, contested: 0, weight: 0, x: c.x, y: c.y });
  for (const c of claims) {
    // Contested tiles are counted for everyone whose claims meet there.
    const h = out.get(c.owner)!, r = Math.max(0, c.radius), o = owners.indexOf(c.owner);
    for (let y = Math.max(0, Math.floor(c.y - r)); y <= Math.min(n - 1, Math.floor(c.y + r)); y++) {
      for (let x = Math.max(0, Math.floor(c.x - r)); x <= Math.min(n - 1, Math.floor(c.x + r)); x++) {
        if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) > r || !walkable(map, x + 0.5, y + 0.5)) continue;
        const i = y * n + x;
        if (who[i] === o) { h.tiles++; h.weight += pay[i]!; pay[i] = 0; who[i] = -3; } // counted once
        else if (who[i] === -2) h.contested++;
      }
    }
  }
  return out;
}

/**
 * A road a word lays: a straight run of road from where its speller stands, the way they face,
 * 12 tiles and 8 more for each tile of its `radius` (a HIGHWAY runs far). Returns its two ends.
 */
export function roadRun(x: number, y: number, dx: number, dy: number, radius: number, size: number): { x: number; y: number; x2: number; y2: number } {
  const len = 12 + 8 * Math.max(0, radius), d = Math.hypot(dx, dy) || 1;
  const clamp = (v: number) => Math.min(size - 0.5, Math.max(0.5, v));
  return { x, y, x2: clamp(x + (dx / d) * len), y2: clamp(y + (dy / d) * len) };
}

/** Reads "offer bot3 eee for a": to whom, what is given and what is wanted. Null if it is not an offer. */
export function readOffer(text: string): { to: string; give: string; get: string } | null {
  const m = /^\s*offer\s+(\S+)\s+([a-z]*)\s*for(?:\s+([a-z]*))?\s*$/i.exec(text);
  return m && (m[2] || m[3]) ? { to: m[1]!, give: m[2]!.toLowerCase(), get: (m[3] ?? "").toLowerCase() } : null;
}

/** Reads "transmute eeeeeeeeee": the common letters given for one Z. Null if it is not a transmutation. */
export function readTransmute(text: string): string | null {
  const m = /^\s*transmute\s+([a-z]+)\s*$/i.exec(text);
  return m ? m[1]!.toLowerCase() : null;
}

/** Why a transmutation cannot happen (`ratio` letters for one Z, none of them rare), or null if it can. */
export function transmuteProblem(give: string, ratio: number): string | null {
  if (/[jqxz]/.test(give)) return "Only common letters transmute: not J, Q, X or Z";
  if (give.length !== ratio) return `Transmuting takes ${ratio} common letters for one Z`;
  return null;
}

/**
 * The creatures that rise as roaming bosses: wild-hearted (aggression 6 or more), alive, and
 * between 2,000 and 20,000 integrity, a fight for several people, not an army. From the data,
 * so a new monster word joins the pool by what it is.
 */
export function bossWords(dict: Dictionary): string[] {
  const out: string[] = [];
  for (const [word, def] of dict.words) {
    if (def.role !== "noun" || !/^[a-z]+$/.test(word)) continue;
    let p;
    try { p = parsePhrase(dict, word); } catch { continue; }
    const s = p.stats;
    if (p.kind !== "object" || p.plural || p.count !== 1 || !s.flag("alive") || s.flag("mountable")) continue;
    const hp = s.num("integrity");
    if (s.num("aggression") >= 6 && hp >= 2000 && hp <= 20000 && Math.max(s.num("speed_land"), s.num("speed_air")) > 0) out.push(word);
  }
  return out.sort();
}
