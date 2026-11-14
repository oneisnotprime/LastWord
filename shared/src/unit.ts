import { destroyed, spawn, strike, type Entity, type Strike } from "./combat.js";
import type { Dictionary } from "./dictionary.js";
import type { Rng } from "./rng.js";
import { massed, resolve, type Stats } from "./stats.js";
import type { Op, Value } from "./types.js";
import { inflicts } from "./status.js";
import { graftCosts, handsOf, isGraft } from "./body.js";
import { lend, lends } from "./wear.js";

/**
 * A noun with the adjectives on it. `count` above 1 is many of it as one body (a swarm, a
 * stack): see `massed`.
 */
export interface Spelled {
  noun: string;
  adjectives?: string[];
  count?: number;
  /** States it has taken on in the world (COOKED, ROTTEN: shared food.ts): adjectives that take no slot. */
  states?: string[];
}

/** What a spelled thing is: its noun and adjectives resolved (and its states), scaled by how many there are. */
export function resolveSpelled(dict: Dictionary, s: Spelled, lent: readonly string[] = []): Stats {
  return massed(resolve(dict, s.noun, s.adjectives, [...(s.states ?? []), ...lent]), s.count ?? 1);
}

/** A character and everything it carries. */
export interface Loadout {
  body: Spelled;
  /** Things held, worn or grafted on. */
  items?: Spelled[];
  /** A vehicle or mount the character is in or on. */
  riding?: Spelled;
  /** Passing effects on the body: verbs the character has cast, weather it stands in. */
  effects?: { set?: Record<string, Value>; ops?: Op[] }[];
}

/**
 * Kilograms a point of strength can lift and swing in its hands: 20 kg for an ordinary person
 * (strength 5), so a STONE or a CHAIR can be picked up and a TABLE or a LOG cannot.
 */
export const CARRY_PER_STRENGTH = 4;
/** Blunt damage of a carried thing per point of hardness times the square root of its mass in kg. */
export const IMPROVISED_DAMAGE = 2;

/** The most a body can carry in its hands, in kg: its strength times CARRY_PER_STRENGTH. */
export function carryLimit(body: Stats): number {
  return Math.max(0, body.num("strength")) * CARRY_PER_STRENGTH;
}

/** True for something with no place to be worn, held or ridden: carried, it is an improvised weapon. */
export function improvisable(stats: Stats): boolean {
  return stats.get("equip_slot") === "none" && !stats.flag("mountable");
}

/**
 * Why a body cannot pick up a thing that has no slot of its own (a STONE, a CHAIR), or null if it
 * can: it must be portable and weigh no more than the body's `carryLimit`.
 */
export function cannotCarry(item: Stats, body: Stats, name: string): string | null {
  const what = name.toUpperCase();
  if (!item.flag("portable")) return `${what} cannot be picked up`;
  if (item.num("mass") > carryLimit(body)) return `${what} is too heavy to carry`;
  return null;
}

/**
 * A thing with no slot of its own held as a weapon: a blow from its mass and hardness
 * (IMPROVISED_DAMAGE × hardness × √mass of blunt damage, so a STONE hits harder than BREAD), at
 * arm's length, once a second, in one hand, or two if it weighs over half the carry limit.
 * Damage it already does on its own is kept if larger. Strength and training then scale it like
 * any swung weapon.
 */
export function improvised(item: Stats, body: Stats): Stats {
  const stats = item.clone();
  const blow = IMPROVISED_DAMAGE * Math.max(0, stats.num("hardness")) * Math.sqrt(Math.max(0, stats.num("mass")));
  if (blow > stats.num("dmg_blunt")) stats.set("dmg_blunt", Math.round(blow * 10) / 10);
  if (!(stats.num("attack_rate") > 0)) stats.set("attack_rate", 1);
  stats.set("attack_range", Math.min(stats.num("attack_range"), MELEE_RANGE));
  stats.set("hands_required", stats.num("mass") > carryLimit(body) / 2 ? 2 : 1);
  return stats;
}

/** Reach, in metres, below which a weapon is swung and so scales with strength. */
const MELEE_RANGE = 5;
/** A bare hand, for a character holding no weapon. */
const UNARMED = 5;

/**
 * A character in the world, with its gear.
 *
 * Damage lands on the outermost thing first: the vehicle, then each piece of protection, then
 * the body. Each has to be destroyed before the next can be hurt. Whatever a destroyed layer
 * did not absorb is lost; it does not carry through.
 *
 * Pets and drones are not part of a unit: they are units of their own.
 */
export class Unit {
  readonly body: Entity;
  /** Outermost first; the body is last. */
  readonly layers: Entity[];
  /** The held item the unit strikes with on foot, if any. */
  readonly weapon: Spelled | null = null;
  private vehicle: Entity | null;
  private readonly onFoot: Stats;
  private readonly entities = new Map<Spelled, Entity>();

  constructor(dict: Dictionary, readonly loadout: Loadout) {
    const lent = loadout.body.adjectives ?? [];
    const body = massed(resolve(dict, loadout.body.noun, lent), loadout.body.count ?? 1);
    const protection: Entity[] = [];
    let weapon: Stats | null = null;
    let hands = 0;

    // Grafted arms and hands (shared body.ts) are more hands to hold with.
    const resolved = (loadout.items ?? []).map((item) => ({ item, stats: resolveSpelled(dict, item) }));
    const handLimit = 2 + handsOf(resolved.map((r) => ({ stats: r.stats, count: r.item.count ?? 1 })));
    const grafted: number[] = [];
    for (const { item, stats: own } of resolved) {
      const def = dict.lookup(item.noun)?.def;
      let stats = own;
      // A thing with no slot of its own and no weapon of its own (a STONE) is carried in the hand
      // as an improvised weapon.
      if (improvisable(stats) && !hasDamage(stats) && !inflicts(stats).length) {
        const name = [...(item.adjectives ?? []), item.noun].join(" ");
        const heavy = cannotCarry(stats, body, name);
        if (heavy) throw new Error(heavy);
        stats = improvised(stats, body);
      }
      hands += stats.num("hands_required");
      if (hands > handLimit) throw new Error(`${item.noun} needs a free hand`);
      if (stats.num("hands_required") > 0 && !body.flag("hands") && !(handLimit > 2)) throw new Error(`${loadout.body.noun} has no hands`);
      // What an item does for its wearer: a hat's warmth, a wing's flight, a ladder's climb.
      body.apply(def?.ops ?? []);
      // Worn on the body it lends its armour, resistances, disguise and noise (shared wear.ts);
      // a graft its capabilities, at a cost (shared body.ts).
      if (lends(stats, def?.archetype)) lend(body, stats, item.count ?? 1);
      if (isGraft(stats)) grafted.push(Math.max(0, stats.num("mass")));
      if (def?.archetype === "protection") {
        const layer = spawn(item.noun, stats);
        protection.push(layer);
        this.entities.set(item, layer);
      } else if (!weapon && (hasDamage(stats) || inflicts(stats).length)) {
        // A net or a rope does no damage but still catches whoever it hits.
        weapon = stats;
        this.weapon = item;
      }
    }

    body.apply(graftCosts(body.num("mass"), grafted));
    for (const effect of loadout.effects ?? []) {
      for (const [id, value] of Object.entries(effect.set ?? {})) body.set(id, value);
      body.apply(effect.ops ?? []);
    }
    this.onFoot = armed(weapon, body);
    this.body = spawn(loadout.body.noun, body);
    // A rider's own adjectives carry over to what it rides: a FAST driver makes a fast tank.
    this.vehicle = loadout.riding
      ? spawn(loadout.riding.noun, resolveSpelled(dict, loadout.riding, lent))
      : null;
    if (this.vehicle) this.entities.set(loadout.riding!, this.vehicle);
    this.layers = [...(this.vehicle ? [this.vehicle] : []), ...protection, this.body];
  }

  /** The damageable layer a carried item forms: protection and vehicles have one, a sword does not. */
  entityFor(item: Spelled): Entity | undefined {
    return this.entities.get(item);
  }

  get dead(): boolean {
    return destroyed(this.body);
  }

  /** The vehicle, while it survives. */
  get riding(): Entity | null {
    return this.vehicle && !destroyed(this.vehicle) ? this.vehicle : null;
  }

  /** What the unit strikes with: its vehicle's weapons if it has any, else what it holds. */
  get attack(): Stats {
    const v = this.riding;
    return v && hasDamage(v.stats) ? v.stats : this.onFoot;
  }

  /** What the unit moves as: its vehicle while riding, else its own body. */
  get movement(): Stats {
    return this.riding?.stats ?? this.body.stats;
  }

  /** The thing a blow lands on. */
  get outer(): Entity {
    return this.layers.find((l) => !destroyed(l)) ?? this.body;
  }
}

function hasDamage(stats: Stats): boolean {
  return stats.entries().some(([id, v]) => id.startsWith("dmg_") && typeof v === "number" && v > 0);
}

/**
 * The strike a character makes on foot: the weapon's own damage and rate, scaled by the
 * character's training, and by its strength if the weapon is swung, not fired.
 */
function armed(weapon: Stats | null, body: Stats): Stats {
  let stats: Stats;
  if (weapon) stats = weapon.clone();
  else if (hasDamage(body)) return body; // claws and teeth are already the body's own
  else {
    stats = body.clone();
    stats.set("dmg_blunt", UNARMED);
    stats.set("attack_rate", 1);
  }
  const swung = stats.num("attack_range") <= MELEE_RANGE;
  const factor = (1 + body.num("training") / 10) * (swung ? body.num("strength") / 5 : 1);
  stats.apply(stats.entries().filter(([id]) => id.startsWith("dmg_")).map(([id]) => [id, "mul", factor]));
  return stats;
}

/** One strike from one unit on another's outermost layer. `aim` multiplies its accuracy (a shaken striker's is halved). */
export function strikeUnit(attacker: Unit, defender: Unit, rng: Rng, aim = 1): Strike & { on: string } {
  // Someone who cannot be targeted cannot be hit through their armor either.
  if (defender.body.stats.flag("untargetable")) return { hit: false, critical: false, damage: 0, byType: {}, on: defender.body.name };
  const target = defender.outer;
  let attack = attacker.attack;
  if (aim !== 1) {
    attack = attack.clone();
    attack.apply([["accuracy", "mul", aim]]);
  }
  return { ...strike(attack, target, rng), on: target.name };
}
