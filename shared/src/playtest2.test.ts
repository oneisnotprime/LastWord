import { describe, expect, it } from "vitest";
import {
  afflict, BIOMES, cellEvery, curesFor, forageLetter, ghostMayCarry, ghostSpares, grand, grandeur, hoardShare, HOARD_FROM, parsePhrase,
  RESIST_MIN, resistanceAfter, seeded, spellingCost, statusSeconds, strikeUnit, surcharge, takesControl, Tile, tickStatuses, Unit, upkeepText,
  worstStatus, cardOf, type Affliction, type Resistance,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const hit = () => 0.5; // lands, no block, no critical
const human = (items: { noun: string }[] = []) => new Unit(dict, { body: { noun: "human" }, items });
const p = (text: string) => parsePhrase(dict, text);

describe("playtest 2: a worn HELMET's stun immunity", () => {
  it("protection lends its immunities to its wearer (it lent nothing before)", () => {
    expect(human([{ noun: "helmet" }]).body.stats.flag("immune_stun")).toBe(true);
    const list: Affliction[] = [];
    expect(afflict(list, [["stun", 1]], human([{ noun: "helmet" }]).body.stats, "elbow")).toEqual([]);
  });
});

describe("playtest 2: diminishing returns on statuses that take control", () => {
  it("knows which statuses take control (not boons, not burns)", () => {
    for (const s of ["stun", "freeze", "sleep", "root", "fear", "confuse", "hypnosis", "leash", "stasis"] as const) expect(takesControl(s)).toBe(true);
    for (const s of ["truce", "burn", "poison", "blind", "slow", "debt", "curse"] as const) expect(takesControl(s)).toBe(false);
  });

  it("an ELBOW striking every second cannot keep someone stunned (140 s of stun in the playtest)", () => {
    const body = human().body.stats, list: Affliction[] = [], resist: Resistance = new Map();
    let stunned = 0;
    for (let t = 0; t < 140; t += 0.1) {
      if (Math.abs(t - Math.round(t)) < 0.05) afflict(list, [["stun", 1]], body, "bot", "bot", resist); // a blow a second
      if (list.some((a) => a.status === "stun")) stunned += 0.1;
      tickStatuses(list, 0.1, 1, 1, resist);
    }
    // Stunned at most as long as it is then free: about half the time, never all of it.
    expect(stunned).toBeLessThan(140 * 0.5);
    expect(stunned).toBeGreaterThan(140 * 0.25); // the blows still stun
  });

  it("an ending leaves a resistance of at least RESIST_MIN, half of a long one", () => {
    expect(resistanceAfter(2)).toBe(RESIST_MIN);
    expect(resistanceAfter(40)).toBe(20);
    const body = human().body.stats, list: Affliction[] = [], resist: Resistance = new Map();
    afflict(list, [["fear", 4]], body, "ghost", "ghost", resist);
    const fear = list[0]!.left;
    tickStatuses(list, fear + 0.1, 1, 1, resist);
    expect(resist.get("fear")).toBeGreaterThan(fear * 0.4);
    expect(afflict(list, [["fear", 4]], body, "ghost", "ghost", resist)).toEqual([]);
    tickStatuses(list, fear, 1, 1, resist);
    expect(afflict(list, [["fear", 4]], body, "ghost", "ghost", resist)).toEqual(["fear"]);
  });

  it("fear on someone with no courage runs twice its time, not days (FEAR 533315s)", () => {
    const body = human().body.stats;
    body.set("courage", -3);
    const list: Affliction[] = [];
    afflict(list, [["fear", 30]], body, "x");
    expect(list[0]!.left).toBeCloseTo(statusSeconds("fear", 30) * 2);
  });
});

describe("playtest 2: ghosts haunt; they never hold the living down", () => {
  it("a ghost's words carry no helpless status, no damage and no wearing harm, but may frighten and blind", () => {
    for (const s of ["stun", "root", "sleep", "confuse", "hypnosis", "leash", "freeze", "stasis", "poison", "debt"] as const) expect(ghostSpares(s)).toBe(true);
    for (const s of ["fear", "blind", "deaf", "curse", "illiterate", "gag"] as const) expect(ghostSpares(s)).toBe(false);
    expect(ghostMayCarry("inflict_sleep")).toBe(false);
    expect(ghostMayCarry("dmg_fire")).toBe(false);
    expect(ghostMayCarry("inflict_fear")).toBe(true);
    expect(ghostMayCarry("ban_letters")).toBe(true);
  });
});

describe("playtest 2: damage past a broken layer carries through", () => {
  it("a NUKE breaks worn ARMOR and kills the wearer (worn ARMOR soaked all of it before)", () => {
    const target = human([{ noun: "armor" }]);
    const r = strikeUnit(human([{ noun: "nuke" }]), target, hit);
    expect(target.layers[0]!.integrity).toBeLessThanOrEqual(0);
    expect(target.dead).toBe(true);
    expect(r.on).toBe("human");
  });

  it("a blow that only dents the armour still stops there", () => {
    const target = human([{ noun: "armor" }]);
    strikeUnit(human([{ noun: "sword" }]), target, hit);
    expect(target.body.integrity).toBe(100);
  });
});

describe("playtest 2: wide areas strike as their word says, not once per person", () => {
  it("a STORM striking once in twenty seconds drops a cell every twenty seconds; no rate strikes once", () => {
    expect(cellEvery(0.05)).toBe(20);
    expect(cellEvery(0)).toBe(Infinity);
  });

  it("STORM is local now, and its lightning does not kill a person outright", () => {
    const s = p("storm").stats;
    expect(s.num("field_radius")).toBeLessThanOrEqual(400);
    expect(s.num("dmg_electric")).toBeLessThan(400);
    expect(p("thunderstorm").stats.num("dmg_electric")).toBeLessThan(400);
  });
});

describe("playtest 2: grand words cost what their scale deserves", () => {
  it("an OAK is not grand (it neither fights nor moves); a TITAN and a TANK are", () => {
    expect(grand(p("oak"))).toBe(false);
    expect(grand(p("titan"))).toBe(true);
    expect(grand(p("tank"))).toBe(true);
  });

  it("each order of magnitude adds an earned letter, by what the word is", () => {
    expect(surcharge(p("wolf"))).toBe("");
    expect(surcharge(p("tank"))).toBe("m");
    expect(surcharge(p("titan"))).toBe("kz");
    expect(surcharge(p("nuke")).length).toBe(4);
    expect(spellingCost(p("titan"))).toBe("titankz");
    expect(surcharge(p("storm"))).toMatch(/^w/);
    expect(grandeur(p("fire"))).toBeLessThan(1000); // half a tile of flames is not a storm
  });

  it("upkeep leads a card: what it eats and burns", () => {
    expect(upkeepText(p("dragon").stats)).toBe("eats 5 food/min");
    expect(cardOf(dict, p("dragon")).upkeep).toBe("eats 5 food/min");
    expect(cardOf(dict, p("titan")).surcharge).toBe("kz");
  });
});

describe("playtest 2: racks that stall or flood", () => {
  it("income of a letter tapers as it is hoarded", () => {
    expect(hoardShare(0)).toBe(1);
    expect(hoardShare(HOARD_FROM - 1)).toBe(1);
    expect(hoardShare(26)).toBeCloseTo(10 / 27);
  });

  it("a rack without a vowel forages one", () => {
    const rng = seeded(7);
    const meadow = BIOMES[Tile.Grass]!;
    for (let i = 0; i < 50; i++) expect("aeiou").toContain(forageLetter(meadow, rng, { j: 1, l: 26, n: 7 }));
  });

  it("a hoarded letter turns up less often in forage", () => {
    const rng = seeded(3), meadow = BIOMES[Tile.Grass]!;
    let plain = 0, hoarding = 0;
    for (let i = 0; i < 4000; i++) { if (forageLetter(meadow, rng, { a: 1 }) === "e") plain++; if (forageLetter(meadow, rng, { a: 1, e: 30 }) === "e") hoarding++; }
    expect(hoarding).toBeLessThan(plain * 0.6);
  });
});

describe("playtest 2: what is stopping me", () => {
  it("names the worst status first, and a word that ends it", () => {
    const worst = worstStatus([{ status: "blind", left: 50 }, { status: "confuse", left: 31 }, { status: "debt", left: 90 }]);
    expect(worst?.status).toBe("confuse");
    expect(worstStatus([{ status: "bless", left: 10 }])).toBeNull();
    expect(curesFor(dict, "confuse").length).toBeGreaterThan(0);
  });
});
