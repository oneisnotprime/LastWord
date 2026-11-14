import type { Stats } from "./stats.js";
import { GRAFT_CAPABILITIES } from "./body.js";
import { Tile, TILE_METERS } from "./world.js";

/**
 * Clothing and fashion (dictionary theme 10). Three rules of what is worn:
 *
 * - lending: a thing worn on the body (head, face, neck, body, back, hands, feet, finger, graft;
 *   not held, not protection, which is a layer of its own) lends its wearer its `LENT_ADD`
 *   properties (armour, resistances, stealth, disguise, noise), its immunities (`immune_*`) and
 *   its camouflage. A COAT's res_cold keeps its wearer warm, a CAPE's stealth hides them.
 * - warmth: the air at a spot is AIR_BASE C, moved by the biome (`BIOME_AIR`: tundra and snow
 *   cold, desert and ash hot), night (NIGHT_AIR), the weather and fields in force (their
 *   `temperature_delta`: a BLIZZARD, WINTER, a HEATWAVE) and fires near by (WARMTH_NEAR). Colder than
 *   a body's `temp_min` it takes CHILL cold damage a second a degree (res_cold applies); hotter than
 *   its `temp_max`, fire damage (`exposure`). Warm clothes lower temp_min (a COAT −25): dress for a
 *   BLIZZARD or freeze in it.
 * - disguise: a body worn with `disguise` (a COSTUME, a UNIFORM, a MASK) looks like one of another
 *   side. Creatures of other sides, wild animals and bots leave its wearer be (`disguised`) until it
 *   strikes (UNMASKED_SECONDS); an observer sees through it with `detect_stealth` at least as high
 *   (a SPOTLIGHT, UNMASK, a DETECTIVE) or a nose (`smell_range`) within reach (a DOG, a HOUND).
 */

/** Numeric properties a worn thing adds to its wearer. */
export const LENT_ADD = ["armor", "stealth", "detect_stealth", "disguise", "loudness", "charm", "intimidation", "evasion", "reflect", "thorns"] as const;
/** Slots whose things are worn on the body (and so lend). */
export const WORN_SLOTS = ["head", "face", "neck", "body", "back", "hands", "feet", "finger", "graft"];

/** True if a thing lends to whoever wears it: worn in a body slot, and not a protection layer. */
export function lends(item: Stats, archetype: string | undefined): boolean {
  return WORN_SLOTS.includes(String(item.get("equip_slot"))) && archetype !== "protection";
}

/**
 * Puts what a worn thing lends onto its wearer's body. A graft also gives its capabilities
 * (shared body.ts). `count` is how many are worn.
 */
export function lend(body: Stats, item: Stats, count = 1): void {
  for (const [id, v] of item.entries()) {
    if (typeof v === "number" && v !== 0 && ((LENT_ADD as readonly string[]).includes(id) || id.startsWith("res_"))) {
      const now = body.get(id);
      if (now === "ABS") continue;
      body.set(id, (typeof now === "number" ? now : 0) + v * (id.startsWith("res_") ? 1 : Math.max(1, count)));
    } else if (v === "ABS" && ((LENT_ADD as readonly string[]).includes(id) || id.startsWith("res_"))) body.set(id, "ABS");
    else if (id.startsWith("immune_") && v === true) body.set(id, true);
  }
  const camo = item.tags("camouflage");
  if (camo.length) body.set("camouflage", [...new Set([...body.tags("camouflage"), ...camo])]);
  if (item.get("equip_slot") !== "graft") return;
  for (const c of GRAFT_CAPABILITIES) {
    const v = item.get(c);
    if (c === "sees_through") { if (item.tags(c).length) body.set(c, [...new Set([...body.tags(c), ...item.tags(c)])]); }
    else if (c === "breathes") { if (v !== "air" && body.get(c) !== v) body.set(c, "both"); }
    else if (v === true) body.set(c, true);
  }
}

// ---- warmth

/** Air temperature, C, on ordinary ground by day. */
export const AIR_BASE = 20;
/** How much colder the night is. */
export const NIGHT_AIR = -8;
/** How much warmer the air is within WARM_RANGE tiles of a fire (something at WARM_FROM C or more). */
export const WARMTH_NEAR = 25;
export const WARM_RANGE = 4;
export const WARM_FROM = 60;
/** Damage a second per degree past what a body bears. */
export const CHILL = 0.25;

/** How each biome moves the air from AIR_BASE. */
export const BIOME_AIR: Partial<Record<Tile, number>> = {
  [Tile.Tundra]: -15, [Tile.Snow]: -20, [Tile.Taiga]: -8, [Tile.Hill]: -3, [Tile.Desert]: 18, [Tile.Ash]: 18,
  [Tile.Savanna]: 8, [Tile.Jungle]: 8, [Tile.Badlands]: 10, [Tile.Swamp]: 4, [Tile.Marsh]: 2,
};

/** The air at a spot: its biome, the night, what the weather and fields in force add, a fire near by. */
export function airAt(tile: Tile, night: boolean, deltas: number, fireNear: boolean): number {
  return AIR_BASE + (BIOME_AIR[tile] ?? 0) + (night ? NIGHT_AIR : 0) + deltas + (fireNear ? WARMTH_NEAR : 0);
}

/** Damage a second the air does a body: cold below its temp_min, fire above its temp_max. Null if it bears it. */
export function exposure(body: Stats, air: number): { type: "cold" | "fire"; amount: number; by: number } | null {
  if (!body.flag("alive")) return null;
  const low = body.num("temp_min"), high = body.num("temp_max");
  if (air < low) return { type: "cold", amount: Math.round((low - air) * CHILL * 100) / 100, by: Math.round(low - air) };
  if (air > high) return { type: "fire", amount: Math.round((air - high) * CHILL * 100) / 100, by: Math.round(air - high) };
  return null;
}

// ---- disguise

/** Seconds a disguise is off after its wearer strikes. */
export const UNMASKED_SECONDS = 15;

/**
 * True if an observer is fooled by a body's disguise at `tiles` apart: the body is disguised, and
 * the observer's detect_stealth is lower and no nose of its reaches (smell_range, metres).
 */
export function disguised(target: Stats, observer: Stats, tiles: number): boolean {
  const d = target.num("disguise");
  if (!(d > 0)) return false;
  if (observer.num("detect_stealth") >= d) return false;
  return !(observer.num("smell_range") / TILE_METERS >= tiles);
}

/** Clothing's lines for a card. */
export function wearText(s: Stats): string[] {
  const out: string[] = [];
  const d = s.num("disguise");
  if (d > 0) out.push(`disguise ${Number.isFinite(d) ? d : "total"}: worn, enemies' creatures, wild animals and bots take you for one of theirs until you strike; seen through by detect stealth ${Number.isFinite(d) ? d : "total"} or a nose`);
  if (WORN_SLOTS.includes(String(s.get("equip_slot"))) && s.num("res_cold") > 0) out.push(`worn, keeps out ${Math.round(s.num("res_cold") * 100)}% of the cold`);
  return out;
}
