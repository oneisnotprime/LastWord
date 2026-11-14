import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";

/**
 * Space and astronomy (dictionary theme 22). `gravity` on a body (a field's or buff's operation:
 * LEVITATION ×0.2, GRAVITY ×3) changes how it moves and fights: under 1 it bounds faster, its
 * shots carry farther and blows knock it back farther; under FLOAT_BELOW it floats over water and
 * walls; over 1 it plods and shoots short, and from GROUNDED_FROM nothing flies. `pull` draws
 * bodies toward a field's centre (negative pushes); `meteors` drops impacts inside a field.
 * `anchored` bodies are not moved by pull, knockback or waves.
 */

/** Below this gravity a body floats: it passes over water, walls and mountains like a flyer. */
export const FLOAT_BELOW = 0.3;
/** From this gravity nothing can fly. */
export const GROUNDED_FROM = 3;
/** The strongest gravity counted. */
export const GRAVITY_MAX = 10;
/** Metres a blow pushes a body in zero gravity for each point gravity is under 1, before dividing. */
export const LOW_G_PUSH = 4;

/** A body's gravity, 0 to GRAVITY_MAX (1 is ordinary ground). */
export function gravityOf(body: Stats): number {
  const g = body.num("gravity");
  if (!Number.isFinite(g)) return g > 0 ? GRAVITY_MAX : 0;
  return Math.min(GRAVITY_MAX, Math.max(0, g));
}

/** Multiplier on land speed: bounding in low gravity (up to 1.6 times), plodding in high (1/√g). */
export function gravitySpeed(g: number): number {
  return g < 1 ? 1 + 0.6 * (1 - g) : 1 / Math.sqrt(g);
}

/** Multiplier on a ranged weapon's reach: shots carry farther in low gravity (up to 2.5 times), shorter in high. */
export function gravityRange(g: number): number {
  return Math.min(2.5, 1 / Math.sqrt(Math.max(0.16, g)));
}

export const floats = (g: number): boolean => g < FLOAT_BELOW;
export const grounded = (g: number): boolean => g >= GROUNDED_FROM;

/**
 * Metres a landed blow pushes a body back: the attack's `knockback`, plus LOW_G_PUSH for each
 * point its gravity is under 1, divided by its gravity (at least 0.2). Nothing for an anchored body.
 */
export function knockbackOf(knockback: number, g: number, anchored: boolean): number {
  if (anchored) return 0;
  const push = Math.max(0, knockback) + (g < 1 ? LOW_G_PUSH * (1 - g) : 0);
  return push > 0 ? push / Math.max(0.2, g) : 0;
}

/** How many impacts land in `seconds` from a field dropping `perMinute`: the whole part, and the rest as a chance. */
export function impacts(perMinute: number, seconds: number, rng: Rng): number {
  const n = (Math.max(0, perMinute) * seconds) / 60;
  const whole = Math.floor(n);
  return whole + (rng() < n - whole ? 1 : 0);
}

/** Where an impact falls near a person: within `spread` tiles of them, uniformly over the disc. */
export function impactNear(x: number, y: number, spread: number, rng: Rng): { x: number; y: number } {
  const t = rng() * Math.PI * 2, d = Math.sqrt(rng()) * spread;
  return { x: x + Math.cos(t) * d, y: y + Math.sin(t) * d };
}

/** What a word does with gravity, pulls and impacts, in short lines for its card. */
export function spaceText(s: Stats): string[] {
  const out: string[] = [];
  const g = s.num("gravity");
  if (g !== 1 && Number.isFinite(g)) out.push(g < FLOAT_BELOW ? `gravity ×${+g.toFixed(2)}: floats` : `gravity ×${+g.toFixed(2)}`);
  if (s.num("pull") > 0) out.push(`pulls ${+s.num("pull").toFixed(1)} m/s to its centre`);
  if (s.num("pull") < 0) out.push(`pushes ${+(-s.num("pull")).toFixed(1)} m/s out`);
  if (s.num("meteors") > 0) out.push(`${+s.num("meteors").toFixed(1)} impacts a minute`);
  if (s.flag("anchored")) out.push("anchored: nothing moves it");
  return out;
}
