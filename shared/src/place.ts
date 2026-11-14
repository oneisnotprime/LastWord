import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import type { Op, WordDef } from "./types.js";

/**
 * What an area does to the letters earned and the acts done inside it (PLAN.md "Letter
 * economy": letter production depends on world quantities). Any word's area can carry these:
 * an event (WAR), a field (DROUGHT, TITHE), weather (MONSOON), or an object that radiates one.
 *
 * - `yields`: the word's own `produce_<L>` operations act on every <L> earned inside (gathered,
 *   produced, won in a kill, paid for a deed); `harvest_bonus` operations on every letter.
 * - `growth`: how fast picked ground grows back (RAIN 1.5, DROUGHT 0.1, BLIGHT 0).
 * - `deposits`: when it begins, ground deposits inside are multiplied by this (0 empties them).
 * - `tax`: the share of letters others earn inside that goes to its maker (`tax_rate`).
 * - `lode`: letters gathering inside turns up, at `lodeShare` a gathering, `lodeStock` in all.
 * - `tradeRate`: markets inside ask this times their usual letters for one.
 * - `law`: acts nobody it reaches may do inside (attack, gather, spell, trade, theft).
 */
export interface PlaceRules {
  yields: Record<string, { mul: number; add: number }>;
  growth: number;
  deposits: number;
  tax: number;
  lode: string[];
  lodeShare: number;
  lodeStock: number;
  tradeRate: number;
  law: string[];
}

/** Acts a `law` can forbid, and how each reads. */
export const LAWS: Readonly<Record<string, string>> = {
  attack: "no fighting",
  gather: "no gathering",
  spell: "no spelling",
  trade: "markets closed",
  theft: "no stealing",
};

/** The rules a word's area carries, or null if it changes nothing about letters or acts. */
export function placeRules(def: WordDef, s: Stats): PlaceRules | null {
  const yields: PlaceRules["yields"] = {};
  const fold = ([id, op, amount]: Op) => {
    const key = id === "harvest_bonus" ? "*" : /^produce_[A-Z]$/.test(id) ? id.slice(8).toLowerCase() : null;
    if (!key) return;
    const y = (yields[key] ??= { mul: 1, add: 0 });
    if (op === "mul") y.mul *= amount;
    else y.add += amount;
  };
  def.ops.forEach(fold);
  const num = (id: string) => {
    const n = s.num(id);
    return Number.isFinite(n) ? n : 0;
  };
  const rules: PlaceRules = {
    yields,
    growth: s.num("growth"),
    deposits: s.num("deposit_factor"),
    tax: Math.min(1, num("tax_rate")),
    lode: s.tags("lode").filter((l) => /^[a-z]$/.test(l)),
    lodeShare: Math.min(1, num("lode_share")),
    lodeStock: s.num("lode_stock"),
    tradeRate: s.num("trade_rate"),
    law: s.tags("law").filter((l) => l in LAWS),
  };
  const changes = Object.keys(yields).length || rules.growth !== 1 || rules.deposits !== 1 || rules.tax > 0 ||
    (rules.lode.length && rules.lodeShare > 0) || rules.tradeRate !== 1 || rules.law.length;
  return changes ? rules : null;
}

/** The combined multiplier and bonus on one letter from every rule in force at a place. */
export function yieldOf(letter: string, rules: readonly PlaceRules[], bonus = 1): { mul: number; add: number } {
  let mul = bonus, add = 0;
  for (const r of rules) {
    for (const key of [letter, "*"]) {
      const y = r.yields[key];
      if (y) { mul *= y.mul; add += y.add; }
    }
  }
  return { mul: Math.max(0, mul), add };
}

/**
 * Letters earned at a place once its rules have acted: each letter becomes `mul` (+`add`) of
 * itself, a fraction as a chance of one more. `bonus` is the earner's own `harvest_bonus`.
 */
export function harvest(letters: string, rules: readonly PlaceRules[], rng: Rng, bonus = 1): string {
  if (!rules.length && bonus === 1) return letters;
  let out = "";
  for (const ch of letters) {
    const { mul, add } = yieldOf(ch, rules, bonus);
    const n = Math.max(0, mul + add);
    const whole = Math.floor(n);
    out += ch.repeat(whole + (rng() < n - whole ? 1 : 0));
  }
  return out;
}

/** Growth of picked ground at a place: the product of every rule's growth. */
export function growthOf(rules: readonly PlaceRules[]): number {
  return rules.reduce((g, r) => g * r.growth, 1);
}

/** Letters a market at a place asks for one, as a multiple of the usual. */
export function tradeRateOf(rules: readonly PlaceRules[]): number {
  return rules.reduce((g, r) => g * r.tradeRate, 1);
}

/** The first rule forbidding an act at a place, if any. */
export function forbids(rules: readonly PlaceRules[], act: keyof typeof LAWS | string): boolean {
  return rules.some((r) => r.law.includes(act));
}

const fmt = (n: number) => (Number.isFinite(n) ? String(+n.toFixed(2)) : "total");

/** What the rules change, in plain short lines: "A ×0", "picked ground grows back ×0.1", "no fighting". */
export function rulesText(r: PlaceRules): string[] {
  const out: string[] = [];
  const ys = Object.entries(r.yields).map(([k, y]) => {
    const name = k === "*" ? "all letters" : k.toUpperCase();
    return [y.mul !== 1 ? `${name} ×${fmt(y.mul)}` : "", y.add ? `${name} ${y.add > 0 ? "+" : "−"}${fmt(Math.abs(y.add))}` : ""].filter(Boolean).join(" ");
  }).filter(Boolean);
  if (ys.length) out.push(`letters earned here: ${ys.join(", ")}`);
  if (r.growth !== 1) out.push(r.growth === 0 ? "picked ground never grows back" : `picked ground grows back ×${fmt(r.growth)}`);
  if (r.deposits !== 1) out.push(r.deposits === 0 ? "strips the ground bare as it begins" : `ground deposits ×${fmt(r.deposits)} as it begins`);
  if (r.tax > 0) out.push(`${Math.round(r.tax * 100)}% of letters others earn here go to its maker`);
  if (r.lode.length && r.lodeShare > 0) {
    out.push(`gathering here finds ${r.lode.map((l) => l.toUpperCase()).join("/")} ${Math.round(r.lodeShare * 100)}% of the time${r.lodeStock > 0 && Number.isFinite(r.lodeStock) ? ` (${r.lodeStock} in all)` : ""}`);
  }
  if (r.tradeRate !== 1) out.push(`markets ask ${fmt(3 * r.tradeRate)} letters for 1`);
  for (const l of r.law) out.push(LAWS[l]!);
  return out;
}
