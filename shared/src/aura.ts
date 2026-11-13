import type { Stats } from "./stats.js";
import type { Op, Value } from "./types.js";
import { TILE_METERS } from "./world.js";

/**
 * What an object, a creature or a carried thing gives off around itself besides a field of its
 * own (`field_radius`): light, fear and healing. Each reaches whom its property says.
 */
export interface Aura {
  kind: "light" | "fear" | "heal";
  /** Metres. */
  radius: number;
  /** Who it reaches, as `field_targets`. */
  targets: string;
  set: Record<string, Value>;
  ops: Op[];
  /** Integrity a second it restores to whoever it reaches. */
  heals: number;
}

/**
 * The auras a thing gives off, from its properties:
 * - `luminosity` lights `luminosity` tiles around it: everyone there sees as if by day (night vision).
 * - `fear_aura` lowers the morale of enemies it can see by that much, as the FEAR field does.
 * - `heals` restores that much integrity a second to its own side in reach; a thing with a field
 *   of its own heals through that field instead.
 * "In sight" and "in reach" are its `field_radius` if it has one, else `sightM`, the sight of
 * whoever carries it (or its own).
 */
export function auras(stats: Stats, sightM: number): Aura[] {
  const out: Aura[] = [];
  const field = stats.num("field_radius");
  const reach = field > 0 ? field : sightM;
  const light = stats.num("luminosity");
  if (light > 0) out.push({ kind: "light", radius: light * TILE_METERS, targets: "all", set: { night_vision: true }, ops: [], heals: 0 });
  const fear = stats.num("fear_aura");
  if (fear > 0 && reach > 0) out.push({ kind: "fear", radius: reach, targets: "enemies", set: {}, ops: [["morale", "add", -fear]], heals: 0 });
  const heals = stats.num("heals");
  if (heals > 0 && !(field > 0) && reach > 0) out.push({ kind: "heal", radius: reach, targets: "allies", set: {}, ops: [], heals });
  return out;
}
