import { HELD } from "./home.js";
import type { Dictionary } from "./dictionary.js";
import { Stats } from "./stats.js";
import type { Op, Value } from "./types.js";

/** Statuses that come through the ears: the deaf are spared them (shared sound.ts). */
export const UNHEARD: readonly string[] = ["charm", "sleep"];

/** Every status a word can inflict (`inflict_<status>`) or be immune to (`immune_<status>`). */
export const STATUSES = [
  "stun", "slow", "blind", "fear", "burn", "freeze", "poison", "bleed", "sleep", "charm", "silence", "root", "confuse", "shrink",
  "sick", "rage", "deaf", "debt", "curse", "bless", "expose", "haste", "stasis", "truce", "chaos", "void", "doom",
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
  /** Goes for whoever is nearest, friend or foe (shared emotion.ts). */
  berserk?: boolean;
  /** Hears nothing: no orders, no songs (shared sound.ts `UNHEARD`). */
  deaf?: boolean;
  /** Pays whoever put it on them a letter every `DEBT_SECONDS` (shared money.ts). */
  owes?: boolean;
  /** Multiplies the letters it earns (shared faith.ts: blessed and cursed). */
  earns?: number;
  /** Shows on every enemy's threat arrows, wherever they are (shared signal.ts). */
  exposed?: boolean;
  /** A boon: areas give it to those they are aimed at (their side), not to those they harm. */
  boon?: boolean;
  /**
   * How fast time runs for the body (shared time.ts): moving, striking and its other statuses
   * wearing off. 0 stops it (stasis). A status with a time runs down by the clock itself.
   */
  time?: number;
  /** Nothing lands on it: no blow, no area, no burn or poison (stasis, truce). */
  untouchable?: boolean;
  /** Statuses it ends as it takes hold (haste ends slow, slow ends haste). */
  ends?: Status[];
  /** Everything the body carries, wears, rides or stands in does nothing (shared idea.ts). */
  nulls?: boolean;
  /** When it runs out (not cured), the body takes `DOOM_SHARE` of its full integrity (shared idea.ts). */
  fated?: boolean;
  /** What it sets on the body while it lasts (stasis and truce: untargetable). */
  set?: Record<string, Value>;
}

/** Every kind of damage, for statuses that take them all away (void). */
export const DAMAGE_TYPES = [
  "blunt", "slash", "pierce", "crush", "fire", "cold", "electric", "acid", "poison", "radiation", "blast", "sonic", "light", "dark",
  "water", "wind", "earth", "psychic", "holy", "unholy", "disease", "magic", "suffocation", "hunger",
] as const;

/** The one table of what each status does. Words only say how long. */
export const STATUS_RULES: Record<Status, StatusRule> = {
  stun: { still: true, helpless: true },
  slow: { ops: [["speed_land", "mul", 0.5], ["speed_air", "mul", 0.5], ["speed_water", "mul", 0.5]], tempo: 0.5, ends: ["haste"] },
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
  // Disease (shared disease.ts): it wastes the body and passes to whoever stands close.
  sick: { dot: { disease: 3 }, living: true, ops: [["strength", "mul", 0.7], ["speed_land", "mul", 0.8], ["labor", "mul", 0.5], ["morale", "add", -1]] },
  // Emotions (shared emotion.ts): blind fury, at whoever is nearest.
  rage: { berserk: true, tempo: 1.5, living: true, ops: [["strength", "mul", 1.5], ["accuracy", "add", -0.15], ["armor", "add", -5], ["courage", "add", 5]] },
  // Sound (shared sound.ts).
  deaf: { deaf: true, ops: [["hearing_range", "mul", 0]] },
  // Money (shared money.ts): a letter every DEBT_SECONDS to the creditor.
  debt: { owes: true },
  // Religion (shared faith.ts): fortune in letters, and the heart for a fight.
  curse: { earns: 0.5, ops: [["accuracy", "add", -0.15], ["morale", "add", -2], ["regeneration", "mul", 0]] },
  bless: { earns: 1.5, boon: true, ops: [["regeneration", "add", 1], ["morale", "add", 2], ["courage", "add", 2]] },
  // Information (shared signal.ts): everyone knows where you are.
  expose: { exposed: true, ops: [["stealth", "mul", 0], ["disguise", "mul", 0]] },
  // Time (shared time.ts): twice the time, or none at all.
  haste: { time: 2, boon: true, ends: ["slow"] },
  stasis: { time: 0, still: true, helpless: true, untouchable: true, set: { untargetable: true } },
  // Sports (shared sport.ts): a peace keeper's truce: nobody strikes them, they strike nobody.
  truce: { helpless: true, untouchable: true, boon: true, set: { untargetable: true } },
  // Abstract ideas (shared idea.ts): random properties (ops drawn as it takes hold), nothing at all, a sealed fate.
  chaos: {},
  void: {
    nulls: true,
    ops: [...DAMAGE_TYPES.map((d): Op => [`dmg_${d}`, "mul", 0]), ["speed_air", "mul", 0], ["armor", "mul", 0], ["regeneration", "mul", 0], ["luck", "mul", 0]],
  },
  doom: { fated: true, ops: [["morale", "add", -2]] },
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
  sick: 6, rage: 6, deaf: 8,
  debt: 3, curse: 6, bless: 6, expose: 6,
  haste: 6, stasis: 2, truce: 1.5, chaos: 4, void: 4, doom: 1.2,
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
  /** For sickness: the chance a minute it passes to each body close by (shared disease.ts). */
  contagion?: number;
  /** For debt: seconds run toward the next letter owed (shared money.ts `debtDue`). */
  owing?: number;
  /** For chaos: the property changes drawn for it as it took hold (shared idea.ts `chaosOps`). */
  ops?: Op[];
}

/** What someone's statuses do to the letters they earn: blessed half again, cursed half (shared faith.ts). */
export function earnFactor(list: readonly Affliction[]): number {
  let k = 1;
  for (const a of list) k *= STATUS_RULES[a.status].earns ?? 1;
  return k;
}

/** True for a status an area gives to those it is aimed at (its side), not to those it harms. */
export const isBoon = (status: Status): boolean => !!STATUS_RULES[status].boon;

/** True if someone's statuses show them to every enemy (shared signal.ts). */
export const isExposed = (list: readonly Affliction[]): boolean => list.some((a) => STATUS_RULES[a.status].exposed);

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
  // The deaf hear no song or lullaby (shared sound.ts): charm and sleep do not reach them.
  const deaf = list.some((a) => STATUS_RULES[a.status].deaf);
  for (const [status, base] of given) {
    if (!susceptible(target, status) || (deaf && UNHEARD.includes(status))) continue;
    const by = STATUS_RULES[status].resistedBy;
    const stretched = statusSeconds(status, base);
    const seconds = by ? stretched * (5 / Math.max(1e-3, target.num(by))) : stretched;
    if (!(seconds > 0)) continue;
    const had = list.find((a) => a.status === status);
    if (had) {
      if (seconds >= had.left) Object.assign(had, { left: seconds, from, origin });
    } else list.push({ status, left: seconds, from, origin });
    const ends = STATUS_RULES[status].ends;
    if (ends) remove(list, (a) => ends.includes(a.status));
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
export function tickStatuses(list: Affliction[], seconds: number, held = 1, time = 1): Status[] {
  // In a lockup's ground (shared home.ts `holdFactor`), root and silence wear off `held` times slower.
  // Time running fast or slow for the body (shared time.ts) wears its statuses off faster or slower,
  // except those that set its time, which run by the clock.
  for (const a of list) {
    const t = STATUS_RULES[a.status].time === undefined ? seconds * time : seconds;
    a.left -= held > 1 && HELD.includes(a.status) ? t / held : t;
  }
  return remove(list, (a) => a.left <= 0);
}

/** The property changes statuses make, as passing effects for a `Unit`'s loadout. */
export function statusEffects(list: readonly Affliction[]): { set?: Record<string, Value>; ops?: Op[] }[] {
  return list
    .map((a) => ({ ops: a.ops ?? STATUS_RULES[a.status].ops ?? [], ...(STATUS_RULES[a.status].set ? { set: STATUS_RULES[a.status].set } : {}) }))
    .filter((e) => e.ops.length || e.set);
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
  /** In a rage: goes for whoever is nearest. */
  berserk: boolean;
  /** Hears no orders. */
  deaf: boolean;
  /** How fast time runs for it from its statuses (shared time.ts): 0 in stasis, 2 in haste. */
  time: number;
  /** Nothing lands on it (stasis, truce). */
  untouchable: boolean;
  /** Its gear, mount and the fields it stands in do nothing (void). */
  nulled: boolean;
}

export function hampered(list: readonly Affliction[]): Hampered {
  const h: Hampered = { moves: true, acts: true, spells: true, random: false, tempo: 1, flees: [], spares: [], berserk: false, deaf: false, time: 1, untouchable: false, nulled: false };
  for (const a of list) {
    const r = STATUS_RULES[a.status];
    if (r.still) h.moves = false;
    if (r.helpless || r.flees) h.acts = false;
    if ((r.helpless || r.mute) && h.spells) { h.spells = false; h.muteBy = a.status; }
    if (r.random) h.random = true;
    if (r.tempo !== undefined) h.tempo *= r.tempo;
    if (r.flees) h.flees.push(a.origin);
    if (r.spares) h.spares.push(a.from);
    if (r.berserk) h.berserk = true;
    if (r.deaf) h.deaf = true;
    if (r.time !== undefined) h.time *= r.time;
    if (r.untouchable) h.untouchable = true;
    if (r.nulls) h.nulled = true;
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
