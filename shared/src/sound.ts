import type { Stats } from "./stats.js";
import { TILE_METERS } from "./world.js";

/**
 * Music and sound (dictionary theme 14). Noise is `loudness` (on a body, worn or held: a DRUM, a
 * SIREN, ARMOR's clank). Three rules:
 *
 * - giving yourself away: a walker making HEARD_FROM loudness or more shows on the threat arrows of
 *   every person of another side within earshot (`earshot`: EARSHOT tiles a point of loudness,
 *   plus the listener's `hearing_range`), wherever they look. SILENCE, a MUFFLER or STEALTH quiet it.
 * - deafness: the deaf (`deaf`, shared status.ts: a BLAST, a GONG, EARPLUGS worn give its
 *   immunities) hear nothing: no threat sounds, no orders for a deaf creature, and no song reaches
 *   them (charm and sleep, `UNHEARD`).
 * - songs: music words are fields: they lift their side's morale and courage, lull enemies to
 *   sleep, or charm the living, which wins wild animals over (shared emotion.ts). Counter: EARPLUGS,
 *   SILENCE, NOISE.
 */

/** Loudness from which a walker gives itself away. */
export const HEARD_FROM = 3;
/** Tiles of earshot a point of loudness carries. */
export const EARSHOT = 8;

/** Tiles away a listener with this `hearing_range` (metres) hears something this loud, or 0. */
export function earshot(loudness: number, hearing: number): number {
  if (!(loudness >= HEARD_FROM) || !(hearing > 0)) return 0;
  return Number.isFinite(loudness) ? loudness * EARSHOT + hearing / TILE_METERS : Infinity;
}

/** Sound's lines for a card. */
export function soundText(s: Stats): string[] {
  const out: string[] = [];
  const loud = s.num("loudness");
  if (loud >= HEARD_FROM) out.push(`loud (${Number.isFinite(loud) ? loud : "total"}): gives away where its maker is to everyone within ${Number.isFinite(loud) ? `${loud * EARSHOT} tiles` : "earshot"}`);
  if (s.num("inflict_deaf") > 0) out.push("deafens: the deaf hear no orders and no songs");
  return out;
}
