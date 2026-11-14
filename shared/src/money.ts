import type { Stats } from "./stats.js";
import type { Affliction } from "./status.js";

/**
 * Money and trade (dictionary theme 16). Money is letters. Four rules:
 *
 * - paying: a word's `pays` hands that many of its speller's letters, commonest first, to whoever
 *   it lands on (a GIFT, a WAGE, a TIP on a person). A BRIBE (`transfers_ownership`,
 *   `contest_with` pays) buys a creature, wild or someone's, when what it pays meets its loyalty:
 *   the word's own `pays` counts as the speller's side of the contest (`contestOf`), and the price
 *   is spent. A spelling that pays needs the letters on top of its own (`canPay`).
 * - debt: a status (`debt`, shared status.ts). The debtor pays whoever put it on them (their
 *   master, for a creature) a letter every DEBT_SECONDS, commonest first, for as long as it runs
 *   (`debtDue`). A LOAN pays first and puts a longer debt on. A thing or creature of a debtor's has
 *   no security against their creditor (`owesTo`): FORECLOSURE and THEFT take it. BANKRUPTCY ends
 *   debts; security (a GUARD) resists them.
 * - interest: a store (`storage_letters`) with `interest` earns its owner that share of the letters
 *   it keeps safe a minute, as T (`interestDue`): a BANK 2%, a TREASURY 3%.
 * - markets: `trade_rate` (letters a market asks for one) and T for trading, on areas (place.ts).
 */

/** Seconds a debtor takes to pay one letter. */
export const DEBT_SECONDS = 10;

/**
 * Letters a debt has come to after `seconds` more of it: whole letters, with the part of a letter
 * left kept on the affliction for next time.
 */
export function debtDue(a: Affliction, seconds: number): number {
  if (!(seconds > 0)) return 0;
  const run = (a.owing ?? 0) + Math.min(seconds, Math.max(0, a.left + seconds));
  const due = Math.floor(run / DEBT_SECONDS);
  a.owing = run - due * DEBT_SECONDS;
  return due;
}

/** True if someone with these statuses owes `creditor` (or any of `side`). */
export function owesTo(statuses: readonly Affliction[], side: readonly string[]): boolean {
  return statuses.some((a) => a.status === "debt" && side.includes(a.from));
}

/**
 * The speller's side of a contest: their own body's property, or the word's own value of it when
 * the word carries one (a BRIBE's `pays` against a creature's loyalty).
 */
export function contestOf(speller: Stats, word: Stats, property: string): number {
  return Math.max(speller.num(property), word.num(property));
}

/** Letters a spelling that pays needs on top of its own, or "" if they are there. */
export function canPay(held: Record<string, number>, cost: number, pays: number): string {
  if (!(pays > 0)) return "";
  const have = Object.values(held).reduce((a, n) => a + Math.max(0, n), 0);
  return have - cost >= Math.ceil(pays) ? "" : `it pays ${Math.ceil(pays)} letters on top of its own, and you hold ${Math.max(0, have - cost)} more`;
}

/** T a store earns over `seconds`: `stored` letters at `interest` a minute. */
export function interestDue(stored: number, interest: number, seconds: number): number {
  if (!(stored > 0) || !(interest > 0)) return 0;
  return (stored * interest * seconds) / 60;
}

/** Money's lines for a card. */
export function moneyText(s: Stats): string[] {
  const out: string[] = [];
  const pays = s.num("pays");
  if (pays > 0) {
    out.push(s.flag("transfers_ownership") && s.get("contest_with") === "pays"
      ? `buys a creature whose loyalty is ${Math.ceil(pays)} or less, wild or someone's, for ${Math.ceil(pays)} of your commonest letters`
      : `pays ${Math.ceil(pays)} of your commonest letters to whoever it lands on`);
  }
  if (s.num("inflict_debt") > 0) out.push(`puts them in debt: they pay you a letter every ${DEBT_SECONDS} s, and their things have no security against you`);
  if (s.num("interest") > 0) out.push(`earns its owner ${+(s.num("interest") * 100).toFixed(1)}% of the letters it keeps safe a minute, as T`);
  if (s.tags("effect_status").includes("debt")) out.push("ends debts");
  return out;
}
