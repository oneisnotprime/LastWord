import { describe, expect, it } from "vitest";
import { demo } from "./testdata.js";
import { seeded } from "./rng.js";
import { Unit } from "./unit.js";
import { windupOf } from "./combat.js";
import {
  bars, fatigue, fighter, fleeChance, legal, loading, movesOf, playOut, preview, rateOf, resolveRound, startBattle,
  DEFEND_SHARE, FATIGUE_FROM, FLEE_MAX, FLEE_MIN, ROUND_CAP, type Action, type Battle, type BattleEvent,
} from "./battle.js";

const dict = demo();
const unit = (items: string[] = [], riding?: string, body: string[] = []) =>
  new Unit(dict, { body: { noun: "human", adjectives: body }, items: items.map((noun) => ({ noun })), ...(riding ? { riding: { noun: riding } } : {}) });
const versus = (a: Unit, b: Unit, speeds: [number, number] = [8, 8]): Battle =>
  startBattle([fighter("a", "A", 0, a, speeds[0]), fighter("b", "B", 1, b, speeds[1])]);
const round = (b: Battle, a: Action, o: Action, seed = 1): BattleEvent[] => resolveRound(b, new Map([["a", a], ["b", o]]), seeded(seed));
const strikes = (ev: BattleEvent[], by: string) => ev.filter((e) => e.kind === "strike" && e.by === by) as Extract<BattleEvent, { kind: "strike" }>[];
const ATTACK: Action = { kind: "attack" }, DEFEND: Action = { kind: "defend" };
/** A body nothing fells, so cadence can be counted over many rounds. */
const dummy = () => { const u = unit(); u.body.integrity = 1e12; return u; };
const sure = (u: Unit) => { u.body.stats.set("accuracy", "ABS"); return u; };

describe("battle stats come from word properties (plan 5.2)", () => {
  it("SWORD: one Slash a round for 20 on a bare person; nothing through ARMOR, and the card says so", () => {
    const b = versus(unit(["sword"]), unit());
    const m = movesOf(b, "a")[0]!;
    expect(m.name).toBe("Slash · SWORD");
    expect(Math.round(m.damage!)).toBe(20);
    expect(m.strikes).toBe(1);
    expect(m.heavy).toBe(false);
    const armored = movesOf(versus(unit(["sword"]), unit(["armor"])), "a")[0]!;
    expect(armored.damage).toBe(0);
    expect(armored.text).toMatch(/0 on ARMOR · resists/);
  });

  it("SHIELD is a 173 HP layer in front of the body; ARMOR 200; bars are felt numbers", () => {
    expect(bars(unit(["shield", "sword"]))).toEqual([{ name: "shield", hp: 173, max: 173, body: false }, { name: "human", hp: 100, max: 100, body: true }]);
    expect(bars(unit(["armor"]))[0]).toMatchObject({ name: "armor", max: 200 });
  });

  it("BOW shoots three rounds in five and goes first in round 1", () => {
    const b = versus(sure(unit(["bow"])), dummy(), [5, 50]);
    expect(movesOf(b, "a")[0]!.name).toBe("Shoot · BOW");
    const per: number[] = [];
    for (let i = 0; i < 5; i++) per.push(strikes(round(b, ATTACK, DEFEND), "a").length);
    expect(per).toEqual([0, 1, 0, 1, 1]);
    // Round 1: the ranged weapon acts before a faster swung one.
    const first = versus(unit(["bow"]), sure(unit(["sword"])), [5, 50]);
    const ev = round(first, ATTACK, ATTACK);
    expect(ev.findIndex((e) => e.kind === "loading" && e.by === "a")).toBeLessThan(ev.findIndex((e) => e.kind === "strike" && e.by === "b"));
  });

  it("TANK: a 1,095 HP layer, loads seven rounds, then a telegraphed blast of 173 that Defend dodges", () => {
    const tank = sure(unit([], "tank"));
    expect(bars(tank)[0]).toMatchObject({ name: "tank", max: 1095 });
    const b = versus(tank, unit());
    const m = movesOf(b, "a")[0]!;
    expect(m.name).toBe("Blast · TANK");
    expect(Math.round(m.damage!)).toBe(173);
    expect(m.heavy).toBe(true);
    expect(m.text).toMatch(/loading 1\/7/);
    for (let i = 1; i <= 6; i++) expect(round(b, ATTACK, DEFEND).some((e) => e.kind === "loading" && e.by === "a" && e.have === i && e.need === 7)).toBe(true);
    expect(round(b, ATTACK, DEFEND).some((e) => e.kind === "windup" && e.by === "a" && e.on === "b")).toBe(true); // round 7: announced
    const land = strikes(round(b, ATTACK, DEFEND), "a");
    expect(land).toHaveLength(1);
    expect(land[0]).toMatchObject({ heavy: true, dodged: true, damage: 0 });
    // Not defended, it fells a bare person.
    const c = versus(sure(unit([], "tank")), unit());
    for (let i = 0; i < 7; i++) round(c, ATTACK, DEFEND);
    const ev = round(c, ATTACK, ATTACK);
    expect(ev.some((e) => e.kind === "down" && e.who === "b")).toBe(true);
    expect(c.over).toEqual({ why: "down", winner: 0 });
    // A sword cannot scratch it.
    expect(preview(unit(["sword"]).attack, unit([], "tank")).damage).toBe(0);
  });

  it("HORSE: a 200 HP layer and a kick of 30 every other round; DRAGON: 2,449 HP and 292 a breath", () => {
    const horse = unit([], "horse");
    expect(bars(horse)[0]).toMatchObject({ name: "horse", max: 200 });
    expect(horse.movement.num("speed_land")).toBe(18);
    const b = versus(horse, unit());
    expect(Math.round(movesOf(b, "a")[0]!.damage!)).toBe(30);
    expect(loading({ ...b.fighters[0]!, charge: 0.5 })).toEqual({ have: 1, need: 2 });
    const dragon = unit([], "dragon");
    expect(bars(dragon)[0]).toMatchObject({ name: "dragon", max: 2449 });
    const m = movesOf(versus(dragon, unit()), "a")[0]!;
    expect(Math.round(m.damage!)).toBe(292);
    expect(m.heavy).toBe(true);
  });

  it("CLOVER and DICE: luck moves the hit roll and the flee roll", () => {
    const plain = unit(), lucky = unit(["clover"]);
    expect(lucky.body.stats.num("luck")).toBeGreaterThan(plain.body.stats.num("luck"));
    expect(lucky.body.stats.num("accuracy")).toBeGreaterThan(plain.body.stats.num("accuracy"));
    expect(fleeChance(8, 8, 4)).toBeCloseTo(0.62);
    expect(fleeChance(8, 8, 0, 1)).toBeCloseTo(0.75); // a reroll: thrown again
  });

  it("every weapon keeps its rate: strikes in sixty rounds are its attack_rate times sixty (a heavy one spends a round winding up)", () => {
    let n = 0, heavyN = 0;
    for (const [word, def] of dict.words) {
      if (n >= 250) break;
      if (def.role !== "noun" || !/^[a-z]+$/.test(word)) continue;
      let u: Unit;
      try { u = unit([word]); } catch { continue; }
      if (u.weapon?.noun !== word || u.attack.flag("single_use")) continue;
      const rate = u.attack.num("attack_rate");
      if (!(rate > 0) || rate === Infinity) continue;
      const target = dummy();
      const heavy = windupOf(u.attack, target.outer) > 0;
      const b = versus(u, target);
      let count = 0;
      for (let i = 0; i < 60; i++) { b.round = 1; b.over = null; count += strikes(resolveRound(b, new Map<string, Action>([["a", ATTACK], ["b", DEFEND]]), seeded(i)), "a").length; }
      if (!heavy) expect(Math.abs(count - 60 * rate), word).toBeLessThanOrEqual(1);
      else {
        // Each blow takes the rounds to load it and one more to land.
        const cycle = 1 / rate + 1;
        expect(count, word).toBeGreaterThanOrEqual(Math.floor(60 / (Math.ceil(1 / rate) + 1)) - 1);
        expect(count, word).toBeLessThanOrEqual(Math.ceil(60 / cycle) + 1);
        heavyN++;
      }
      n++;
    }
    expect(n).toBe(250);
    expect(heavyN).toBeGreaterThan(10);
  }, 30000);
});

describe("a round", () => {
  it("charge: rate 1.2 strikes twice every fifth round, rate 2 twice a round; unspent charge keeps one round's worth", () => {
    const fast = sure(unit(["sword"]));
    const b = versus(fast, dummy());
    b.fighters[0]!.tempo = 1.2;
    expect(rateOf(b.fighters[0]!)).toBeCloseTo(1.2);
    const per: number[] = [];
    for (let i = 0; i < 5; i++) per.push(strikes(round(b, ATTACK, DEFEND), "a").length);
    expect(per).toEqual([1, 1, 1, 1, 2]);
    const twice = versus(sure(unit(["sword"])), dummy());
    twice.fighters[0]!.tempo = 2;
    expect(strikes(round(twice, ATTACK, DEFEND), "a")).toHaveLength(2);
    // Three rounds of defending bank one strike, not three.
    const held = versus(sure(unit(["sword"])), dummy());
    for (let i = 0; i < 3; i++) round(held, DEFEND, DEFEND);
    expect(strikes(round(held, ATTACK, DEFEND), "a")).toHaveLength(2);
    expect(strikes(round(held, ATTACK, DEFEND), "a")).toHaveLength(1);
  });

  it("Defend halves what lands; nothing chosen is Defend; an illegal choice is Defend", () => {
    const open = versus(sure(unit(["sword"])), unit());
    const full = strikes(round(open, ATTACK, { kind: "spell", text: "x" }), "a")[0]!;
    const guarded = versus(sure(unit(["sword"])), unit());
    const half = strikes(round(guarded, ATTACK, DEFEND), "a")[0]!;
    expect(half.damage).toBeCloseTo(full.damage * DEFEND_SHARE);
    expect(half.defended).toBe(true);
    const idle = versus(sure(unit(["sword"])), unit());
    const ev = resolveRound(idle, new Map([["a", ATTACK]]), seeded(1));
    expect(ev.some((e) => e.kind === "defend" && e.by === "b")).toBe(true);
    expect(idle.fighters[1]!.defended).toBe(true);
    const bad = versus(sure(unit(["sword"])), unit());
    expect(legal(bad, "b", { kind: "attack", target: "nobody" })).toBe(false);
    expect(round(bad, ATTACK, { kind: "attack", target: "nobody" }).some((e) => e.kind === "defend" && e.by === "b")).toBe(true);
  });

  it("a heavy blow is announced, lands next round whatever its striker does, and is lost if the striker cannot act", () => {
    const b = versus(sure(unit(["axe"])), unit());
    expect(movesOf(b, "a")[0]!.heavy).toBe(true);
    round(b, ATTACK, DEFEND); // loading (rate 0.7)
    expect(round(b, ATTACK, DEFEND).some((e) => e.kind === "windup")).toBe(true);
    expect(b.fighters[0]!.windup).toEqual({ on: "b" });
    const landed = strikes(round(b, DEFEND, ATTACK), "a");
    expect(landed).toHaveLength(1);
    expect(landed[0]!.heavy).toBe(true);
    expect(landed[0]!.damage).toBeGreaterThan(20);
    // Stunned before it lands: lost.
    const c = versus(sure(unit(["axe"])), unit());
    round(c, ATTACK, DEFEND); round(c, ATTACK, DEFEND);
    c.fighters[0]!.acts = false;
    expect(strikes(round(c, ATTACK, ATTACK), "a")).toHaveLength(0);
    expect(c.fighters[0]!.windup).toBeNull();
  });

  it("order: the faster strikes first; the helpless do nothing", () => {
    const b = versus(sure(unit(["sword"])), sure(unit(["sword"])), [5, 18]);
    const ev = round(b, ATTACK, ATTACK);
    expect(strikes(ev, "b")[0]).toBe(ev.find((e) => e.kind === "strike"));
    const c = versus(sure(unit(["sword"])), sure(unit(["sword"])));
    c.fighters[1]!.acts = false;
    const out = round(c, ATTACK, ATTACK);
    expect(out.some((e) => e.kind === "skip" && e.by === "b")).toBe(true);
    expect(strikes(out, "b")).toHaveLength(0);
    expect(movesOf(c, "b").every((m) => !m.legal)).toBe(true);
  });

  it("spelling is a move: the word goes through the game's own spelling, and a refusal costs the action", () => {
    const b = versus(unit(["sword"]), unit());
    const cast: string[] = [];
    const ev = resolveRound(b, new Map<string, Action>([["a", { kind: "spell", text: "shield" }], ["b", { kind: "spell", text: "zzz" }]]), seeded(1), {
      spell: (f, text) => { if (text === "zzz") throw new Error("ZZZ is not a word"); cast.push(`${f.id}:${text}`); return "SHIELD in hand"; },
    });
    expect(cast).toEqual(["a:shield"]);
    expect(ev).toContainEqual({ kind: "spell", by: "a", text: "SHIELD", ok: true, said: "SHIELD in hand" });
    expect(ev).toContainEqual({ kind: "spell", by: "b", text: "ZZZ", ok: false, said: "ZZZ is not a word" });
    const mute = versus(unit(), unit());
    mute.fighters[0]!.spells = false;
    expect(legal(mute, "a", { kind: "spell", text: "sword" })).toBe(false);
  });

  it("fatigue from round 10 and the cap at 15: whoever landed more wins, else a draw", () => {
    expect(fatigue(FATIGUE_FROM - 1)).toBe(1);
    expect(fatigue(FATIGUE_FROM)).toBe(1.25);
    expect(fatigue(ROUND_CAP)).toBe(2.5);
    const b = versus(unit(), unit());
    const ev = playOut(b, seeded(3), () => DEFEND);
    expect(b.round).toBe(ROUND_CAP);
    expect(b.over).toEqual({ why: "cap", winner: null });
    expect(ev.at(-1)).toEqual({ kind: "end", why: "cap", winner: null });
    const c = versus(sure(unit(["sword"])), dummy());
    playOut(c, seeded(3), (_, f) => (f.id === "a" ? ATTACK : DEFEND));
    expect(c.over).toEqual({ why: "cap", winner: 0 });
    // A blow in round 10 lands a quarter more than the same blow in round 9.
    const d = versus(sure(unit(["sword"])), dummy());
    let ninth = 0, tenth = 0;
    for (let i = 1; i <= 10; i++) { const s = strikes(round(d, ATTACK, { kind: "spell", text: "x" }), "a")[0]!; if (i === 9) ninth = s.damage; if (i === 10) tenth = s.damage; }
    expect(tenth).toBeCloseTo(ninth * 1.25);
  });

  it("a bare duel plays out in about the old fight's seconds", () => {
    // SWORD against a bare person: 100 HP at 20 a blow, 90% to hit: five to seven rounds.
    const lengths: number[] = [];
    for (let seed = 1; seed <= 40; seed++) { const b = versus(unit(["sword"]), unit()); playOut(b, seeded(seed)); expect(b.over!.winner).toBe(0); lengths.push(b.round); }
    lengths.sort((x, y) => x - y);
    expect(lengths[20]).toBeGreaterThanOrEqual(5);
    expect(lengths[20]).toBeLessThanOrEqual(7);
  });
});

describe("the helpless", () => {
  it("nobody sits a battle out: two rounds unable to act, then two acting whatever is on them", () => {
    const b = versus(sure(unit(["sword"])), dummy());
    const acted: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      b.fighters[0]!.acts = false; // the server says so every round: a fear that never ends
      acted.push(strikes(round(b, ATTACK, DEFEND), "a").length > 0);
    }
    expect(acted).toEqual([false, false, true, true, false, false, true, true]);
    expect(movesOf(b, "a")[0]!.legal).toBe(false);
  });
});

describe("flee", () => {
  it("the curve: even at equal speed, 90% at double, 10% at half or worse, 15% more a failed try", () => {
    expect(fleeChance(8, 8)).toBeCloseTo(0.5);
    expect(fleeChance(16, 8)).toBeCloseTo(0.9);
    expect(fleeChance(18, 5)).toBe(FLEE_MAX);
    expect(fleeChance(4, 8)).toBeCloseTo(FLEE_MIN);
    expect(fleeChance(1, 80)).toBe(FLEE_MIN);
    expect(fleeChance(8, 8, 0, 0, 2)).toBeCloseTo(0.8);
    expect(fleeChance(0, 8)).toBe(0);
  });

  it("a rider gets away from a walker; getting away ends the battle for the other side; the held cannot try", () => {
    let away = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const b = versus(unit([], "horse"), unit(["sword"]), [18, 8]);
      const ev = round(b, { kind: "flee" }, ATTACK, seed);
      if (b.over) { away++; expect(b.over).toEqual({ why: "fled", winner: 1 }); expect(strikes(ev, "b")).toHaveLength(0); }
      else expect(b.fighters[0]!.fleeFails).toBe(1);
    }
    expect(away).toBeGreaterThan(170);
    const held = versus(unit(), unit());
    held.fighters[0]!.moves = false;
    expect(legal(held, "a", { kind: "flee" })).toBe(false);
    expect(movesOf(held, "a").find((m) => m.id === "flee")!.why).toBe("you are held");
  });
});
