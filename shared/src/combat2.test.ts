import { describe, expect, it } from "vitest";
import {
  affinity, affinityText, cardOf, carries, damageShare, doorProblem, gambleOdds, hampered, leashed, luckyChance, magnetPull, mirrored,
  NATURE_MATRIX, parsePhrase, rerolled, resolve, rideProblem, sizeOf, slipsUnder, spawn, statureOf, statusEffects, STATUS_RULES, strike,
  trapMissChance, Unit, weaknesses, type Affliction,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const hit = () => 0.5;
const words = [...dict.words];
const nouns = words.filter(([, d]) => d.role === "noun");
const opOn = (d: { ops: [string, string, number][] }, p: string) => d.ops.some((o) => o[0] === p);

describe("concept batch: damage natures and the matrix", () => {
  it("every nature in the data is a row of the matrix", () => {
    const used = new Set<string>();
    for (const [, d] of words) for (const n of (d.set.nature as string[] | undefined) ?? []) used.add(n);
    for (const n of used) expect(NATURE_MATRIX, n).toHaveProperty(n);
    expect(used.size).toBeGreaterThanOrEqual(20);
  });

  it("covers nearly every body in the dictionary by meaning (audit printed)", () => {
    const classes = ["creature", "person", "flora", "artifact", "material", "bodypart", "consumable", "terrain"];
    const rows: string[] = [];
    let all = 0, given = 0, weakOrResist = 0;
    for (const cls of classes) {
      const of = nouns.filter(([, d]) => d.class === cls);
      const n = of.filter(([, d]) => Array.isArray(d.set.nature) && (d.set.nature as string[]).length).length;
      const wr = of.filter(([w]) => { try { const k = weaknesses(resolve(dict, w)); return k.weak.length + k.resist.length + k.immune.length > 0; } catch { return false; } }).length;
      all += of.length; given += n; weakOrResist += wr;
      rows.push(`${cls.padEnd(11)} ${String(of.length).padStart(5)} words, nature ${String(n).padStart(5)} (${Math.round((100 * n) / of.length)}%), a weakness or resistance ${wr} (${Math.round((100 * wr) / of.length)}%)`);
    }
    const byNature = new Map<string, number>();
    for (const [, d] of words) for (const n of (d.set.nature as string[] | undefined) ?? []) byNature.set(n, (byNature.get(n) ?? 0) + 1);
    console.log(`Natures by class:\n${rows.join("\n")}\nall ${all}: nature ${given}, weak or resisting ${weakOrResist}\nby nature: ${[...byNature].sort((a, b) => b[1] - a[1]).map(([n, k]) => `${n} ${k}`).join(", ")}`);
    for (const cls of ["creature", "person", "flora"]) {
      const of = nouns.filter(([, d]) => d.class === cls);
      expect(of.filter(([, d]) => Array.isArray(d.set.nature)).length / of.length, cls).toBeGreaterThan(0.95);
    }
    expect(given).toBeGreaterThan(4000);
  });

  it("wood burns, stone does not, iron conducts, ghosts ignore crush, the undead fear holy", () => {
    const wood = spawn("fence", resolve(dict, "fence")), stone = spawn("wall", resolve(dict, "wall"));
    expect(resolve(dict, "fence").tags("nature")).toContain("wood");
    expect(damageShare(wood.stats, "fire")).toBeGreaterThan(damageShare(stone.stats, "fire"));
    expect(damageShare(stone.stats, "slash")).toBeLessThan(1);
    expect(damageShare(resolve(dict, "sword"), "electric")).toBeGreaterThan(1); // steel: conducts (material.ts) and metal
    const ghost = spawn("ghost", resolve(dict, "ghost"));
    expect(affinity(ghost.stats, "crush")).toBe(0);
    const club = strike(resolve(dict, "hammer"), ghost, hit);
    expect(club.damage).toBe(0);
    expect(club.aff).toBe("immune");
    const zombie = spawn("zombie", resolve(dict, "zombie"));
    expect(affinity(zombie.stats, "holy")).toBeGreaterThan(1);
    const r = strike(resolve(dict, "torch"), zombie, hit);
    expect(r.aff).toBe("weak");
  });

  it("a material before a noun remakes its nature; an adjective adds its own", () => {
    expect(resolve(dict, "sword").tags("nature")).toContain("metal");
    expect(resolve(dict, "sword", ["glass"]).tags("nature")).toEqual(expect.arrayContaining(["glass"]));
    expect(resolve(dict, "sword", ["glass"]).tags("nature")).not.toContain("metal");
    expect(resolve(dict, "dog", ["iron"]).tags("nature")).toEqual(expect.arrayContaining(["metal", "beast"]));
    expect(resolve(dict, "wolf", ["holy"]).tags("nature")).toEqual(expect.arrayContaining(["beast", "holy"]));
  });

  it("cards and hits say weak and resists", () => {
    const ghost = cardOf(dict, parsePhrase(dict, "ghost")).does.join(" | ");
    expect(ghost).toMatch(/spirit/);
    expect(ghost).toMatch(/weak to [^|]*holy/);
    expect(ghost).toMatch(/immune to [^|]*crush/);
    expect(affinityText(resolve(dict, "wall")).join(" ")).toMatch(/resists/);
    const plated = strike(resolve(dict, "sword"), spawn("wall", resolve(dict, "wall")), hit);
    expect(plated.aff).toBe("resist");
  });
});

describe("concept batch: luck and rerolls", () => {
  it("luck shifts every chance; rerolls throw a failure again", () => {
    expect(luckyChance(0.5)).toBe(0.5);
    expect(luckyChance(0.5, 5)).toBeCloseTo(0.65);
    expect(luckyChance(0.5, -20)).toBe(0);
    expect(luckyChance(0.5, 0, 1)).toBeCloseTo(0.75);
    expect(rerolled(0.6, 1)).toBeCloseTo(0.84);
    expect(trapMissChance(-5)).toBe(0);
    expect(trapMissChance(4)).toBeCloseTo(0.24);
    expect(gambleOdds(0)).toBe(0.5);
    expect(gambleOdds(4, 1)).toBeGreaterThan(0.8);
  });

  it("charms raise luck, jinxes and curses lower it, dice reroll", () => {
    const luckOf = (items: string[]) => new Unit(dict, { body: { noun: "human" }, items: items.map((noun) => ({ noun })) }).body.stats.num("luck");
    for (const w of ["clover", "horseshoe", "amulet", "talisman"]) expect(luckOf([w]), w).toBeGreaterThan(0);
    expect(dict.word("jinx")!.ops.find((o) => o[0] === "luck")![2]).toBeLessThan(0);
    const cursed = new Unit(dict, { body: { noun: "human" }, effects: statusEffects([{ status: "curse", left: 10, from: "x", origin: "x" }]) });
    expect(cursed.body.stats.num("luck")).toBeLessThan(0);
    const dice = new Unit(dict, { body: { noun: "human" }, items: [{ noun: "dice" }] }), bare = new Unit(dict, { body: { noun: "human" } });
    expect(dice.body.stats.num("rerolls")).toBeGreaterThanOrEqual(1);
    expect(dice.body.stats.num("accuracy")).toBeGreaterThan(bare.body.stats.num("accuracy"));
    expect(dict.word("dice")!.set.gamble).toBeGreaterThan(0);
    expect(dict.word("fate")!.set.gamble).toBeGreaterThan(0);
  });

  it("hooks luck words in by meaning (audit)", () => {
    const luck = words.filter(([, d]) => "luck" in d.set || opOn(d, "luck")).length;
    const chance = words.filter(([, d]) => opOn(d, "rerolls") || "gamble" in d.set).length;
    console.log(`Luck: ${luck} words move luck, ${chance} reroll or gamble`);
    expect(luck).toBeGreaterThan(200);
    expect(chance).toBeGreaterThanOrEqual(10);
  });
});

describe("concept batch: scale", () => {
  it("size adjectives, verbs and potions scale size by what they do to height and mass", () => {
    expect(sizeOf(resolve(dict, "wolf", ["huge"]))).toBe(4);
    expect(sizeOf(resolve(dict, "wolf", ["tiny"]))).toBeCloseTo(0.1);
    expect(sizeOf(resolve(dict, "human", ["gigantic"]))).toBe(4);
    expect(sizeOf(resolve(dict, "horse", ["miniature"]))).toBeCloseTo(0.1);
    const sized = words.filter(([, d]) => opOn(d, "size")).length;
    console.log(`Scale: ${sized} words change size`);
    expect(sized).toBeGreaterThan(200);
  });

  it("a giant reaches, sees and strides farther and carries more; shrinking does the reverse", () => {
    const plain = new Unit(dict, { body: { noun: "human" }, items: [{ noun: "sword" }] });
    const giant = new Unit(dict, { body: { noun: "human", adjectives: ["gigantic"] }, items: [{ noun: "sword" }] });
    expect(giant.attack.num("attack_range")).toBeCloseTo(plain.attack.num("attack_range") * 4);
    expect(giant.body.stats.num("sight_range")).toBeCloseTo(plain.body.stats.num("sight_range") * 2);
    const shrunk = new Unit(dict, { body: { noun: "human" }, effects: statusEffects([{ status: "shrink", left: 10, from: "x", origin: "x" }]) });
    expect(sizeOf(shrunk.body.stats)).toBeCloseTo(0.25);
    expect(shrunk.body.stats.num("sight_range")).toBeCloseTo(plain.body.stats.num("sight_range") * 0.5);
  });

  it("stature decides doors, rides and what carries whom", () => {
    const person = statureOf(70, 1);
    expect(person).toBeCloseTo(1);
    expect(doorProblem(statureOf(70, 4))).toMatch(/too big/);
    expect(doorProblem(person)).toBeNull();
    expect(doorProblem(statureOf(Number(dict.base("giant", "mass")), 1))).toMatch(/too big/);
    expect(slipsUnder(statureOf(Number(dict.base("mouse", "mass")), 1))).toBe(true);
    expect(slipsUnder(statureOf(70, 0.25))).toBe(true);
    const horse = statureOf(Number(dict.base("horse", "mass")), 1);
    expect(rideProblem(person, horse, "horse")).toBeNull();
    expect(rideProblem(statureOf(70, 4), horse, "horse")).toMatch(/too small/);
    expect(carries(statureOf(70, 0.25), statureOf(Number(dict.base("wolf", "mass")), 1))).toBe(true);
    expect(carries(person, statureOf(Number(dict.base("wolf", "mass")), 1))).toBe(false);
  });
});

describe("concept batch: control", () => {
  const a = (status: Affliction["status"], from = "caster"): Affliction => ({ status, left: 10, from, origin: from });

  it("statuses say who steers: hypnosis its caster, a leash its holder; drunk sways, reverse mirrors", () => {
    const h = hampered([a("hypnosis"), a("leash", "holder")]);
    expect(h.steeredBy).toBe("caster");
    expect(h.leashedTo).toBe("holder");
    expect(h.spares).toContain("caster");
    expect(STATUS_RULES.hypnosis.living).toBe(true);
    const drunk = new Unit(dict, { body: { noun: "human" }, effects: statusEffects([a("drunk")]) });
    expect(drunk.body.stats.num("wobble")).toBeGreaterThan(0);
    const turned = new Unit(dict, { body: { noun: "human" }, effects: statusEffects([a("reverse")]) });
    expect(turned.body.stats.num("reversed")).toBeGreaterThan(0);
    expect(mirrored({ x: 10, y: 10 }, { x: 12, y: 9 })).toEqual({ x: 8, y: 11 });
  });

  it("a leash pulls back to its length; a magnet pulls metal, more of it faster, none past its reach", () => {
    expect(leashed({ x: 0, y: 0 }, { x: 3, y: 0 })).toBeNull();
    expect(leashed({ x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 6, y: 0 });
    expect(magnetPull(8, 0, 2)).toBe(0);
    expect(magnetPull(8, 30, 2)).toBeGreaterThan(magnetPull(8, 1, 2));
    expect(magnetPull(8, 30, 100)).toBe(0);
  });

  it("drink and words hook in by meaning, with counters", () => {
    expect(resolve(dict, "human").num("wobble")).toBe(0);
    expect(dict.word("beer")!.ops.some((o) => o[0] === "wobble" && o[2] > 0)).toBe(true);
    expect(dict.word("dizzy")!.ops.some((o) => o[0] === "wobble")).toBe(true);
    expect(dict.word("lasso")!.set.inflict_leash).toBeGreaterThan(0);
    expect(dict.word("lasso")!.set.inflict_root).toBeUndefined();
    expect(dict.word("marionette")!.set.inflict_hypnosis).toBeGreaterThan(0);
    expect(dict.word("scissors")!.set.effect_status).toContain("leash");
    expect(dict.word("sober")!.set.effect_status).toContain("drunk");
    expect(dict.word("awaken")!.set.effect_status).toContain("hypnosis");
    expect(dict.word("reversal")!.set.inflict_reverse).toBeGreaterThan(0);
    const count = (p: (d: (typeof words)[number][1]) => boolean) => words.filter(([, d]) => p(d)).length;
    const steer = count((d) => ["inflict_drunk", "inflict_reverse", "inflict_hypnosis", "inflict_leash"].some((k) => k in d.set) || opOn(d, "wobble") || opOn(d, "reversed") || (typeof d.set.magnetism === "number" && d.set.magnetism >= 3));
    const cures = count((d) => Array.isArray(d.set.effect_status) && (d.set.effect_status as string[]).some((s) => ["drunk", "reverse", "hypnosis", "leash"].includes(s)));
    console.log(`Control: ${steer} words steer bodies, ${cures} end it`);
    expect(steer).toBeGreaterThan(100);
    expect(cures).toBeGreaterThan(50);
  });
});
