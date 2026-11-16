import { destroyed, shown, strike, windupOf, type Entity, type Strike } from "./combat.js";
import type { Aff } from "./affinity.js";
import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import { strikeUnit, type Unit } from "./unit.js";
import { rerolled, LUCK_POINT } from "./idea.js";

/**
 * Turn-based battles (docs/TURN_BASED_PLAN.md). A battle is a fight between people played in
 * rounds: everyone commits one action in secret, then the round resolves in speed order. One
 * round plays one second of the real-time fight, so `strike`, natures, armour layers, FIGHT_PACE
 * and the time to kill are the same numbers; nothing here is a new stat. Every number a fighter
 * brings is read from its `Unit` (built from word properties) and its statuses.
 *
 * - **Charge.** A fighter gains `attack_rate × tempo` of charge at the start of each round and a
 *   strike spends 1: a SWORD (rate 1) strikes every round, a TABBY (2) twice, a BOW (0.6) three
 *   rounds in five, a TANK (0.15) on the seventh. Unspent charge is kept up to a round's worth.
 * - **Heavy blows** (`windupOf`) are announced in the round they are chosen and land in the next,
 *   at the striker's turn. Whoever defends in the landing round is missed.
 * - **Defend:** blows land at DEFEND_SHARE, a blocking layer blocks DEFEND_BLOCK more, a heavy
 *   blow misses, and the defender's next word costs less (the server's speech rule).
 * - **Flee:** `fleeChance`, by speed. A failed try loses the action.
 * - **Spell:** the word is cast through `BattleHooks.spell` (the game's own `spellWord`).
 * - **Fatigue:** from FATIGUE_FROM every blow lands FATIGUE_STEP more each round; the battle
 *   ends at ROUND_CAP.
 *
 * Order in a round: defenders, flee tries, then everyone else fastest first (ties: agility, then
 * a roll); in round 1 a ranged weapon goes before a swung one.
 */

/** Seconds of the real-time fight one round plays. */
export const ROUND_SECONDS = 1;
/** Seconds a status passes each round (plan 7.3: seconds over three are rounds). */
export const STATUS_ROUND_SECONDS = 3;
/** Seconds to choose: the first round, later rounds, and a round when only bots fight. */
export const PLAN_FIRST = 15;
export const PLAN_SECONDS = 10;
export const BOT_ROUND_SECONDS = 2;
/** Seconds a resolved round is shown before the next begins (when a person is in it). */
export const RESOLVE_SECONDS = 2.2;
/** The last round. */
export const ROUND_CAP = 15;
/** From this round every blow lands FATIGUE_STEP more, each round. */
export const FATIGUE_FROM = 10;
export const FATIGUE_STEP = 0.25;
/** Share of a blow that lands on a defender, and the block a blocking layer gains. */
export const DEFEND_SHARE = 0.5;
export const DEFEND_BLOCK = 0.3;
/** A defender's next word: this `spell_cost` (the rarest fifth of its letters free). */
export const DEFEND_SPELL_COST = 0.8;
/** Reach, in metres, over which a weapon is ranged: it acts before melee in round 1. */
export const RANGED_METERS = 5;
/** Flee: the chance at equal speed, what doubling your speed adds, its bounds, and what each failed try adds. */
export const FLEE_EVEN = 0.5;
export const FLEE_PER_DOUBLING = 0.4;
export const FLEE_MIN = 0.1;
export const FLEE_MAX = 0.95;
export const FLEE_RETRY = 0.15;
/**
 * Nobody sits a battle out: after HELPLESS_CAP rounds in a row unable to act (stunned, frozen,
 * afraid, asleep) a fighter shakes it off and acts for the next HELPLESS_FREE rounds whatever is on it.
 */
export const HELPLESS_CAP = 2;
export const HELPLESS_FREE = 2;

/** One combatant. The server fills the sheet from its walker before each round (`BattleHooks.refresh`). */
export interface Fighter {
  id: string;
  name: string;
  side: number;
  /** The live unit: blows land on it. */
  unit: Unit;
  /** Speed on the map (the mount's or the body's, with time and tempo): initiative and fleeing. */
  speed: number;
  /** How often it strikes against the weapon's own rate (slow 0.5, haste 2). */
  tempo: number;
  /** Stunned, frozen, asleep, afraid: no action (see `canAct`: not for more than HELPLESS_CAP rounds running). */
  acts: boolean;
  /** Rounds in a row it could not act, and rounds left in which it acts whatever is on it. */
  stuck: number;
  free: number;
  /** Rooted, leashed, held: no fleeing. */
  moves: boolean;
  /** Silenced, gagged: no spelling. */
  spells: boolean;
  /** Multiplier on accuracy (a shaken striker's is halved). */
  aim: number;
  /** A machine out of fuel or power cannot fire. */
  stalled: boolean;
  charge: number;
  /** A heavy blow announced last round, landing this one. */
  windup: { on: string } | null;
  fleeFails: number;
  /** Defended last round: its next word is cheaper. */
  defended: boolean;
  /** What its blows have landed in all. */
  dealt: number;
  /** Out of the battle. */
  gone?: "down" | "fled";
}

export interface Battle {
  round: number;
  fighters: Fighter[];
  /** Set once it ends: why, and the winning side (null for a draw). */
  over: { why: "down" | "fled" | "cap"; winner: number | null } | null;
}

export type Action =
  | { kind: "attack"; target?: string }
  | { kind: "defend" }
  | { kind: "spell"; text: string; target?: string }
  | { kind: "flee" };

export type BattleEvent =
  | { kind: "defend"; by: string }
  | { kind: "flee"; by: string; ok: boolean; chance: number }
  | { kind: "loading"; by: string; have: number; need: number }
  | { kind: "windup"; by: string; on: string }
  | { kind: "strike"; by: string; on: string; hit: boolean; critical: boolean; damage: number; layer: string; aff: Aff; broke: string[]; heavy: boolean; dodged: boolean; defended: boolean }
  | { kind: "spell"; by: string; text: string; ok: boolean; said: string }
  | { kind: "skip"; by: string; why: string }
  | { kind: "down"; who: string; by: string }
  | { kind: "fatigue"; share: number }
  | { kind: "end"; why: "down" | "fled" | "cap"; winner: number | null };

/** What the game around a battle does for it. All optional: a bare battle (tests, the matchup matrix) needs none. */
export interface BattleHooks {
  /** Reads the fighter's sheet again from the world: its unit after a rebuild, its statuses. False if it is no longer standing in the battle. */
  refresh?(f: Fighter): boolean | void;
  /** Casts a word through the game's own spelling. Returns what it said; throws if it cannot be spelled. */
  spell?(f: Fighter, text: string, target: string | undefined): string;
  /** After each blow, hit or miss: the map's numbers, statuses, a spent weapon, a kill. */
  struck?(by: Fighter, on: Fighter, r: Strike & { on: string }, attack: Stats): void;
}

/** A fighter at the start of a battle. */
export function fighter(id: string, name: string, side: number, unit: Unit, speed = 8): Fighter {
  return { id, name, side, unit, speed, tempo: 1, acts: true, stuck: 0, free: 0, moves: true, spells: true, aim: 1, stalled: false, charge: 0, windup: null, fleeFails: 0, defended: false, dealt: 0 };
}

export function startBattle(fighters: Fighter[]): Battle {
  return { round: 0, fighters, over: null };
}

const active = (f: Fighter): boolean => !f.gone;
/** Whether a fighter acts this round: nothing stops it, or it has shaken off what does (HELPLESS_CAP). */
export const canAct = (f: Fighter): boolean => f.acts || f.free > 0;
const foesOf = (b: Battle, f: Fighter): Fighter[] => b.fighters.filter((o) => active(o) && o.side !== f.side);

/** Strikes a round: the weapon's rate times the fighter's tempo. */
export function rateOf(f: Fighter): number {
  const a = f.unit.attack;
  const rate = a.num("attack_rate") * f.tempo;
  // No rate of its own (a thrown thing, a net): once a round, as once a second on the map.
  return rate > 0 ? rate : f.tempo;
}

/** Rounds a weapon takes to load a strike, and how many are done: "loading 3/7". */
export function loading(f: Fighter): { have: number; need: number } {
  const rate = rateOf(f);
  if (!(rate > 0)) return { have: 0, need: Infinity };
  const need = Math.ceil(1 / rate - 1e-9);
  return { have: Math.min(need, Math.floor(f.charge / rate + 1e-9)), need };
}

/** How much every blow is multiplied by in this round (FATIGUE_FROM). */
export function fatigue(round: number): number {
  return round >= FATIGUE_FROM ? 1 + FATIGUE_STEP * (round - FATIGUE_FROM + 1) : 1;
}

/**
 * The chance to get away: FLEE_EVEN at equal speed, FLEE_PER_DOUBLING more for each doubling of
 * your speed over the fastest enemy's (less for each halving), between FLEE_MIN and FLEE_MAX;
 * then 3% a point of luck, FLEE_RETRY for each failed try, and a throw again for each reroll.
 */
export function fleeChance(speed: number, fastestEnemy: number, luck = 0, rerolls = 0, fails = 0): number {
  const ratio = fastestEnemy > 0 ? Math.max(1e-3, speed) / fastestEnemy : 1e3;
  const base = Math.min(FLEE_MAX, Math.max(FLEE_MIN, FLEE_EVEN + FLEE_PER_DOUBLING * Math.log2(ratio)));
  const p = Math.min(1, Math.max(0, base + LUCK_POINT * luck + FLEE_RETRY * fails));
  return speed > 0 ? rerolled(p, rerolls) : 0;
}

/** A fighter's chance to flee this battle now. */
export function fleeOdds(b: Battle, f: Fighter): number {
  const s = f.unit.body.stats;
  const fastest = Math.max(0, ...foesOf(b, f).map((o) => (canAct(o) && o.moves ? o.speed : 0)));
  return fleeChance(f.speed, fastest, s.num("luck"), s.num("rerolls"), f.fleeFails);
}

/** What one strike of `attack` would do to the outside of `target` if it hit, without rolling: the damage landed and how it meets its natures. */
export function preview(attack: Stats, target: Unit, pace = 1): { damage: number; aff: Aff; layer: string } {
  const outer = target.outer;
  const copy: Entity = { ...outer };
  const sure = attack.clone();
  sure.set("accuracy", "ABS");
  sure.set("critical", 0);
  const r = strike(sure, copy, () => 0.5, { pace });
  return { damage: r.damage, aff: r.aff ?? "", layer: outer === target.body ? "" : outer.name };
}

/** A fighter's whole health as bars show it: each standing layer, outermost first, in felt numbers. */
export function bars(unit: Unit): { name: string; hp: number; max: number; body: boolean }[] {
  return unit.layers.filter((l) => l === unit.body || !destroyed(l)).map((l) => ({
    name: l.name, body: l === unit.body,
    hp: Math.max(0, Math.round(shown(l.stats.num("integrity")) * Math.max(0, l.integrity) / Math.max(1e-9, l.stats.num("integrity")))),
    max: Math.round(shown(l.stats.num("integrity"))),
  }));
}

/** The verb a strike is called by on its move card, from the damage it mostly does and its reach. */
const STRIKE_VERBS: Record<string, string> = {
  slash: "Slash", pierce: "Stab", blunt: "Strike", crush: "Crush", fire: "Burn", cold: "Freeze", electric: "Shock",
  poison: "Poison", acid: "Corrode", blast: "Blast", holy: "Smite", unholy: "Curse", psychic: "Daze", magic: "Hex",
  light: "Dazzle", dark: "Shade", sonic: "Blare", water: "Douse", radiation: "Irradiate",
};
export function strikeVerb(attack: Stats): string {
  let top = "", most = 0;
  for (const [id, v] of attack.entries()) if (id.startsWith("dmg_") && typeof v === "number" && v > most) { most = v; top = id.slice(4); }
  if (attack.num("attack_range") > RANGED_METERS && (top === "pierce" || top === "blunt" || top === "slash")) return "Shoot";
  return STRIKE_VERBS[top] ?? (most > 0 ? "Strike" : "Catch");
}

/** One entry of the action menu, with what the client needs to draw its card. */
export interface Move {
  id: Action["kind"];
  name: string;
  /** Numbers first, then what it does, in one line. */
  text: string;
  legal: boolean;
  /** Why it cannot be chosen. */
  why?: string;
  /** For Attack: what a strike would land on the target now, how it meets its natures, whether it is heavy, and the loading count. */
  damage?: number;
  aff?: Aff;
  heavy?: boolean;
  have?: number;
  need?: number;
  strikes?: number;
  /** For Flee: the chance. */
  chance?: number;
}

/**
 * The moves a fighter has this round, read from its unit's properties and nothing else: the
 * strike it would make now (`Unit.attack`) against `target`, Defend, Spell and Flee.
 */
export function movesOf(b: Battle, id: string, target?: string): Move[] {
  const f = b.fighters.find((x) => x.id === id);
  if (!f) return [];
  const foes = foesOf(b, f);
  const foe = foes.find((o) => o.id === target) ?? foes[0];
  const attack = f.unit.attack;
  const rate = rateOf(f);
  const helpless = !canAct(f) ? "you cannot act" : undefined;
  const out: Move[] = [];
  {
    const tool = f.unit.riding && f.unit.attack === f.unit.riding.stats ? f.unit.riding.name : f.unit.weapon?.noun ?? "fist";
    // The charge it will have when the round resolves.
    const next = f.windup ? f.charge : f.charge + rate;
    const p = foe ? preview(attack, foe.unit, fatigue(b.round + 1)) : { damage: 0, aff: "" as Aff, layer: "" };
    const heavy = !!foe && windupOf(attack, foe.unit.outer) > 0;
    const load = loading({ ...f, charge: next });
    const strikes = Math.floor(next + 1e-9);
    const why = helpless ?? (f.stalled ? "no fuel or power" : !foe ? "nobody to strike" : !(rate > 0) ? "nothing to strike with" : undefined);
    const timing = strikes >= 1 ? (heavy ? "winds up, lands next round" : strikes > 1 ? `${strikes} strikes` : "") : `loading ${load.have}/${load.need}`;
    const tag = p.aff === "weak" ? "weak!" : p.aff === "resist" ? "resists" : p.aff === "immune" ? "immune" : "";
    out.push({
      id: "attack", name: `${strikeVerb(attack)} · ${tool.toUpperCase()}`,
      text: [`${Math.round(p.damage)}${p.layer ? ` on ${p.layer.toUpperCase()}` : ""}`, tag, timing].filter(Boolean).join(" · "),
      legal: !why, ...(why ? { why } : {}), damage: p.damage, aff: p.aff, heavy, have: load.have, need: load.need, strikes,
    });
  }
  const blocks = f.unit.outer.stats.num("block") > 0;
  out.push({ id: "defend", name: "Defend", text: `blows land at half${blocks ? ", block +30%" : ""}; a heavy blow misses; next word cheaper`, legal: !helpless, ...(helpless ? { why: helpless } : {}) });
  {
    const why = helpless ?? (!f.spells ? "you cannot spell" : undefined);
    out.push({ id: "spell", name: "Spell", text: f.defended ? "a word from your rack, a fifth cheaper" : "a word from your rack", legal: !why, ...(why ? { why } : {}) });
  }
  {
    const chance = fleeOdds(b, f);
    const why = helpless ?? (!f.moves ? "you are held" : undefined);
    out.push({ id: "flee", name: "Flee", text: `${Math.round(chance * 100)}% to get away`, legal: !why, ...(why ? { why } : {}), chance });
  }
  return out;
}

/** Whether a fighter may choose this action now. */
export function legal(b: Battle, id: string, action: Action): boolean {
  if (b.over) return false;
  const f = b.fighters.find((x) => x.id === id);
  if (!f || f.gone) return false;
  if (action.kind === "attack" && action.target !== undefined && !foesOf(b, f).some((o) => o.id === action.target)) return false;
  if (action.kind === "spell" && (typeof action.text !== "string" || !action.text.trim() || action.text.length > 80)) return false;
  return movesOf(b, id).find((m) => m.id === action.kind)?.legal ?? false;
}

/**
 * Plays one round. `choices` holds each fighter's committed action; a fighter with none, or an
 * illegal one, defends. Returns what happened in order, for the client to play back.
 */
export function resolveRound(b: Battle, choices: ReadonlyMap<string, Action>, rng: Rng, hooks: BattleHooks = {}): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (b.over) return events;
  b.round++;
  const round = b.round;
  for (const f of b.fighters) if (active(f) && hooks.refresh?.(f) === false) f.gone = "down";
  const pace = fatigue(round);
  if (pace > 1) events.push({ kind: "fatigue", share: pace });

  // What each does: the choice if it is legal, else Defend; nothing at all for the helpless.
  const doing = new Map<string, Action | null>();
  for (const f of b.fighters) {
    if (!active(f)) continue;
    const chosen = choices.get(f.id);
    doing.set(f.id, !canAct(f) ? null : chosen && legal(b, f.id, chosen) ? chosen : { kind: "defend" });
  }
  // Charge: gained by everyone who can act and is not holding a wound-up blow.
  for (const f of b.fighters) if (active(f) && canAct(f) && !f.windup && !f.stalled) f.charge += rateOf(f);

  const defending = new Set<string>();
  for (const f of b.fighters) {
    if (!active(f)) continue;
    if (doing.get(f.id)?.kind === "defend") { defending.add(f.id); events.push({ kind: "defend", by: f.id }); }
    else if (doing.get(f.id) === null) events.push({ kind: "skip", by: f.id, why: "cannot act" });
  }

  // Initiative: fastest first; ties by agility, then a roll. In round 1 a ranged weapon goes before a swung one.
  const rolls = new Map(b.fighters.map((f) => [f.id, rng()]));
  const ranged = (f: Fighter) => (round === 1 && f.unit.attack.num("attack_range") > RANGED_METERS ? 1 : 0);
  const order = b.fighters.filter(active).sort((x, y) =>
    ranged(y) - ranged(x) || y.speed - x.speed || y.unit.body.stats.num("agility") - x.unit.body.stats.num("agility") || rolls.get(y.id)! - rolls.get(x.id)!);

  const fall = (who: Fighter, by: Fighter) => {
    if (who.gone) return;
    who.gone = "down";
    who.windup = null;
    events.push({ kind: "down", who: who.id, by: by.id });
  };
  const blow = (by: Fighter, on: Fighter, heavy: boolean) => {
    const attack = by.unit.attack;
    if (heavy && defending.has(on.id)) {
      events.push({ kind: "strike", by: by.id, on: on.id, hit: false, critical: false, damage: 0, layer: "", aff: "", broke: [], heavy, dodged: true, defended: true });
      return;
    }
    const guard = defending.has(on.id);
    const how = { pace: pace * (guard ? DEFEND_SHARE : 1), block: guard && on.unit.outer.stats.num("block") > 0 ? DEFEND_BLOCK : 0 };
    const r = strikeUnit(by.unit, on.unit, rng, by.aim, how);
    by.dealt += r.damage;
    events.push({
      kind: "strike", by: by.id, on: on.id, hit: r.hit, critical: r.critical, damage: r.damage, layer: r.on === on.unit.body.name ? "" : r.on,
      aff: r.aff ?? "", broke: r.broke ?? [], heavy, dodged: false, defended: guard,
    });
    const fell = on.unit.dead;
    hooks.struck?.(by, on, r, attack);
    const up = hooks.refresh?.(on);
    if (fell || up === false || on.unit.dead) fall(on, by);
  };

  // Flee tries come before blows.
  for (const f of order) {
    if (doing.get(f.id)?.kind !== "flee" || !active(f)) continue;
    const chance = fleeOdds(b, f);
    const ok = rng() < chance;
    events.push({ kind: "flee", by: f.id, ok, chance });
    if (ok) { f.gone = "fled"; f.windup = null; } else f.fleeFails++;
  }

  for (const f of order) {
    if (!active(f)) continue;
    if (hooks.refresh?.(f) === false) { f.gone = "down"; continue; }
    // A heavy blow announced last round lands now, whatever else its striker does.
    const held = f.windup;
    if (held) {
      f.windup = null;
      const on = b.fighters.find((o) => o.id === held.on);
      if (canAct(f) && on && active(on)) blow(f, on, true);
    }
    const act = doing.get(f.id);
    if (!act || !canAct(f) || !active(f)) continue;
    if (act.kind === "spell") {
      let said = "", ok = true;
      try { said = hooks.spell ? hooks.spell(f, act.text, act.target) : act.text.toUpperCase(); } catch (e) { ok = false; said = e instanceof Error ? e.message : "cannot spell that"; }
      events.push({ kind: "spell", by: f.id, text: act.text.trim().toUpperCase(), ok, said });
      for (const o of b.fighters) if (active(o) && (hooks.refresh?.(o) === false || o.unit.dead)) fall(o, f);
    } else if (act.kind === "attack") {
      const foes = foesOf(b, f);
      const on = foes.find((o) => o.id === act.target) ?? foes[0];
      if (!on) continue;
      if (f.stalled) { events.push({ kind: "skip", by: f.id, why: "no fuel or power" }); continue; }
      if (f.charge < 1 - 1e-9) { events.push({ kind: "loading", by: f.id, ...loading(f) }); continue; }
      while (f.charge >= 1 - 1e-9 && active(on) && active(f)) {
        f.charge = Math.max(0, f.charge - 1);
        if (windupOf(f.unit.attack, on.unit.outer) > 0) {
          f.windup = { on: on.id };
          events.push({ kind: "windup", by: f.id, on: on.id });
          break;
        }
        blow(f, on, false);
        if (f.unit.attack.flag("single_use")) break;
      }
    }
  }

  // End of the round: unspent charge is kept up to a round's worth; who defended spells cheaper next.
  for (const f of b.fighters) {
    if (!active(f)) continue;
    if (doing.get(f.id)?.kind !== "attack") f.charge = Math.min(f.charge, Math.max(1, rateOf(f)));
    f.defended = defending.has(f.id);
    // Helpless too long: it shakes it off for a while.
    if (f.free > 0) f.free--;
    else if (!f.acts) { if (++f.stuck >= HELPLESS_CAP) { f.free = HELPLESS_FREE; f.stuck = 0; } }
    if (f.acts) f.stuck = 0;
  }
  const sides = new Set(b.fighters.filter(active).map((f) => f.side));
  if (sides.size <= 1) {
    const fled = b.fighters.some((f) => f.gone === "fled") && !b.fighters.some((f) => f.gone === "down");
    b.over = { why: fled ? "fled" : "down", winner: sides.size ? [...sides][0]! : null };
  } else if (round >= ROUND_CAP) {
    // Time: whoever landed more, as a challenge has it; a draw if nobody did.
    const best = [...b.fighters].filter(active).sort((x, y) => y.dealt - x.dealt);
    b.over = { why: "cap", winner: best.length > 1 && best[0]!.dealt > best[1]!.dealt ? best[0]!.side : null };
  }
  if (b.over) events.push({ kind: "end", ...b.over });
  return events;
}

/** Plays a bare battle to its end with one policy for everyone: for tests, golden duels and the matchup matrix. */
export function playOut(b: Battle, rng: Rng, policy: (b: Battle, f: Fighter) => Action = () => ({ kind: "attack" }), hooks: BattleHooks = {}): BattleEvent[] {
  const all: BattleEvent[] = [];
  while (!b.over) all.push(...resolveRound(b, new Map(b.fighters.filter(active).map((f) => [f.id, policy(b, f)])), rng, hooks));
  return all;
}

/** One event as a line of the battle log: terse, numbers first. `name` gives a fighter's name. */
export function eventLine(e: BattleEvent, name: (id: string) => string): string {
  switch (e.kind) {
    case "defend": return `${name(e.by)} defends`;
    case "flee": return e.ok ? `${name(e.by)} gets away (${Math.round(e.chance * 100)}%)` : `${name(e.by)} cannot get away (${Math.round(e.chance * 100)}%)`;
    case "loading": return `${name(e.by)} loading ${e.have}/${e.need}`;
    case "windup": return `${name(e.by)} winds up a heavy blow at ${name(e.on)}!`;
    case "strike": {
      const what = e.heavy ? "heavy blow" : "blow";
      if (e.dodged) return `${name(e.on)} defends: ${name(e.by)}'s heavy blow misses`;
      if (!e.hit) return `${name(e.by)} misses ${name(e.on)}`;
      const tags = [e.critical ? "crit!" : "", e.aff === "weak" ? "weak!" : e.aff === "resist" ? "resists" : e.aff === "immune" ? "immune" : "", e.defended ? "defended" : "", ...e.broke.map((l) => `${l.toUpperCase()} breaks`)].filter(Boolean);
      return `${name(e.by)}'s ${what}: ${Math.round(e.damage)} on ${name(e.on)}${e.layer ? `'s ${e.layer.toUpperCase()}` : ""}${tags.length ? ` · ${tags.join(" · ")}` : ""}`;
    }
    case "spell": return e.ok ? `${name(e.by)} spells ${e.text}` : `${name(e.by)}: ${e.said}`;
    case "skip": return `${name(e.by)} ${e.why}`;
    case "down": return `${name(e.who)} is down`;
    case "fatigue": return `fatigue: blows land ×${e.share.toFixed(2)}`;
    case "end": return e.why === "cap" ? "time: the ring opens" : e.why === "fled" ? "the battle is over: one side ran" : "the battle is over";
  }
}
