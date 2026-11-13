import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";

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

function damageTypes(stats: Stats): string[] {
  return stats.entries().map(([id]) => id).filter((id) => id.startsWith("dmg_")).map((id) => id.slice(4));
}

export interface Strike {
  hit: boolean;
  critical: boolean;
  damage: number;
  /** Damage by type after resistances, before armor. */
  byType: Record<string, number>;
}

/**
 * One strike. Order: hit roll, per-type resistance, armor, critical, shield, integrity.
 *
 * Absolutes: an attack absolute (IRRESISTIBLE) ignores resistance, armor and INDESTRUCTIBLE,
 * except where the defender holds a narrower absolute on that damage type (FIREPROOF against
 * fire). Without an attack absolute, an absolute resistance blocks its type entirely and an
 * indestructible defender takes nothing.
 */
export function strike(attacker: Stats, defender: Entity, rng: Rng): Strike {
  const miss: Strike = { hit: false, critical: false, damage: 0, byType: {} };
  const target = defender.stats;
  if (target.flag("untargetable")) return miss;

  const accuracy = attacker.num("accuracy");
  if (accuracy !== Infinity) {
    if (rng() >= accuracy * (1 - Math.min(1, target.num("evasion")))) return miss;
    if (rng() < target.num("block")) return miss;
  }

  // Siege weapons multiply their damage against things that are built or part of the land.
  const fixed = !target.flag("alive") && !target.flag("portable");
  const siege = fixed ? attacker.num("siege") : 1;
  const pierce = attacker.absolute("ignores_resistance");
  const byType: Record<string, number> = {};
  let total = 0;
  for (const type of damageTypes(attacker)) {
    const raw = attacker.num(`dmg_${type}`) * siege;
    if (raw <= 0) continue;
    let resistance = Math.min(1, target.num(`res_${type}`));
    const wall = target.absolute(`res_${type}`);
    if (pierce && !(wall && wall.specificity > pierce.specificity)) resistance = Math.min(resistance, 0);
    const dealt = raw * (1 - resistance);
    if (dealt > 0) {
      byType[type] = dealt;
      total += dealt;
    }
  }
  if (!pierce) {
    if (target.flag("indestructible")) return { hit: true, critical: false, damage: 0, byType };
    total -= target.num("armor") * (1 - Math.min(1, attacker.num("armor_pierce")));
  }
  total = Math.max(0, total);

  const chance = attacker.num("critical");
  const critical = total > 0 && (chance === Infinity || rng() < chance);
  if (critical) total *= 2;

  const absorbed = Math.min(defender.shield, total);
  defender.shield -= absorbed;
  defender.integrity -= total - absorbed;
  return { hit: true, critical, damage: total, byType };
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
