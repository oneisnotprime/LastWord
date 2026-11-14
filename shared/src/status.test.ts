import { describe, expect, it } from "vitest";
import {
  afflict, cure, effectSeconds, statusSeconds, STATUS_STRETCH, hampered, inflicts, resolve, spawn, statusDamage, statusEffects, STATUSES, strike, tickStatuses, Unit, wake,
  type Affliction, type Status,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const human = () => resolve(dict, "human");
/** A human with these statuses on it, as the server builds one. */
const sufferer = (list: Affliction[]) => new Unit(dict, { body: { noun: "human" }, effects: statusEffects(list) });
const given = (status: Status, seconds = 5): Affliction[] => {
  const list: Affliction[] = [];
  afflict(list, [[status, seconds]], human(), "attacker");
  return list;
};

describe("inflicting statuses", () => {
  it("reads every inflict_* the striking stats carry, the most of any", () => {
    const snake = resolve(dict, "snake");
    expect(inflicts(snake)).toEqual([["poison", 30]]);
    const body = resolve(dict, "human");
    body.set("inflict_poison", 50);
    body.set("inflict_fear", 2);
    expect(inflicts(snake, body)).toEqual([["fear", 2], ["poison", 50]]);
  });

  it("is blocked by the matching immune_* flag", () => {
    const zombie = resolve(dict, "zombie"); // immune to fear, poison and sleep
    const list: Affliction[] = [];
    expect(afflict(list, [["fear", 5], ["poison", 5], ["stun", 5]], zombie, "a")).toEqual(["stun"]);
    expect(list.map((a) => a.status)).toEqual(["stun"]);
  });

  it("leaves things that are not alive free of poison, bleeding, sleep, fear and charm", () => {
    const robot = human();
    robot.set("alive", false);
    const list: Affliction[] = [];
    afflict(list, [["poison", 5], ["bleed", 5], ["sleep", 5], ["fear", 5], ["charm", 5], ["burn", 5]], robot, "a");
    expect(list.map((a) => a.status)).toEqual(["burn"]);
  });

  it("refreshes to the longer time, and ticks down until it ends", () => {
    const list = given("stun", 5);
    afflict(list, [["stun", 2]], human(), "b");
    expect(list[0]).toMatchObject({ left: statusSeconds("stun", 5), from: "attacker" });
    afflict(list, [["stun", 8]], human(), "b");
    const eight = statusSeconds("stun", 8);
    expect(list[0]).toMatchObject({ left: eight, from: "b" });
    expect(tickStatuses(list, eight - 0.5)).toEqual([]);
    expect(tickStatuses(list, 1)).toEqual(["stun"]);
    expect(list).toEqual([]);
  });

  it("lasts longer on the cowardly and the disloyal, shorter on the brave", () => {
    const coward = human();
    coward.set("courage", 1);
    const hero = human();
    hero.set("courage", 10);
    const a: Affliction[] = [], b: Affliction[] = [];
    afflict(a, [["fear", 4]], coward, "x");
    afflict(b, [["fear", 4]], hero, "x");
    expect(a[0]!.left).toBeCloseTo(statusSeconds("fear", 4) * 5);
    expect(b[0]!.left).toBeCloseTo(statusSeconds("fear", 4) / 2);
    const brave = human();
    brave.set("courage", "ABS");
    const c: Affliction[] = [];
    expect(afflict(c, [["fear", 4]], brave, "x")).toEqual([]);
  });

  it("runs longer than the word says: helpless and hurting ones a few times, the rest about ten, long ones bent back", () => {
    expect(statusSeconds("stun", 1)).toBeCloseTo(2.95, 1);
    expect(statusSeconds("fear", 8)).toBeGreaterThan(40);
    expect(statusSeconds("poison", 30)).toBeLessThan(30 * STATUS_STRETCH.poison);
    expect(statusSeconds("root", 600)).toBe(600); // a JAIL is not made longer
    for (const s of STATUSES) expect(statusSeconds(s, 3)).toBeGreaterThan(3);
    // PUNCH's one second lasts about twenty; RUN's thirty a few minutes; what is already long stays.
    expect(effectSeconds(1)).toBeCloseTo(18.75);
    expect(effectSeconds(30)).toBe(200);
    expect(effectSeconds(900)).toBe(900);
    expect(effectSeconds(Infinity)).toBe(Infinity);
  });

  it("is removed by name, as HEAL removes poison", () => {
    const list: Affliction[] = [];
    afflict(list, [["poison", 5], ["stun", 5], ["bleed", 5]], human(), "a");
    expect(cure(list, dict.word("heal")!.set.effect_status as string[]).sort()).toEqual(["bleed", "poison"]);
    expect(list.map((a) => a.status)).toEqual(["stun"]);
  });
});

describe("what each status does", () => {
  const free = hampered([]);
  it("leaves the unafflicted free", () => {
    expect(free).toEqual({ moves: true, acts: true, spells: true, random: false, tempo: 1, flees: [], spares: [], berserk: false, deaf: false, time: 1, untouchable: false, nulled: false });
  });

  it("stun: cannot move, strike or spell", () => {
    expect(hampered(given("stun"))).toMatchObject({ moves: false, acts: false, spells: false });
  });

  it("root: cannot move, can still strike and spell", () => {
    expect(hampered(given("root"))).toMatchObject({ moves: false, acts: true, spells: true });
  });

  it("slow: half speed and half the strikes", () => {
    const u = sufferer(given("slow"));
    expect(u.body.stats.num("speed_land")).toBe(2.5);
    expect(hampered(given("slow")).tempo).toBe(0.5);
  });

  it("blind: sees almost nothing and rarely lands a blow", () => {
    const u = sufferer(given("blind"));
    expect(u.body.stats.num("sight_range")).toBeCloseTo(3);
    expect(u.body.stats.num("accuracy")).toBeCloseTo(0.27);
  });

  it("fear: runs from what frightened it and does not strike", () => {
    const list: Affliction[] = [];
    afflict(list, [["fear", 5]], human(), "owner", "zone1");
    expect(hampered(list)).toMatchObject({ acts: false, moves: true, flees: ["zone1"] });
  });

  it("burn, poison, bleed: damage every second, of fire, poison and slash", () => {
    for (const [status, type, amount] of [["burn", "fire", 8], ["poison", "poison", 5], ["bleed", "slash", 6]] as const) {
      const hurt = statusDamage(dict, given(status))!;
      expect(hurt.attack.num(`dmg_${type}`)).toBe(amount);
      expect(hurt.from).toBe("attacker");
      const victim = spawn("human", human());
      strike(hurt.attack, victim, () => 0.99); // cannot miss
      expect(victim.integrity).toBe(100 - amount);
    }
    expect(statusDamage(dict, given("stun"))).toBeNull();
  });

  it("damage over time goes through armor, but not through resistance", () => {
    const armored = human();
    armored.set("armor", 50);
    const e = spawn("human", armored);
    strike(statusDamage(dict, given("poison"))!.attack, e, () => 0.5);
    expect(e.integrity).toBe(95);
    const proof = human();
    proof.set("res_poison", 1);
    const p = spawn("human", proof);
    strike(statusDamage(dict, given("poison"))!.attack, p, () => 0.5);
    expect(p.integrity).toBe(100);
  });

  it("freeze: cannot move or act, and blunt blows shatter it for double", () => {
    expect(hampered(given("freeze"))).toMatchObject({ moves: false, acts: false });
    const u = sufferer(given("freeze"));
    const club = resolve(dict, "human");
    club.set("dmg_blunt", 10);
    strike(club, u.body, () => 0.5);
    expect(u.body.integrity).toBe(80);
  });

  it("sleep: helpless until a blow lands", () => {
    const list = given("sleep", 60);
    expect(hampered(list)).toMatchObject({ moves: false, acts: false, spells: false });
    expect(wake(list)).toEqual(["sleep"]);
    expect(hampered(list)).toEqual(free);
    const stunned = given("stun");
    expect(wake(stunned)).toEqual([]);
  });

  it("charm: spares whoever charmed it", () => {
    expect(hampered(given("charm"))).toMatchObject({ acts: true, spares: ["attacker"] });
  });

  it("silence: cannot spell, can still fight and walk", () => {
    expect(hampered(given("silence"))).toMatchObject({ spells: false, acts: true, moves: true, muteBy: "silence" });
  });

  it("confuse: walks and strikes at random", () => {
    expect(hampered(given("confuse"))).toMatchObject({ random: true, acts: true });
  });

  it("shrink: a fraction of the mass, height and strength", () => {
    const u = sufferer(given("shrink"));
    expect(u.body.stats.num("mass")).toBeCloseTo(7.5);
    expect(u.body.stats.num("height")).toBeCloseTo(0.4375);
    expect(u.attack.num("dmg_blunt")).toBeCloseTo(5 * 0.3); // a bare hand with a third of the strength
  });

  it("covers every status", () => {
    for (const s of STATUSES) expect(given(s).length).toBe(1);
  });
});

describe("every word that inflicts something", () => {
  /** The stats a word strikes with: a weapon or creature itself, a sword it is put on, or a body it is cast on. */
  function striker(word: string) {
    const def = dict.word(word)!;
    const body = resolve(dict, "human");
    if (def.role === "adjective") return [resolve(dict, "sword", [word])];
    if (def.role === "verb" || def.role === "adverb") return [new Unit(dict, { body: { noun: "human" }, effects: [{ set: def.set, ops: def.ops }] }).attack];
    body.apply(def.ops); // a fang or a tongue grafted on
    return [resolve(dict, word), body];
  }
  const positive = [...dict.words].filter(([, d]) =>
    Object.entries(d.set).some(([k, v]) => k.startsWith("inflict_") && typeof v === "number" && v > 0) ||
    d.ops.some(([k, op, n]) => k.startsWith("inflict_") && op === "add" && n > 0)).map(([w]) => w);

  it("gives a struck human at least one status, and the human survives it in the rules", () => {
    expect(positive.length).toBeGreaterThan(250);
    for (const word of positive) {
      const list: Affliction[] = [];
      const done = afflict(list, inflicts(...striker(word)), human(), "a");
      expect(done.length, word).toBeGreaterThan(0);
      const u = sufferer(list);
      const hurt = statusDamage(dict, list);
      if (hurt) strike(hurt.attack, u.body, () => 0.5);
      hampered(list);
      tickStatuses(list, 1000);
      expect(list, word).toEqual([]);
    }
  });

  it("takes inflicting away for the words that soften it (MERCY, UNDERSTOOD)", () => {
    const sword = resolve(dict, "sword", ["understood"]);
    expect(inflicts(sword)).toEqual([]);
    const bleeding = resolve(dict, "human");
    bleeding.set("inflict_bleed", 5);
    bleeding.apply(dict.word("mercy")!.ops);
    expect(inflicts(bleeding)).toEqual([]);
  });
});
