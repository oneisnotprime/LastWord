import { HELD } from "./home.js";
import type { Dictionary } from "./dictionary.js";
import { Stats } from "./stats.js";
import type { Op, Value } from "./types.js";

/** Every status a word can inflict (`inflict_<status>`) or be immune to (`immune_<status>`). */
export const STATUSES = [
  "stun", "slow", "blind", "fear", "burn", "freeze", "poison", "bleed", "sleep", "charm", "silence", "root", "confuse", "shrink",
] as const;
export type Status = (typeof STATUSES)[number];

/** What a status does to whoever has it. Anything left out is unchanged. */
export interface StatusRule {
  /** Cannot walk. */
  still?: boolean;
  /** Cannot strike or spell. */
  helpless?: boolean;
  /** Cannot spell. */
  mute?: boolean;
  /** Multiplies how often it strikes. */
  tempo?: number;
  /** Runs from whatever inflicted it, and does not strike. */
  flees?: boolean;
  /** Will not strike whoever inflicted it. */
  spares?: boolean;
  /** Walks and strikes at random, friend or foe. */
  random?: boolean;
  /** Ends the moment a blow lands. */
  breaksOnHit?: boolean;
  /** Only living bodies can have it. */
  living?: boolean;
  /** Damage a second, by type; resistances apply, armor does not. */
  dot?: Record<string, number>;
  /** What it does to the body's own properties while it lasts. */
  ops?: Op[];
  /** A property that shortens it: the time is scaled by 5 / that property (5 is ordinary). */
  resistedBy?: string;
}

/** The one table of what each status does. Words only say how long. */
export const STATUS_RULES: Record<Status, StatusRule> = {
  stun: { still: true, helpless: true },
  slow: { ops: [["speed_land", "mul", 0.5], ["speed_air", "mul", 0.5], ["speed_water", "mul", 0.5]], tempo: 0.5 },
  blind: { ops: [["sight_range", "mul", 0.05], ["accuracy", "mul", 0.3]] },
  fear: { flees: true, living: true, resistedBy: "courage" },
  burn: { dot: { fire: 8 } },
  freeze: { still: true, helpless: true, ops: [["res_blunt", "add", -1], ["temperature", "add", -60]] },
  poison: { dot: { poison: 5 }, living: true },
  bleed: { dot: { slash: 6 }, living: true },
  sleep: { still: true, helpless: true, breaksOnHit: true, living: true, ops: [["sight_range", "mul", 0]] },
  charm: { spares: true, living: true, resistedBy: "loyalty" },
  silence: { mute: true },
  root: { still: true },
  confuse: { random: true },
  shrink: { ops: [["mass", "mul", 0.1], ["height", "mul", 0.25], ["length", "mul", 0.25], ["strength", "mul", 0.3], ["speed_land", "mul", 0.6]] },
};

/**
 * How much longer than a word's own seconds each status runs. Word data was written for blink-long
 * statuses that wore off before anyone noticed; playtests asked for about twenty times longer.
 * Not twenty everywhere: a stun or freeze leaves you helpless, and burn, poison and bleed hurt
 * every second (their damage a second is unchanged), so those stretch less. `STATUS_HORIZON`
 * bends long ones back (a 600 s JAIL is not made 6000 s), and nothing ever gets shorter.
 */
export const STATUS_STRETCH: Record<Status, number> = {
  stun: 3, freeze: 3, sleep: 4, root: 5, silence: 5,
  burn: 2, poison: 2, bleed: 2,
  slow: 12, blind: 8, fear: 8, charm: 8, confuse: 8, shrink: 12,
};
/** Seconds past which stretching bends toward a ceiling of about this much more. */
export const STATUS_HORIZON = 120;

/** Seconds a status runs, from the seconds a word gives it (`STATUS_STRETCH`). */
export function statusSeconds(status: Status, base: number): number {
  if (!(base > 0) || !Number.isFinite(base)) return base;
  const k = STATUS_STRETCH[status] ?? 1;
  return Math.max(base, (k * base) / (1 + ((k - 1) * base) / STATUS_HORIZON));
}

/** How much longer a temporary effect (a verb cast, something eaten or drunk) lasts than its word's `duration`. */
export const EFFECT_STRETCH = 20;
/**
 * Seconds a temporary effect lasts: PUNCH's 1 s becomes 19 s, RUN's 10 s two minutes, and long
 * ones bend toward five minutes; what already lasts longer than that is left as it is.
 */
export function effectSeconds(duration: number): number {
  if (!(duration > 0) || !Number.isFinite(duration)) return duration;
  return Math.max(duration, (EFFECT_STRETCH * duration) / (1 + duration / 15));
}

/** A status on someone: seconds left, who is to blame, and where it came from (a walker or an area). */
export interface Affliction {
  status: Status;
  left: number;
  /** Who inflicted it: kills from its damage are theirs, and a charm spares them. */
  from: string;
  /** What to run from: the striker, or the area it came from. */
  origin: string;
}

/** Seconds of each status a strike carries, the most any of the striking stats gives. */
export function inflicts(...attackers: Stats[]): [Status, number][] {
  const out: [Status, number][] = [];
  for (const status of STATUSES) {
    const seconds = Math.max(0, ...attackers.map((s) => s.num(`inflict_${status}`)));
    if (seconds > 0) out.push([status, seconds]);
  }
  return out;
}

/** True if a body can be given a status at all. */
export function susceptible(target: Stats, status: Status): boolean {
  if (target.flag(`immune_${status}`)) return false;
  return !(STATUS_RULES[status].living && !target.flag("alive"));
}

/**
 * Gives a struck body the statuses its attackers carry, unless it is immune. A status it already
 * has runs for whichever is longer. Returns the statuses given.
 */
export function afflict(
  list: Affliction[], given: [Status, number][], target: Stats, from: string, origin = from,
): Status[] {
  const done: Status[] = [];
  for (const [status, base] of given) {
    if (!susceptible(target, status)) continue;
    const by = STATUS_RULES[status].resistedBy;
    const stretched = statusSeconds(status, base);
    const seconds = by ? stretched * (5 / Math.max(1e-3, target.num(by))) : stretched;
    if (!(seconds > 0)) continue;
    const had = list.find((a) => a.status === status);
    if (had) {
      if (seconds >= had.left) Object.assign(had, { left: seconds, from, origin });
    } else list.push({ status, left: seconds, from, origin });
    done.push(status);
  }
  return done;
}

/** A blow landed: statuses that end when struck (sleep) end. Returns those removed. */
export function wake(list: Affliction[]): Status[] {
  return remove(list, (a) => !!STATUS_RULES[a.status].breaksOnHit);
}

/** Removes the named statuses (a HEAL clears poison, bleed and burn). Returns those removed. */
export function cure(list: Affliction[], statuses: readonly string[]): Status[] {
  return remove(list, (a) => statuses.includes(a.status));
}

function remove(list: Affliction[], drop: (a: Affliction) => boolean): Status[] {
  const gone: Status[] = [];
  for (let i = list.length - 1; i >= 0; i--) if (drop(list[i]!)) gone.push(list.splice(i, 1)[0]!.status);
  return gone;
}

/** Counts statuses down; removes and returns those that ran out. */
export function tickStatuses(list: Affliction[], seconds: number, held = 1): Status[] {
  // In a lockup's ground (shared home.ts `holdFactor`), root and silence wear off `held` times slower.
  for (const a of list) a.left -= held > 1 && HELD.includes(a.status) ? seconds / held : seconds;
  return remove(list, (a) => a.left <= 0);
}

/** The property changes statuses make, as passing effects for a `Unit`'s loadout. */
export function statusEffects(list: readonly Affliction[]): { set?: Record<string, Value>; ops?: Op[] }[] {
  return list.map((a) => ({ ops: STATUS_RULES[a.status].ops ?? [] })).filter((e) => e.ops.length);
}

/** What someone's statuses stop them doing, and whom they run from or spare. */
export interface Hampered {
  moves: boolean;
  acts: boolean;
  spells: boolean;
  random: boolean;
  /** Multiplier on how often it strikes. */
  tempo: number;
  /** Origins to run from. */
  flees: string[];
  /** Whoever charmed them. */
  spares: string[];
  /** The status that stops them spelling, for telling them why. */
  muteBy?: Status;
}

export function hampered(list: readonly Affliction[]): Hampered {
  const h: Hampered = { moves: true, acts: true, spells: true, random: false, tempo: 1, flees: [], spares: [] };
  for (const a of list) {
    const r = STATUS_RULES[a.status];
    if (r.still) h.moves = false;
    if (r.helpless || r.flees) h.acts = false;
    if ((r.helpless || r.mute) && h.spells) { h.spells = false; h.muteBy = a.status; }
    if (r.random) h.random = true;
    if (r.tempo !== undefined) h.tempo *= r.tempo;
    if (r.flees) h.flees.push(a.origin);
    if (r.spares) h.spares.push(a.from);
  }
  return h;
}

/**
 * One second of damage from statuses (burn, poison, bleed) as a strike that cannot miss and goes
 * through armor; resistances still apply. Null if none of them does damage. `from` is whom to
 * credit a kill to: the one who inflicted the first of them.
 */
export function statusDamage(dict: Dictionary, list: readonly Affliction[]): { attack: Stats; from: string } | null {
  const hurting = list.filter((a) => STATUS_RULES[a.status].dot);
  if (!hurting.length) return null;
  const attack = new Stats(dict);
  attack.set("accuracy", "ABS");
  attack.set("armor_pierce", 1);
  for (const a of hurting) {
    for (const [type, perSecond] of Object.entries(STATUS_RULES[a.status].dot!)) {
      attack.set(`dmg_${type}`, attack.num(`dmg_${type}`) + perSecond);
    }
  }
  return { attack, from: hurting[0]!.from };
}
