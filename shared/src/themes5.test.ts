import { describe, expect, it } from "vitest";
import {
  afflict, agedBorn, ahead, areaTime, backInRing, cardOf, catchOf, chaosOps, CHAOS_COUNT, doomDamage, DOOM_SHARE, findPath, fishTable, floats,
  generateMap, gravityOf, gravityRange, gravitySpeed, grounded, hampered, impacts, knockbackOf, LUCK_POINT, luckOps, parsePhrase, peaceOf,
  placeRules, pot, resolve, rewound, SAIL_COST, sails, seeded, statusEffects, tickStatuses, Tile, tileAt, timeAt, timeOf, typoOf, Unit, waveDamage,
  type Affliction, type Challenge,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const make = (noun: string, adjectives: string[] = []) => resolve(dict, noun, adjectives);
const card = (text: string) => cardOf(dict, parsePhrase(dict, text)).does.join(" | ");
const body = () => new Unit(dict, { body: { noun: "person" } }).body.stats;
const status = (s: Affliction["status"], left = 10): Affliction => ({ status: s, left, from: "x", origin: "x" });

describe("time (theme 21)", () => {
  it("time_scale and haste or stasis set how fast time runs for a body; haste and slow end each other", () => {
    expect(timeOf(body())).toBe(1);
    expect(timeOf(body(), [status("haste")])).toBe(2);
    expect(timeOf(body(), [status("stasis")])).toBe(0);
    const fast = new Unit(dict, { body: { noun: "person" }, effects: [{ ops: [["time_scale", "mul", 2]] }] }).body.stats;
    expect(timeOf(fast, [status("haste")])).toBe(4);
    const list: Affliction[] = [status("slow")];
    afflict(list, [["haste", 5]], body(), "x");
    expect(list.map((a) => a.status)).toEqual(["haste"]);
    afflict(list, [["slow", 5]], body(), "x");
    expect(list.map((a) => a.status)).toEqual(["slow"]);
  });

  it("other statuses wear off at the body's time; time statuses run by the clock; stasis leaves it untouchable and helpless", () => {
    const list = [status("haste", 10), status("poison", 10)];
    tickStatuses(list, 1, 1, 2);
    expect(list.find((a) => a.status === "poison")!.left).toBe(8);
    expect(list.find((a) => a.status === "haste")!.left).toBe(9);
    const frozen = [status("stasis", 5), status("poison", 5)];
    tickStatuses(frozen, 1, 1, 0);
    expect(frozen.find((a) => a.status === "poison")!.left).toBe(5);
    const h = hampered([status("stasis")]);
    expect(h).toMatchObject({ moves: false, acts: false, spells: false, untouchable: true, time: 0 });
    expect(statusEffects([status("stasis")])[0]!.set).toEqual({ untargetable: true });
  });

  it("an area's time runs letters, growth and ageing (ACCELERATION ×2, DELAY ×0.5 in its rules)", () => {
    expect(areaTime(1, [["time_scale", "mul", 2]])).toBe(2);
    const acc = placeRules(dict.word("acceleration")!, make("acceleration"))!;
    expect(acc.time).toBe(2);
    expect(timeAt([acc, placeRules(dict.word("deceleration")!, make("deceleration"))!])).toBeCloseTo(0.8);
  });

  it("REWIND restores the best health of the last seconds; CENTURY ages a thing (born earlier)", () => {
    expect(rewound([100, 80, 50, 20], 20, 2, 100)).toBe(50);
    expect(rewound([100, 80, 50, 20], 20, 60, 100)).toBe(100);
    expect(rewound([10], 40, 5, 100)).toBe(40);
    expect(parsePhrase(dict, "rewind").stats.num("rewinds")).toBeGreaterThan(0);
    expect(make("century").num("ages")).toBe(6000);
    expect(agedBorn(500, 600, 10)).toBe(-100);
    expect(agedBorn(500, 600, -100)).toBe(600); // never younger than new
    expect(card("century")).toMatch(/ages its target 6000 min/);
  });

  it("ETERNITY is immune to stasis, slowing and doom and ends them", () => {
    const e = make("eternity");
    expect(e.flag("immune_stasis") && e.flag("immune_doom")).toBe(true);
    expect(e.tags("counters")).toContain("stasis");
  });
});

describe("space (theme 22)", () => {
  it("gravity: low bounds faster, carries shots farther and floats under 0.3; high plods and grounds flyers from 3", () => {
    expect(gravitySpeed(1)).toBe(1);
    expect(gravitySpeed(0.2)).toBeGreaterThan(1.4);
    expect(gravitySpeed(4)).toBe(0.5);
    expect(gravityRange(0.25)).toBe(2);
    expect(floats(0.2) && !floats(0.5)).toBe(true);
    expect(grounded(3) && !grounded(2)).toBe(true);
    const light = new Unit(dict, { body: { noun: "person" }, effects: [{ ops: [["gravity", "mul", 0.2]] }] }).body.stats;
    expect(gravityOf(light)).toBeCloseTo(0.2);
  });

  it("knockback is farther in low gravity, nothing for the anchored; impacts come at their rate a minute", () => {
    expect(knockbackOf(0, 1, false)).toBe(0);
    expect(knockbackOf(2, 1, false)).toBe(2);
    expect(knockbackOf(2, 0.5, false)).toBe(8);
    expect(knockbackOf(20, 0.1, true)).toBe(0);
    const rng = seeded(3);
    let n = 0;
    for (let i = 0; i < 600; i++) n += impacts(6, 1, rng);
    expect(n).toBeGreaterThan(40);
    expect(n).toBeLessThan(80);
    expect(make("shower").num("meteors")).toBeGreaterThan(0);
    expect(make("singularity").num("pull")).toBeGreaterThan(0);
    expect(make("anchor").flag("anchored")).toBe(true);
  });
});

describe("sea (theme 23)", () => {
  it("vessels sail: mountable, speed on water and none on land; routes keep to the water", () => {
    for (const w of ["boat", "galleon", "canoe", "raft"]) expect(sails(make(w))).toBe(true);
    expect(sails(make("horse"))).toBe(false);
    expect(SAIL_COST[Tile.Water]).toBe(1);
    expect(SAIL_COST[Tile.Grass]).toBe(Infinity);
    const map = generateMap(5, 128);
    const water: { x: number; y: number }[] = [];
    for (let y = 0; y < map.size && water.length < 400; y++) for (let x = 0; x < map.size; x++) if (tileAt(map, x, y) === Tile.DeepWater || tileAt(map, x, y) === Tile.Water) water.push({ x: x + 0.5, y: y + 0.5 });
    const route = findPath(map, water[0]!, water[water.length - 1]!, SAIL_COST);
    for (const p of route) expect(SAIL_COST[tileAt(map, p.x, p.y)]).toBe(1);
  });

  it("waves wreck small boats, not big ships; a catch gives its fish's first letter", () => {
    expect(waveDamage(2, 5, false)).toBeCloseTo(6.4);
    expect(waveDamage(6, 50, false)).toBeLessThan(6);
    expect(waveDamage(8, 5, true)).toBe(0);
    const table = fishTable(dict);
    expect(table.length).toBeGreaterThan(20);
    const c = catchOf(table, dict, seeded(9))!;
    expect(dict.word(c.fish)!.set.breathes).toBe("water");
    expect(c.letter).toBe(/[jqxz]/.test(c.fish[0]!) ? "o" : c.fish[0]);
    expect(make("port").flag("docks")).toBe(true);
  });
});

describe("sports (theme 24)", () => {
  it("a challenge stakes letters in a ring; the one who dealt more wins at the end; duellists are put back in the ring", () => {
    expect(make("duel").num("stakes")).toBeGreaterThan(0);
    expect(make("race").num("race_to")).toBeGreaterThan(0);
    const c: Challenge = { word: "duel", a: { id: "a", staked: "eee", dealt: 30 }, b: { id: "b", staked: "tt", dealt: 10 }, ring: { x: 0, y: 0, radius: 3 }, flag: null, until: 0 };
    expect(ahead(c)!.id).toBe("a");
    expect(pot(c)).toBe("eeett");
    expect(backInRing(c.ring!, { x: 1, y: 1 })).toBeNull();
    const back = backInRing(c.ring!, { x: 10, y: 0 })!;
    expect(back.x).toBeLessThan(3);
    expect(card("duel")).toMatch(/each stakes 10 letters/);
  });

  it("peace keepers give a truce, untouchable and harmless, that PROVOCATION ends", () => {
    expect(peaceOf(make("gavel"))).toBeGreaterThan(0);
    expect(peaceOf(make("judge"))).toBeGreaterThan(0);
    expect(make("judge").tags("law")).not.toContain("attack"); // no endless no-fighting law any more
    expect(hampered([status("truce")])).toMatchObject({ acts: false, spells: false, moves: true, untouchable: true });
    expect(make("provocation").tags("effect_status")).toContain("truce");
  });
});

describe("abstract ideas (theme 25)", () => {
  it("luck shifts aim, criticals and dodging by LUCK_POINT a point", () => {
    expect(luckOps(0)).toEqual([]);
    const lucky = new Unit(dict, { body: { noun: "person" }, effects: [{ ops: [["luck", "add", 5]] }] }).body.stats;
    expect(lucky.num("critical") - body().num("critical")).toBeCloseTo(5 * LUCK_POINT);
    expect(make("person", ["lucky"]).num("luck")).toBeGreaterThan(0);
  });

  it("chaos scrambles a handful of properties; void nulls damage and flight; doom takes three quarters", () => {
    const ops = chaosOps(seeded(4));
    expect(ops).toHaveLength(CHAOS_COUNT);
    expect(new Set(ops.map((o) => o[0])).size).toBe(CHAOS_COUNT);
    const chaotic: Affliction = { ...status("chaos"), ops };
    expect(statusEffects([chaotic])[0]!.ops).toEqual(ops);
    const dragon = new Unit(dict, { body: { noun: "dragon" }, effects: statusEffects([status("void")]) }).body.stats;
    expect(dragon.num("dmg_fire")).toBe(0);
    expect(dragon.num("speed_air")).toBe(0);
    expect(hampered([status("void")]).nulled).toBe(true);
    expect(doomDamage(200)).toBe(200 * DOOM_SHARE);
    expect(make("fate").num("inflict_doom")).toBeGreaterThan(0);
  });

  it("a TYPO finds a thing one letter off, or nothing; PARADOX swaps owners", () => {
    const next = typoOf(dict, "cat", seeded(1))!;
    expect(next).toHaveLength(3);
    expect([...next].filter((ch, i) => ch !== "cat"[i])).toHaveLength(1);
    expect(typoOf(dict, "xqzv", seeded(1))).toBeNull();
    expect(make("typo").flag("misspells")).toBe(true);
    expect(make("paradox").flag("swaps_owners")).toBe(true);
  });
});
