import type { Letters } from "./phrase.js";
import type { Stats } from "./stats.js";
import type { Status } from "./status.js";

/**
 * Buildings, rooms and furniture (dictionary themes 3 and 4). Every building already claims ground
 * (`claim_radius`, shared sense.ts `claimOf`), shelters what is inside it (`cover`), radiates its
 * own fields (a LIBRARY's training, a HOSPITAL's healing, through `field_radius`) and makes letters
 * (a BARN's I, a BED's B, tools/producers.txt). Three rules are the home's own, each read from
 * properties the same way for every word:
 *
 * - comfort: what is `comfort`able (a BED, a SOFA, a FIREPLACE, a CAT) lifts the morale and the
 *   healing of its owner's side inside their claimed ground, by the square root of all of it
 *   (`homeComfort`). Counter: break or steal the furniture, or fight them away from home.
 * - storage: what keeps letters (`storage_letters`: a CHEST, a VAULT, a BANK, a WAREHOUSE) keeps
 *   that many of its owner's letters out of reach: thieves and fines take only the rest
 *   (`exposed`), and at its owner's death what was stored stays inside (`hoards`), the rarest
 *   letters first, for whoever takes or breaks it. Counter: raid the building itself (THEFT,
 *   ROBBERY), or break it.
 * - holding: something `lockable` with `security` and no comfort (a PRISON, a JAIL, a DUNGEON, a CAGE) holds the
 *   enemies in its claimed ground: their root and silence wear off `holdFactor` times slower, so an
 *   ARRESTed thief stays put. Counter: PARDON, ESCAPE or a key, or break the walls.
 */

/** Morale a side gains at home for each point of the square root of its comfort. */
export const COMFORT_MORALE = 1;
/** Integrity a second a side regains at home for each point of the square root of its comfort. */
export const COMFORT_REGEN = 0.25;

/** What one thing (or `count` of it) adds to its owner's comfort at home. */
export const comfortOf = (stats: Stats, count = 1): number => Math.max(0, stats.num("comfort")) * Math.max(1, count);

/** What a side's comfort at home does: morale and healing, by the square root of the sum (a palace is not a hundred cottages). */
export function homeComfort(total: number): { morale: number; regeneration: number } {
  const root = Math.sqrt(Math.max(0, total));
  return { morale: Math.round(COMFORT_MORALE * root * 100) / 100, regeneration: Math.round(COMFORT_REGEN * root * 100) / 100 };
}

/** Letters one thing (or `count` of it) keeps safe for its owner. */
export const storageOf = (stats: Stats, count = 1): number => (stats.num("storage_letters") > 0 ? stats.num("storage_letters") * Math.max(1, count) : 0);

const total = (held: Letters) => Object.values(held).reduce((n, k) => n + Math.max(0, k), 0);

/** How many of a hand's letters a thief or a fine can reach: those beyond what is stored. */
export function exposed(held: Letters, stored: number): number {
  return Math.max(0, total(held) - Math.max(0, stored));
}

/** Letters across the lexicon, rarest first: a store keeps the precious ones. */
export const RAREST = "qjzxkvwfbyhgpmudclsrtnoiae";

/**
 * A hand split at its owner's death: up to `stored` letters stay in the stores (the rarest
 * first), the rest are loose for the killer. Neither hand is the one given.
 */
export function keepSafe(held: Letters, stored: number): { kept: Letters; loose: Letters } {
  const kept: Letters = {}, loose: Letters = { ...held };
  let room = Math.max(0, Math.floor(stored));
  const order = [...RAREST, ...Object.keys(held).filter((k) => !RAREST.includes(k))];
  for (const ch of order) {
    if (!(room > 0)) break;
    const n = Math.min(room, Math.max(0, loose[ch] ?? 0));
    if (!n) continue;
    kept[ch] = n; loose[ch] = (loose[ch] ?? 0) - n; room -= n;
  }
  for (const k of Object.keys(loose)) if (!(loose[k]! > 0)) delete loose[k];
  return { kept, loose };
}

/**
 * Shares out letters kept at death among the stores that kept them, in proportion to what each
 * stores (`capacity`, in the same order): the biggest gets any remainder. Returns a string of
 * letters per store.
 */
export function hoards(kept: Letters, capacity: readonly number[]): string[] {
  const out = capacity.map(() => "");
  const sum = capacity.reduce((n, c) => n + Math.max(0, c), 0);
  if (!(sum > 0)) return out;
  const letters = Object.entries(kept).flatMap(([ch, n]) => ch.repeat(Math.max(0, n)).split(""));
  let i = 0;
  capacity.forEach((c, k) => {
    const share = Math.floor((letters.length * Math.max(0, c)) / sum);
    out[k] = letters.slice(i, i + share).join("");
    i += share;
  });
  const biggest = capacity.indexOf(Math.max(...capacity));
  out[biggest] += letters.slice(i).join("");
  return out;
}

/** The statuses a lockup holds. */
export const HELD: readonly Status[] = ["root", "silence"];

/** Security from which something lockable and without comfort is a lockup (a JAIL, a CAGE), not a home with a door. */
export const HOLD_FROM = 5;

/**
 * How many times slower a lockup's enemies' root and silence wear off: one more than its
 * `security`, if it is `lockable` with at least HOLD_FROM and no `comfort` (a lockup is no home);
 * 1 (no hold) otherwise.
 */
export function holdFactor(stats: Stats): number {
  if (!stats.flag("lockable") || stats.num("security") < HOLD_FROM || stats.num("comfort") > 0) return 1;
  return 1 + Math.max(0, stats.num("security"));
}

/** A home's own lines for a card: comfort, storage, holding. */
export function homeText(s: Stats): string[] {
  const out: string[] = [];
  const c = comfortOf(s);
  if (c > 0) {
    const h = homeComfort(c);
    out.push(`comfort ${+c.toFixed(1)}: inside your claimed ground your side's morale +${h.morale}, healing +${h.regeneration}/s (all your comfort there adds, by its square root)`);
  }
  const kept = storageOf(s);
  if (kept > 0) out.push(`keeps ${Math.round(kept)} of your letters safe from thieves and fines; if you die they stay inside for whoever takes or breaks it`);
  const hold = holdFactor(s);
  if (hold > 1 && s.num("claim_radius") > 0) out.push(`holds enemies in its claimed ground: their root and silence last ×${+hold.toFixed(1)}`);
  return out;
}
