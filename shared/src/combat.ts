import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import { susceptibility } from "./material.js";
import { affinity, affOf, type Aff } from "./affinity.js";

/** Something in the world that can hit or be hit. */
export interface Entity {
  name: string;
  stats: Stats;
  /** Current integrity; starts at the integrity property. */
  integrity: number;
  /** Current shield pool. */
  shield: number;
  /** Seconds until its next strike. */
  cooldown: number;
}

export function spawn(name: string, stats: Stats): Entity {
  return {
    name,
    stats,
    integrity: stats.num("integrity"),
    shield: stats.num("shield_pool"),
    cooldown: stats.num("attack_windup"),
  };
}

export const destroyed = (e: Entity): boolean => e.integrity <= 0;

/**
 * How blows and bodies are felt: in full up to FELT_KNEE (about a person's scale), and by the
 * square root of how far past it they go. A COLOSSUS's 7,000 crush is felt as 837, not 7,000; a
 * BEHEMOTH's 250,000 integrity as 5,000. The order stays (bigger still wins), but a fight is no
 * longer a lookup across five orders of magnitude.
 */
export const FELT_KNEE = 100;
/** Share of a blow's felt size that lands: what sets how long fights last (5 to 15 s between people). */
export const FIGHT_PACE = 0.5;

/** A blow's or a body's felt size (see FELT_KNEE). */
export function felt(x: number): number {
  return x > FELT_KNEE && x !== Infinity ? FELT_KNEE * Math.sqrt(x / FELT_KNEE) : x;
}

/**
 * A number of damage, HP or integrity as cards and tips show it: its felt size, so a NUKE's
 * 7,500,000 reads 27k against a DRAGON's 2.4k HP, the ratio blows really land in (FIGHT_PACE
 * scales every blow alike). Under FELT_KNEE it is the number itself.
 */
export const shown = (x: number): number => felt(Math.max(0, x));

/**
 * What a blow of `damage` (after resistances and armour) takes off a body whose full integrity is
 * `max`: its felt size times FIGHT_PACE, in the body's own units (a body felt smaller than it is
 * loses as much more). Hits to destroy it go as felt(max) / felt(damage), not max / damage.
 */
export function landed(damage: number, max: number): number {
  if (!(damage > 0)) return 0;
  if (damage === Infinity) return Infinity;
  const scale = max > FELT_KNEE && max !== Infinity ? max / felt(max) : 1;
  return FIGHT_PACE * felt(damage) * scale;
}

/** A blow that would take at least this share of its target's full integrity is telegraphed. */
export const HEAVY_SHARE = 0.25;
/** Seconds a heavy blow winds up before it lands (plus the weapon's own `attack_windup`). */
export const WINDUP_SECONDS = 1.2;
/** A target that has moved this many tiles from where it stood when a heavy blow began is missed. */
export const DODGE_TILES = 1.2;

/**
 * Seconds a blow from `attack` on `target` winds up before it lands, or 0 for an ordinary blow:
 * a heavy one (its likely damage at least HEAVY_SHARE of the target's full integrity, before
 * resistances) or a weapon with its own `attack_windup` is shown coming, and can be stepped out of.
 */
export function windupOf(attack: Stats, target: Entity): number {
  const own = attack.num("attack_windup");
  if (attack.flag("single_use")) return 0; // a bomb's windup is its fuse (`tick`)
  let raw = 0;
  for (const type of damageTypes(attack)) raw += Math.max(0, attack.num(`dmg_${type}`));
  if (raw === Infinity) return WINDUP_SECONDS + (own > 0 && own !== Infinity ? own : 0);
  raw = Math.max(0, raw - target.stats.num("armor"));
  const max = target.stats.num("integrity");
  const heavy = max !== Infinity && landed(raw, max) >= HEAVY_SHARE * max;
  return heavy || own > 0 ? WINDUP_SECONDS + (own > 0 && own !== Infinity ? own : 0) : 0;
}

function damageTypes(stats: Stats): string[] {
  return stats.entries().map(([id]) => id).filter((id) => id.startsWith("dmg_")).map((id) => id.slice(4));
}

export interface Strike {
  hit: boolean;
  critical: boolean;
  damage: number;
  /** Damage by type after resistances, before armor. */
  byType: Record<string, number>;
  /** How the blow met its target's natures and resistances (shared affinity.ts): "weak", "resist", "immune" or "". */
  aff?: Aff;
  /**
   * The share of the blow (as raw damage, 0 to 1) left over when it broke what it struck: what a
   * layer could not take carries through to the next (shared unit.ts `strikeLayers`).
   */
  carry?: number;
}

/**
 * How a blow is met, for battle rounds (shared battle.ts): `pace` multiplies what lands (a
 * defender takes half; fatigue adds to every blow), `block` is added to the target's block.
 */
export interface StrikeHow { pace?: number; block?: number }

/** The raw size of a blow felt as `y` (the inverse of `felt`). */
export function unfelt(y: number): number {
  return y > FELT_KNEE && y !== Infinity ? FELT_KNEE * (y / FELT_KNEE) ** 2 : y;
}

/**
 * One strike. Order: hit roll, per-type resistance, make-up (`susceptibility`) and natures
 * (shared affinity.ts), armor, critical, shield, integrity.
 *
 * Absolutes: an attack absolute (IRRESISTIBLE) ignores resistance, armor and INDESTRUCTIBLE,
 * except where the defender holds a narrower absolute on that damage type (FIREPROOF against
 * fire). Without an attack absolute, an absolute resistance blocks its type entirely and an
 * indestructible defender takes nothing.
 */
export function strike(attacker: Stats, defender: Entity, rng: Rng, how?: StrikeHow): Strike {
  const miss: Strike = { hit: false, critical: false, damage: 0, byType: {} };
  const target = defender.stats;
  if (target.flag("untargetable")) return miss;

  const accuracy = attacker.num("accuracy");
  if (accuracy !== Infinity) {
    if (rng() >= accuracy * (1 - Math.min(1, target.num("evasion")))) return miss;
    if (rng() < target.num("block") + (how?.block ?? 0)) return miss;
  }

  // Siege weapons multiply their damage against things that are built or part of the land.
  const fixed = !target.flag("alive") && !target.flag("portable");
  const siege = fixed ? attacker.num("siege") : 1;
  const pierce = attacker.absolute("ignores_resistance");
  const byType: Record<string, number> = {};
  let total = 0, rawTotal = 0;
  for (const type of damageTypes(attacker)) {
    const raw = attacker.num(`dmg_${type}`) * siege;
    if (raw <= 0) continue;
    let resistance = Math.min(1, target.num(`res_${type}`));
    const wall = target.absolute(`res_${type}`);
    if (pierce && !(wall && wall.specificity > pierce.specificity)) resistance = Math.min(resistance, 0);
    // What the target is made of: glass shatters under blows, paper burns, iron carries lightning;
    // and what kind of body it is: holy burns the undead, crush passes through a ghost.
    // An attack absolute ignores what a nature resists (not what it is weak to), as it ignores res_*.
    const kind = affinity(target, type), ignored = pierce && !(wall && wall.specificity > pierce.specificity);
    const dealt = raw * (1 - resistance) * susceptibility(target, type) * (ignored ? Math.max(1, kind) : kind);
    rawTotal += raw;
    if (dealt > 0) {
      byType[type] = dealt;
      total += dealt;
    }
  }
  const aff = affOf(rawTotal, total);
  if (!pierce) {
    if (target.flag("indestructible")) return { hit: true, critical: false, damage: 0, byType, aff };
    total -= target.num("armor") * (1 - Math.min(1, attacker.num("armor_pierce")));
  }
  total = Math.max(0, total);

  const chance = attacker.num("critical");
  const critical = total > 0 && (chance === Infinity || rng() < chance);
  if (critical) total *= 2;
  // Felt, not raw (FELT_KNEE): what lands grows as the square root of the blow past a person's scale.
  const raw = total;
  total = landed(total, target.num("integrity")) * (how?.pace ?? 1);

  const absorbed = Math.min(defender.shield, total);
  defender.shield -= absorbed;
  const before = Math.max(0, defender.integrity);
  defender.integrity -= total - absorbed;
  // What it could not take as it broke goes on (shared unit.ts `strikeLayers`): the share of the
  // felt blow left over, as raw damage again.
  let carry = 0;
  if (defender.integrity < 0 && total > 0 && raw > 0 && Number.isFinite(total)) {
    const left = Math.min(1, (total - absorbed - before) / total);
    carry = left > 0 ? Math.min(1, unfelt(felt(raw) * left) / raw) : 0;
  } else if (defender.integrity <= 0 && total === Infinity) carry = 1;
  return { hit: true, critical, damage: total, byType, aff, ...(carry > 0 ? { carry } : {}) };
}

/** Advances one entity's own clock: regeneration, shield recharge, decay. */
export function age(e: Entity, seconds: number): void {
  if (destroyed(e)) return;
  const s = e.stats;
  const max = s.num("integrity");
  e.integrity = Math.min(max, e.integrity + s.num("regeneration") * seconds);
  e.integrity -= (s.num("decay_rate") / 60) * seconds;
  e.shield = Math.min(s.num("shield_pool"), e.shield + s.num("shield_regen") * seconds);
}

/** Advances a fight between two entities by one tick; each strikes when its cooldown runs out. */
export function tick(a: Entity, b: Entity, seconds: number, rng: Rng): void {
  for (const [me, other] of [[a, b], [b, a]] as const) {
    const rate = me.stats.num("attack_rate");
    const once = me.stats.flag("single_use"); // a bomb has no rate: it goes off once, after its windup
    if ((rate <= 0 && !once) || destroyed(me)) continue;
    me.cooldown -= seconds;
    while (me.cooldown <= 0 && !destroyed(other)) {
      strike(me.stats, other, rng);
      if (once) {
        me.integrity = 0;
        break;
      }
      me.cooldown += 1 / rate;
    }
  }
  age(a, seconds);
  age(b, seconds);
}

export interface DuelResult {
  winner: string | null;
  seconds: number;
}

/** Runs a fight to the end, for tests and balance checks. Null winner means nobody fell in time. */
export function duel(a: Entity, b: Entity, rng: Rng, limit = 600, step = 0.1): DuelResult {
  let t = 0;
  while (t < limit && !destroyed(a) && !destroyed(b)) {
    tick(a, b, step, rng);
    t += step;
  }
  const seconds = Math.round(t * 10) / 10;
  if (destroyed(a) === destroyed(b)) return { winner: null, seconds };
  return { winner: destroyed(a) ? b.name : a.name, seconds };
}
