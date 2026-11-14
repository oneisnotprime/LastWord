import type { Stats } from "./stats.js";

/**
 * Why something cannot be ridden on land, or null if it can: a vehicle with no speed on land or in
 * the air (a BOAT, a WAGON that must be towed) would leave its rider stuck where they stand, so it
 * stays on the ground instead.
 */
export function cannotRide(stats: Stats, name: string): string | null {
  if (!stats.flag("mountable")) return `${name.toUpperCase()} cannot be ridden`;
  if (Math.max(stats.num("speed_land"), stats.num("speed_air")) > 0) return null;
  return `${name.toUpperCase()} cannot move on land: it stays on the ground`;
}
