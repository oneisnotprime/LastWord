import type { Stats } from "./stats.js";

/**
 * Animals by family (dictionary theme 7). Animals already live in the biomes their `habitat`
 * names (shared biome.ts `wildlife`), pay H and their first letter when hunted (`huntYield`),
 * feed the hunter by their mass (`carcassFood`), carry riders (`mountable`), give food
 * (`food_output`: milk, eggs) and, kept, make I (tools/producers.txt). One rule is the herd's own:
 *
 * - breeding: two or more of one kind of creature of yours, fed and within HERD_RANGE of each
 *   other, have young at their `reproduction` a game hour, BREED_PACE times faster than life, one
 *   pair at a time: rabbits and hens fill a yard, cattle slowly. The young are yours while you can
 *   command them. Counter: hunger (a herd eats), your command limit, predators (WOLF, FOX), a
 *   PLAGUE, or hunting them for H.
 */

/** How much faster than real hours animals breed in a round. */
export const BREED_PACE = 10;
/** Tiles within which kept animals count as one herd. */
export const HERD_RANGE = 12;

/** Young a minute a herd of `n` with this `reproduction` (a game hour, per animal) has: one per pair. */
export function breedRate(reproduction: number, n: number): number {
  if (!(reproduction > 0) || n < 2) return 0;
  return (reproduction * BREED_PACE * Math.floor(n / 2)) / 60;
}

/** The herd's line for a card. */
export function herdText(s: Stats): string[] {
  const r = s.num("reproduction");
  if (!(r > 0) || !s.flag("alive")) return [];
  const perPair = breedRate(r, 2);
  const every = perPair > 0 ? 1 / perPair : Infinity;
  return [`breeds: two or more of yours, fed and together, have young about every ${every >= 1 ? `${+every.toFixed(1)} min` : `${Math.round(every * 60)} s`} a pair`];
}
