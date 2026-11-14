import { exposed } from "./home.js";
import type { Letters } from "./phrase.js";
import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";

/**
 * Law and government (dictionary theme 15). Laws over a place are `law`, `fine`, `tax_rate` and
 * `trade_rate` on any area (shared place.ts). Agreements between people are pacts:
 *
 * - A word with `binds` (TREATY, ALLIANCE, PACT, TRUCE) is cast on someone: its speller and up to
 *   `binds` - 1 people chosen are on one side for `event_duration` minutes (PACT_MINUTES if it
 *   says nothing). Their creatures leave each other alone and fight for the side.
 * - Ordering an attack on a member breaks the pact for everyone in it. The one who breaks it pays
 *   its `bind_penalty`: `letters` (BREACH_LETTERS of theirs go to those betrayed), `loyalty`
 *   (their creatures lose BREACH_LOYALTY), `morale` (theirs fall to nothing for a moment),
 *   `reputation` (markets ask them double for BREACH_MINUTES).
 * - Alliances must break: when everyone left alive is in one pact, it ends.
 */
export const PACT_MINUTES = 10;
export const BREACH_LETTERS = 6;
export const BREACH_LOYALTY = 3;
export const BREACH_MINUTES = 5;

export interface PactSpec {
  /** People it binds, its speller included. */
  size: number;
  minutes: number;
  penalty: string[];
}

/** The pact a word makes, or null if it binds nobody. */
export function pactOf(s: Stats): PactSpec | null {
  const n = Math.floor(s.num("binds"));
  if (!(n >= 2)) return null;
  const minutes = s.num("event_duration") > 0 ? s.num("event_duration") : PACT_MINUTES;
  return { size: Number.isFinite(n) ? n : 1000, minutes, penalty: s.tags("bind_penalty") };
}

/** What breaking a pact costs, in plain words. */
export function breachText(penalty: readonly string[]): string {
  const parts = penalty.map((p) =>
    p === "letters" ? `${BREACH_LETTERS} letters to those betrayed`
    : p === "loyalty" ? `${BREACH_LOYALTY} loyalty from each of your creatures`
    : p === "morale" ? "your creatures' morale"
    : p === "reputation" ? `double market prices for ${BREACH_MINUTES} min`
    : "").filter(Boolean);
  return parts.length ? parts.join(", ") : "nothing but trust";
}

/**
 * Takes `n` letters from a hand to pay a fine or a breach, the commonest first so a fine never
 * strips someone's one rare letter while they hold plenty of E. Returns what was taken.
 */
export function takeLetters(held: Letters, n: number, rng: Rng, stored = 0): string {
  let out = "";
  // What is stored (shared home.ts `storageOf`) is out of reach: only the rest can be taken.
  const reach = Math.min(n, exposed(held, stored));
  for (let i = 0; i < reach; i++) {
    const most = Math.max(0, ...Object.values(held));
    if (!(most > 0)) break;
    const top = Object.keys(held).filter((k) => held[k] === most).sort();
    const ch = top[Math.floor(rng() * top.length)]!;
    held[ch] = held[ch]! - 1;
    out += ch;
  }
  return out;
}
