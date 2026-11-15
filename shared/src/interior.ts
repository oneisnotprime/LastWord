import type { Stats } from "./stats.js";

/**
 * Walk-in buildings (TODO.md "Decided": buildings with interiors). A building big enough to walk
 * around in has an interior on the map, a disc around where it stands, with a door on its south
 * wall. Which buildings, read from the data the same way for every word:
 *
 * - `enterable` (characters can go inside), not `portable`, sheltering people (`occupants` 1 or
 *   more: a BAKERY or a SMITHY is a workplace, not a shelter) and at least INTERIOR_FROM tiles of
 *   `footprint` (a HUT or a SHED is a roof to duck under, not a room). A pile of them (`count`)
 *   is one bigger room. HOUSE, COTTAGE, CABIN, BARN, INN, CASTLE, PALACE, PRISON...
 *
 * Inside:
 * - Walls hide: nobody outside sees or strikes who and what is inside, unless they are on the
 *   building's owner's side (it is theirs), or see through walls (`sees_through` walls: a RADAR).
 *   Blows do not cross a wall either way; those inside see out.
 * - Things put down inside are kept from thieves: only someone inside can take, steal or break them.
 * - A roof: nothing from the sky or an area lands inside (shared hazard.ts).
 * - The door: its owner's side walks in and out freely; anyone else is stopped at the wall until
 *   the door is broken. The door takes DOOR_SHARE of the building's integrity, and every blow on
 *   the building from outside lands on the door first (a RAM's or DYNAMITE's `siege` counts). A
 *   broken door lets anyone in until it has mended all the way: it mends DOOR_MEND of itself a
 *   second while its owner's side is inside, no enemy is, and nobody has struck it for DOOR_QUIET
 *   seconds. A door counter carried or worn
 *   (`counters` door or lockable: a KEY, a THIEF, a BURGLAR, a RAM) breaks the door at a touch.
 */
export const INTERIOR_FROM = 3;
/** Share of a building's integrity its door has. */
export const DOOR_SHARE = 0.1;
/** Share of the door that mends a second with its owner's side inside and no enemy. */
export const DOOR_MEND = 0.02;
/** Seconds after the last blow on a door before it starts to mend. */
export const DOOR_QUIET = 5;
/** How near the wall (tiles) you count as beside the building: its roof is cut away for you. */
export const BESIDE_TILES = 1.5;

/** A building's room: its radius in tiles and its door's full integrity. */
export interface Interior { radius: number; door: number }

/** The room a building has, or null if it is not one you walk into (see the rule above). */
export function interiorOf(s: Stats, count = 1): Interior | null {
  if (!s.flag("enterable") || s.flag("portable") || s.flag("alive")) return null;
  if (!(s.num("occupants") >= 1)) return null;
  const n = Math.max(1, count), footprint = s.num("footprint") * n;
  if (!(footprint >= INTERIOR_FROM) || !Number.isFinite(footprint)) return null;
  return { radius: 0.5 + Math.sqrt(footprint) / 2, door: Math.max(1, s.num("integrity") * n * DOOR_SHARE) };
}

/** Where a room's door is: the middle of its south wall. */
export const doorAt = (x: number, y: number, radius: number) => ({ x, y: y + radius });

/** Whether a point is inside a room centred at (x, y). */
export const within = (p: { x: number; y: number }, x: number, y: number, radius: number) => Math.hypot(p.x - x, p.y - y) < radius;

/** Whether something's own properties open doors: its `counters` name doors or locks (a KEY, a RAM, a BURGLAR). */
export const opensDoors = (s: Stats): boolean => s.tags("counters").some((c) => c === "door" || c === "lockable" || c === "gate");

/** Whether its sight passes walls (`sees_through` walls: a RADAR, a SIXTH sense). */
export const seesThroughWalls = (s: Stats): boolean => s.tags("sees_through").includes("walls");

/** A room's lines for a card. */
export function interiorText(s: Stats, count = 1): string[] {
  const room = interiorOf(s, count);
  const out: string[] = [];
  if (room) {
    out.push(`walk-in: ${Math.round(room.radius * 2)} tiles across; inside, outsiders cannot see or strike you, and what you put down is safe from thieves`);
    out.push(`door ${Math.round(room.door)} HP: enemies must break it to get in (blows land on it first)`);
  }
  if (opensDoors(s)) out.push("breaks an enemy's door at a touch: walk in");
  if (seesThroughWalls(s)) out.push("sees who hides inside buildings");
  if (s.num("siege") > 1) out.push(`siege ×${+s.num("siege").toPrecision(2)}: its blows on buildings, walls and doors${s.num("attack_range") > 6 ? ", from afar" : ""}`);
  out.push(...guardText(s));
  return out;
}

/**
 * Door guards (theme 28, siege and arms): a thing that bars the way and locks (`lockable`, `blocks`
 * land; not a room itself, not alive, not carried: a PORTCULLIS, a DRAWBRIDGE, a GATE) put down in
 * its owner's walk-in building, or within BESIDE_TILES of its wall, is hung on that building's door:
 *
 * - the door gains the guard's integrity (GUARD_SHARE of it): blows must break the guard too;
 * - the door is bolted against the door counters the guard `counters` (a PORTCULLIS counters RAM:
 *   a RAM carried no longer opens it at a touch, it must batter); a breaker that `counters` the
 *   guard itself (a PETARD against a PORTCULLIS) still opens it at a touch;
 * - when the door breaks the guards hung on it break with it.
 *
 * Breaching events (`counters` door, gate or lockable, aimed at a spot: BREACH, ESCALADE) break
 * every enemy door within their reach the same way, bolts and all.
 */
export const GUARD_SHARE = 1;

/** Whether a thing is hung on a door when put down by a building of its owner's (see above). */
export function doorGuard(s: Stats): boolean {
  if (!s.flag("lockable") || s.flag("alive") || s.flag("portable") || s.flag("enterable")) return false;
  if (String(s.get("tile_type") ?? "none") !== "none") return false;
  return s.tags("blocks").includes("land");
}

/** The words (nouns and archetypes) a guard bolts its door against: those it `counters`. */
export const boltsAgainst = (guard: Stats): string[] => guard.tags("counters").map((c) => c.toLowerCase());

/**
 * Whether a breaker (named by its noun and archetype, with its own `counters`) opens a door at a
 * touch past the guards hung on it: every guard that bolts against it is one it counters itself.
 */
export function opensPast(breaker: { noun: string; archetype: string; counters: readonly string[] }, guards: readonly { noun: string; stats: Stats }[]): boolean {
  const mine = new Set(breaker.counters.map((c) => c.toLowerCase()));
  return guards.every((g) => {
    const bolts = boltsAgainst(g.stats);
    const barred = bolts.includes(breaker.noun) || bolts.includes(breaker.archetype);
    return !barred || mine.has(g.noun);
  });
}

/** A door guard's lines for a card. */
export function guardText(s: Stats): string[] {
  if (!doorGuard(s)) return [];
  const bolts = boltsAgainst(s);
  return [`hung on your walk-in building's door when put down in it: +${Math.round(s.num("integrity") * GUARD_SHARE)} door HP${bolts.length ? `; bolted against ${bolts.map((b) => b.toUpperCase()).join(", ")}` : ""}`];
}
