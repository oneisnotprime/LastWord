import type { Stats } from "./stats.js";
import { SEES_THROUGH } from "./crime.js";

/**
 * Communication and information (dictionary theme 18): seeing and faking what others know.
 *
 * - exposure: a status (`expose`, shared status.ts). The exposed show on the threat arrows of every
 *   person of another side within EXPOSED_TILES (the whole map, nearly), and their stealth and
 *   disguise do nothing (a FLARE, a WANTED poster, GOSSIP, a TRACKER).
 * - reading: `read_inventory` passed on a person tells its speller every letter and thing they hold
 *   (ESPIONAGE, SNOOPING, an AUDIT: `readout`). `immune_expose` (a CIPHER, ENCRYPTION) keeps both off.
 * - decoys: a field with `decoys` puts that many made-up people closing in on the threat arrows and
 *   minimaps of everyone it reaches (PROPAGANDA, a RUMOR, a HOAX): `decoyAt` places each, drifting.
 *   Whoever has detect_stealth SEES_THROUGH or more is not fooled (TRUTH, a DETECTIVE).
 * - jamming: a field with `jams` blacks out the minimap, the watching things and the senses of
 *   everyone it reaches (a JAMMER, STATIC, CENSORSHIP).
 */

/** Tiles within which the exposed show on enemies' threat arrows. */
export const EXPOSED_TILES = 400;
/** Seconds a decoy takes to circle once round whoever it fools. */
export const DECOY_LAP = 120;

/** True if a viewer is fooled by decoys. */
export const fooledByDecoys = (viewer: Stats): boolean => viewer.num("detect_stealth") < SEES_THROUGH;

/** Small stable hash of a string, for placing decoys. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Where decoy `i` of an area (`key`) stands for a viewer at `at`, `t` seconds into the round: on a
 * ring 12 to 30 tiles out, closing in and drifting round, so it looks like someone coming.
 */
export function decoyAt(key: string, i: number, at: { x: number; y: number }, t: number): { x: number; y: number } {
  const h = hash(`${key}:${i}`);
  const angle = h * Math.PI * 2 + (t / DECOY_LAP) * Math.PI * 2 * (h < 0.5 ? 1 : -1);
  const phase = ((t + h * 40) % 40) / 40; // comes in from 30 tiles to 12, then starts again
  const d = 30 - 18 * phase;
  return { x: at.x + Math.cos(angle) * d, y: at.y + Math.sin(angle) * d };
}

/** What someone holds, in one line: "letters A×3 E×5 · gear SWORD, COAT". */
export function readout(letters: Record<string, number>, gear: readonly string[]): string {
  const held = Object.entries(letters).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b))
    .map(([ch, n]) => `${ch.toUpperCase()}${n > 1 ? `×${n}` : ""}`);
  return `letters ${held.length ? held.join(" ") : "none"}${gear.length ? ` · gear ${gear.map((g) => g.toUpperCase()).join(", ")}` : ""}`;
}

/** Information's lines for a card. */
export function signalText(s: Stats): string[] {
  const out: string[] = [];
  if (s.num("inflict_expose") > 0) out.push("exposes: shows them on every enemy's threat arrows, with no stealth or disguise");
  if (s.flag("read_inventory")) out.push("reads every letter and thing the one it lands on holds");
  if (s.num("decoys") > 0) out.push(`puts ${s.num("decoys")} made-up people on the threat arrows and minimaps of those it reaches (detect stealth ${SEES_THROUGH} sees through)`);
  if (s.flag("jams")) out.push("jams: blacks out the minimap and watching things of those it reaches");
  if (s.flag("immune_expose")) out.push("cannot be exposed or read");
  return out;
}
