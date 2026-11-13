import type { Pt } from "./util.js";
import { circle } from "./util.js";

/**
 * Archetype silhouettes in scene pixels, facing right, origin at the feet (y up is negative).
 * Ink, neon and paper share them: one shape per archetype, styled differently. A new word of
 * the same archetype reuses the shape with its own size, tint and label.
 */

export const wolf = {
  body: [[29, -20], [25, -23], [20, -25], [17, -30], [16, -37], [13, -30], [10, -36], [8, -28], [3, -25], [-6, -26], [-16, -25], [-23, -22],
    [-28, -21], [-35, -15], [-40, -7], [-35, -8], [-30, -14], [-25, -16], [-22, -13], [-18, -7], [-20, 0], [-15, 0], [-13, -8], [-12, -13],
    [-3, -12], [7, -13], [9, -8], [9, 0], [14, 0], [13, -9], [15, -16], [19, -18], [24, -17], [28, -18]] as Pt[],
  farLegs: [[[-15, -14], [-11, -7], [-12, 0], [-8, 0], [-6, -8], [-7, -13]], [[3, -13], [2, 0], [6, 0], [7, -12]]] as Pt[][],
  eye: [18, -27] as Pt,
};

export const dragonBody: Pt[] = [[54, -6], [47, -10], [41, -13], [37, -24], [34, -14], [29, -12], [22, -7], [13, -3], [0, -1], [-14, -1], [-26, 1],
  [-40, -1], [-52, -7], [-60, -6], [-68, -12], [-66, -1], [-60, 3], [-50, 4], [-38, 8], [-24, 10], [-12, 12], [-9, 17], [-13, 25], [-6, 25], [-2, 16],
  [8, 12], [11, 17], [9, 23], [16, 23], [17, 14], [23, 6], [30, 1], [38, -1], [45, -2], [52, -3]];

/** The wing for a flap in [-1, 1]: 1 is fully up. */
export function dragonWing(f: number): Pt[] {
  const k = 0.75 + 0.3 * f;
  return [[6, -3], [16, -30 * k], [8, -54 * k], [-2, -34 * k], [-12, -46 * k], [-17, -28 * k], [-30, -36 * k], [-25, -12 * k], [-16, -3]];
}

export const dragonEye: Pt = [42, -8];

export const human = {
  body: [[-3, -28], [3, -28], [9, -25], [12, -15], [9, -14], [7, -20], [7, -11], [5, -11], [5, 0], [1, 0], [1, -9], [-1, -9], [-1, 0], [-5, 0],
    [-5, -11], [-8, -11], [-7, -20], [-8, -14], [-11, -15], [-9, -25]] as Pt[],
  head: circle(0, -34, 6, 14),
  hand: [11, -15] as Pt,
};

/** A sword with its grip at the origin, blade up. */
export const sword = {
  blade: [[-2, -4], [2, -4], [2, -27], [0, -32], [-2, -27]] as Pt[],
  guard: [[-7, -2], [7, -2], [7, -5], [-7, -5]] as Pt[],
  grip: [[-1.2, 4], [1.2, 4], [1.2, -2], [-1.2, -2]] as Pt[],
  pommel: circle(0, 5, 2, 8),
};

export const chest = {
  body: [[-15, -15], [15, -15], [15, 0], [-15, 0]] as Pt[],
  lid: [[-15, -15], [-14, -21], [-9, -25], [0, -26], [9, -25], [14, -21], [15, -15]] as Pt[],
};

/** Positions of `n` ants in a swarm: a dense core thinning out, with a bit of drift by time. */
export function swarm(n: number, r: number, t: number, seed = 7): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i * 2.399963) % (Math.PI * 2)) + Math.sin(t * 0.7 + i) * 0.15;
    const d = Math.sqrt((i + 0.5) / n) * r * (0.85 + 0.3 * Math.sin(i * 12.9898 + seed));
    out.push([Math.cos(a) * d + Math.sin(t * 3 + i * 1.7) * 1.5, Math.sin(a) * d * 0.75 + Math.cos(t * 2.6 + i * 0.9) * 1.5]);
  }
  return out;
}
