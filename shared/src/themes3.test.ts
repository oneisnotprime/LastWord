import { describe, expect, it } from "vitest";
import {
  afflict, airAt, aimOf, cardOf, catchChance, CHILL, disguised, earshot, EARSHOT, exposure, graftCosts, GRAFT_FOOD, handsOf, hampered, HEARD_FROM,
  IMMUNE_SECONDS, parsePhrase, recovered, resolve, resolveSpelled, severing, statusDamage, STATUS_RULES, Tile, Unit, wonOver, CONVERT_SECONDS, spoiling,
  NIGHT_AIR, type Affliction,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const make = (noun: string, adjectives: string[] = []) => resolve(dict, noun, adjectives);
const card = (text: string) => cardOf(dict, parsePhrase(dict, text)).does.join(" | ");
const person = (items: string[] = [], effects: { ops?: [string, "add" | "mul", number][] }[] = []) =>
  new Unit(dict, { body: { noun: "person" }, items: items.map((noun) => ({ noun })), effects });

describe("body parts (theme 9): grafts", () => {
  it("WINGS make a person fly; CLAWS are their blows; GILLS breathe water", () => {
    const winged = person(["wing"]);
    expect(winged.body.stats.num("speed_air")).toBeGreaterThan(0);
    const clawed = person(["claw"]);
    expect(clawed.attack.num("dmg_slash")).toBeGreaterThan(20);
    expect(person(["gill"]).body.stats.get("breathes")).toBe("both");
    expect(person(["eye"]).body.stats.flag("night_vision")).toBe(true);
  });

  it("an ARM is one more hand: three hands hold a two-handed thing and a one-handed one", () => {
    expect(handsOf([{ stats: make("arm"), count: 1 }])).toBe(1);
    expect(() => person(["axe", "sword", "sword"])).toThrow(/free hand/);
    expect(() => person(["arm", "arm", "sword", "sword", "sword"])).not.toThrow();
  });

  it("grafts cost food by weight, land speed by weight, and a seam to sickness", () => {
    const ops = graftCosts(70, [30]);
    expect(ops).toContainEqual(["food_need", "add", 30 * GRAFT_FOOD]);
    expect(ops.find(([id]) => id === "speed_land")![2]).toBeCloseTo(0.7);
    expect(person(["shell"]).body.stats.num("speed_land")).toBeLessThan(person().body.stats.num("speed_land"));
    expect(person(["wing"]).body.stats.num("res_disease")).toBeLessThan(person().body.stats.num("res_disease"));
    expect(graftCosts(70, [])).toEqual([]);
  });

  it("AMPUTATE cuts one graft, a GUILLOTINE all; grafts are aimed at someone", () => {
    expect(severing(1, 3)).toBe(1);
    expect(severing(Infinity, 3)).toBe(3);
    expect(severing(2, 0)).toBe(0);
    expect(make("guillotine").num("severs")).toBe(Infinity);
    expect(aimOf(parsePhrase(dict, "wing"))).toBe("someone");
    expect(aimOf(parsePhrase(dict, "amputate"))).toBe("someone");
    expect(aimOf(parsePhrase(dict, "sword"))).toBeNull();
    expect(card("wing")).toMatch(/grafted: spelled with someone picked/);
  });
});

describe("clothing (theme 10): lending, warmth, disguise", () => {
  it("a worn COAT lends its armour and res_cold; armour itself stays a layer", () => {
    const coated = person(["coat"]).body.stats;
    expect(coated.num("res_cold")).toBeCloseTo(0.6);
    expect(coated.num("armor")).toBeGreaterThanOrEqual(3);
    expect(person(["armor"]).body.stats.num("armor")).toBe(person().body.stats.num("armor"));
  });

  it("the air: tundra by night is cold; a BLIZZARD freezes the unclothed; a PARKA bears it", () => {
    const tundraNight = airAt(Tile.Tundra, true, 0, false);
    expect(tundraNight).toBe(20 - 15 + NIGHT_AIR);
    const blizzard = airAt(Tile.Tundra, true, -45, false);
    const bare = exposure(person().body.stats, blizzard)!;
    expect(bare.type).toBe("cold");
    expect(bare.amount).toBeCloseTo((-10 - blizzard) * CHILL);
    expect(exposure(person(["parka"]).body.stats, blizzard)).toBeNull();
    expect(exposure(person().body.stats, airAt(Tile.Grass, false, 0, false))).toBeNull();
    expect(airAt(Tile.Tundra, true, -45, true)).toBeGreaterThan(blizzard); // a fire near by
    expect(exposure(make("sword"), -80)).toBeNull(); // only the living feel it
  });

  it("a COSTUME fools a wolf, not a HOUND's nose nor a DETECTIVE; it shows on the card", () => {
    const dressed = person(["costume"]).body.stats;
    expect(dressed.num("disguise")).toBeGreaterThan(0);
    expect(disguised(dressed, make("wolf"), 5)).toBe(true);
    expect(disguised(dressed, make("bloodhound"), 5)).toBe(false);
    expect(disguised(dressed, make("detective"), 5)).toBe(false);
    expect(disguised(person().body.stats, make("wolf"), 5)).toBe(false);
    expect(card("costume")).toMatch(/disguise 7/);
  });
});

describe("disease (theme 12): sickness, contagion, immunity", () => {
  it("sick bodies waste: disease damage a second, weaker and slower", () => {
    expect(STATUS_RULES.sick.dot).toEqual({ disease: 3 });
    const list: Affliction[] = [];
    afflict(list, [["sick", 10]], person().body.stats, "x");
    expect(statusDamage(dict, list)!.attack.num("dmg_disease")).toBe(3);
    expect(afflict([], [["sick", 10]], make("sword"), "x")).toEqual([]); // the unliving cannot be sick
  });

  it("catching it: contagion a minute, cut by res_disease; a VACCINE means never", () => {
    const body = person().body.stats;
    expect(catchChance(0.6, body, 60)).toBeCloseTo(0.6);
    expect(catchChance(0.6, body, 1)).toBeLessThan(0.02);
    const guarded = person([], [{ ops: [["res_disease", "add", 0.5]] }]).body.stats;
    expect(catchChance(0.6, guarded, 60)).toBeCloseTo(0.3);
    const vaccinated = person([], [{ ops: dict.word("vaccine")!.ops }]).body.stats;
    expect(catchChance(0.9, vaccinated, 60)).toBe(0);
    expect(recovered(100, 100 + IMMUNE_SECONDS - 1)).toBe(true);
    expect(recovered(100, 100 + IMMUNE_SECONDS + 1)).toBe(false);
  });

  it("PLAGUE makes people sick; CURE and HOSPITAL end it; QUARANTINE stops it passing", () => {
    expect(make("plague").num("inflict_sick")).toBeGreaterThan(0);
    expect(make("cure").tags("effect_status")).toContain("sick");
    expect(make("hospital").tags("effect_status")).toContain("sick");
    expect(make("quarantine").tags("law")).toContain("contact");
    expect(card("plague")).toMatch(/the sick pass it/);
  });
});

describe("emotions (theme 13): rage, love, temper", () => {
  it("rage sends a body at whoever is nearest, harder and faster", () => {
    const h = hampered([{ status: "rage", left: 5, from: "a", origin: "a" }]);
    expect(h.berserk).toBe(true);
    expect(h.tempo).toBeGreaterThan(1);
    expect(make("rage").num("inflict_rage")).toBeGreaterThan(0);
    expect(make("serenity").tags("effect_status")).toContain("rage");
  });

  it("a creature charmed long enough comes over; a loyal dog resists", () => {
    expect(wonOver(CONVERT_SECONDS)).toBe(true);
    expect(wonOver(CONVERT_SECONDS - 1)).toBe(false);
    const wolf: Affliction[] = [], dog: Affliction[] = [];
    afflict(wolf, [["charm", 4]], make("wolf"), "x");
    afflict(dog, [["charm", 4]], make("bloodhound"), "x");
    expect(dog[0]!.left).toBeLessThan(wolf[0]!.left);
    expect(card("love")).toMatch(/comes over to the charmer/);
  });

  it("an angry creature goes for enemies unbidden", () => {
    expect(spoiling(make("wolf", ["furious"]))).toBe(true);
    expect(spoiling(make("wolf"))).toBe(false);
    expect(spoiling(make("sheep"))).toBe(false);
  });
});

describe("music and sound (theme 14): noise, deafness, songs", () => {
  it("a DRUM held gives its carrier away within earshot; SILENCE hushes it", () => {
    const drummer = person(["drum"]).body.stats;
    expect(drummer.num("loudness")).toBeGreaterThanOrEqual(HEARD_FROM);
    expect(earshot(8, 0)).toBe(0); // the deaf hear nothing
    expect(earshot(8, 40)).toBe(8 * EARSHOT + 10);
    expect(earshot(1, 40)).toBe(0);
    const hushed = person(["drum"], [{ ops: dict.word("silence")!.ops }]).body.stats;
    expect(hushed.num("loudness")).toBe(0);
  });

  it("the deaf are spared songs: no charm or sleep reaches them", () => {
    const list: Affliction[] = [{ status: "deaf", left: 20, from: "x", origin: "x" }];
    expect(afflict(list, [["charm", 5], ["sleep", 5], ["stun", 1]], person().body.stats, "y")).toEqual(["stun"]);
    expect(hampered(list).deaf).toBe(true);
    const plugged = person(["earplug"]).body.stats;
    expect(plugged.flag("immune_charm")).toBe(true);
    expect(card("gong")).toMatch(/deafens/);
  });

  it("a FLUTE charms the living around its carrier", () => {
    const flute = resolveSpelled(dict, { noun: "flute" });
    expect(flute.num("inflict_charm")).toBeGreaterThan(0);
    expect(flute.num("field_radius")).toBeGreaterThan(0);
  });
});
