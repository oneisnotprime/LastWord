import { describe, expect, it } from "vitest";
import {
  afflict, aimOf, canPay, cardOf, contestOf, debtDue, DEBT_SECONDS, decoyAt, earnFactor, faithProblem, fooledByDecoys, hiddenFrom, interestDue,
  isBoon, isExposed, isTrap, needs, offering, outputs, owesTo, parsePhrase, patchNear, PATCH_FROM, readout, resolve, springReach, stampTerrain,
  STATUS_RULES, Tile, tileAt, Unit, weatherTile, seeded, type Affliction, type WorldMap,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const make = (noun: string, adjectives: string[] = []) => resolve(dict, noun, adjectives);
const card = (text: string) => cardOf(dict, parsePhrase(dict, text)).does.join(" | ");
const person = () => new Unit(dict, { body: { noun: "person" } });

describe("money and trade (theme 16)", () => {
  it("debt pays a letter every DEBT_SECONDS, keeping the part of a letter for next time", () => {
    const a: Affliction = { status: "debt", left: 100, from: "creditor", origin: "creditor" };
    expect(debtDue(a, DEBT_SECONDS / 2)).toBe(0);
    expect(debtDue(a, DEBT_SECONDS / 2)).toBe(1);
    expect(debtDue(a, DEBT_SECONDS * 3)).toBe(3);
    expect(owesTo([a], ["creditor"])).toBe(true);
    expect(owesTo([a], ["someone else"])).toBe(false);
  });

  it("DEBT, a LOAN and a GIFT are passed on someone clicked; a LOAN pays and puts a long debt on", () => {
    expect(aimOf(parsePhrase(dict, "debt"))).toBe("someone");
    expect(aimOf(parsePhrase(dict, "gift"))).toBe("someone");
    const loan = make("loan");
    expect(loan.num("pays")).toBeGreaterThan(0);
    expect(loan.num("inflict_debt")).toBeGreaterThan(make("debt").num("inflict_debt"));
    expect(card("loan")).toMatch(/pays .* letters/);
    expect(card("debt")).toMatch(/debt/);
  });

  it("a BRIBE's price is the speller's side of the contest against loyalty", () => {
    const bribe = make("bribe");
    expect(bribe.get("contest_with")).toBe("pays");
    expect(contestOf(person().body.stats, bribe, "pays")).toBe(bribe.num("pays"));
    expect(contestOf(person().body.stats, make("theft"), "stealth")).toBe(person().body.stats.num("stealth"));
    expect(card("bribe")).toMatch(/buys a creature whose loyalty is 8 or less/);
  });

  it("a spelling that pays needs the letters on top of its own", () => {
    expect(canPay({ a: 3, b: 2 }, 4, 0)).toBe("");
    expect(canPay({ a: 10 }, 5, 5)).toBe("");
    expect(canPay({ a: 10 }, 6, 5)).toMatch(/pays 5 letters/);
  });

  it("a BANK earns interest on what it keeps safe; BANKRUPTCY ends debts", () => {
    expect(make("bank").num("interest")).toBeGreaterThan(0);
    expect(interestDue(100, 0.02, 60)).toBeCloseTo(2);
    expect(interestDue(0, 0.02, 60)).toBe(0);
    expect(make("bankruptcy").tags("effect_status")).toContain("debt");
  });
});

describe("crime and deception (theme 17)", () => {
  it("a LANDMINE is a hidden trap: it springs within its trigger radius; a DETECTIVE sees it", () => {
    const mine = make("landmine");
    expect(isTrap(mine)).toBe(true);
    expect(isTrap(make("sword"))).toBe(false);
    expect(springReach(mine)).toBeCloseTo(0.75);
    expect(hiddenFrom(mine, person().body.stats)).toBe(true);
    expect(hiddenFrom(mine, make("detective"))).toBe(false);
    expect(card("landmine")).toMatch(/a trap: springs/);
  });

  it("lies put decoys on enemies' arrows; detect stealth 5 sees through them", () => {
    expect(make("hoax").num("decoys")).toBeGreaterThan(0);
    expect(fooledByDecoys(person().body.stats)).toBe(true);
    expect(fooledByDecoys(make("detective"))).toBe(false);
    const p = decoyAt("z1", 0, { x: 100, y: 100 }, 0), q = decoyAt("z1", 0, { x: 100, y: 100 }, 5);
    const d = Math.hypot(p.x - 100, p.y - 100);
    expect(d).toBeGreaterThanOrEqual(12);
    expect(d).toBeLessThanOrEqual(30);
    expect(q).not.toEqual(p); // they move
    expect(decoyAt("z1", 0, { x: 100, y: 100 }, 5)).toEqual(q); // and the same for everyone who asks
  });

  it("DISARM and INVESTIGATION name the traps they break", () => {
    expect(parsePhrase(dict, "disarm").stats.tags("counters")).toContain("landmine");
    expect(make("investigation").tags("counters")).toContain("trap");
  });
});

describe("communication and information (theme 18)", () => {
  it("the exposed have no stealth or disguise and show to every enemy", () => {
    const list: Affliction[] = [];
    const spy = make("spy");
    afflict(list, [["expose", 30]], person().body.stats, "x");
    expect(isExposed(list)).toBe(true);
    expect(STATUS_RULES.expose.ops).toContainEqual(["stealth", "mul", 0]);
    // A CIPHER keeps it off.
    const coded = make("person");
    coded.set("immune_expose", true);
    expect(afflict([], [["expose", 30]], coded, "x")).toEqual([]);
    expect(spy.flag("read_inventory")).toBe(true);
  });

  it("ESPIONAGE reads what someone holds, in one line", () => {
    expect(aimOf(parsePhrase(dict, "espionage"))).toBe("someone");
    expect(readout({ e: 3, a: 1, z: 0 }, ["sword"])).toBe("letters A E×3 · gear SWORD");
    expect(readout({}, [])).toBe("letters none");
  });

  it("a JAMMER's field jams; TRUTH ends lies", () => {
    expect(make("jammer").flag("jams")).toBe(true);
    expect(card("jammer")).toMatch(/jams/);
    expect(make("truth").tags("counters")).toEqual(expect.arrayContaining(["lie", "hoax", "propaganda"]));
  });
});

describe("religion and myth (theme 19)", () => {
  it("faith is a store: a TEMPLE gathers it, an ANGEL draws it", () => {
    expect(outputs(make("temple")).faith).toBeGreaterThan(outputs(make("shrine")).faith);
    expect(needs(make("angel")).faith).toBeGreaterThan(0);
  });

  it("a miracle cannot be spelled without its faith", () => {
    const miracle = make("miracle");
    expect(faithProblem(miracle, 0)).toMatch(/takes 40 faith/);
    expect(faithProblem(miracle, 40)).toBe("");
    expect(faithProblem(make("sword"), 0)).toBe("");
  });

  it("an offering is worth more for the living, the thinking and the precious", () => {
    expect(offering(make("cow"))).toBeGreaterThan(offering(make("rock")));
    expect(offering(make("person"))).toBeGreaterThan(offering(make("cow")));
    expect(offering(make("gold"))).toBeGreaterThan(offering(make("rock")));
    expect(make("altar").num("sacrifice")).toBeGreaterThan(0);
  });

  it("the blessed earn half again as many letters, the cursed half; a blessing is a boon", () => {
    const at = (s: Affliction["status"]): Affliction => ({ status: s, left: 10, from: "", origin: "" });
    expect(earnFactor([])).toBe(1);
    expect(earnFactor([at("bless")])).toBe(1.5);
    expect(earnFactor([at("curse")])).toBe(0.5);
    expect(earnFactor([at("bless"), at("curse")])).toBe(0.75);
    expect(isBoon("bless")).toBe(true);
    expect(isBoon("curse")).toBe(false);
    // ATHEISM keeps both off.
    const unbeliever = make("person");
    unbeliever.set("immune_curse", true);
    expect(afflict([], [["curse", 30]], unbeliever, "x")).toEqual([]);
  });
});

describe("weather, climate and seasons (theme 20)", () => {
  const flat = (tile: Tile, size = 64): WorldMap => ({ seed: 1, size, tiles: new Uint8Array(size * size).fill(tile), cities: [] } as unknown as WorldMap);

  it("weather words with a tile_type lay it; the rest do not", () => {
    expect(weatherTile(make("blizzard"))).toBe(Tile.Snow);
    expect(weatherTile(make("drought"))).toBe(Tile.Sand);
    expect(weatherTile(make("monsoon"))).toBe(Tile.Water);
    expect(weatherTile(make("thaw"))).toBe(Tile.Meadow);
    expect(weatherTile(make("fog"))).toBe(null);
  });

  it("snow covers grass and freezes shallow water, never deep water or roads", () => {
    const map = flat(Tile.Grass);
    map.tiles[32 * 64 + 32] = Tile.Road;
    map.tiles[32 * 64 + 33] = Tile.DeepWater;
    stampTerrain(map, { x: 32.5, y: 32.5, radius: 3, tile: Tile.Snow, only: PATCH_FROM[Tile.Snow] });
    expect(tileAt(map, 31, 32)).toBe(Tile.Snow);
    expect(tileAt(map, 32, 32)).toBe(Tile.Road);
    expect(tileAt(map, 33, 32)).toBe(Tile.DeepWater);
    const lake = flat(Tile.Water);
    stampTerrain(lake, { x: 10, y: 10, radius: 2, tile: Tile.Snow, only: PATCH_FROM[Tile.Snow] });
    expect(tileAt(lake, 10, 10)).toBe(Tile.Snow);
  });

  it("a flood spills only beside water; a drought dries water to sand", () => {
    expect(patchNear(flat(Tile.Grass), Tile.Water, { x: 32, y: 32 }, seeded(1))).toBe(null);
    const shore = flat(Tile.Grass);
    for (let y = 0; y < 64; y++) for (let x = 28; x < 36; x++) shore.tiles[y * 64 + x] = Tile.Water;
    let flood = null;
    for (let i = 0; i < 20 && !flood; i++) flood = patchNear(shore, Tile.Water, { x: 32, y: 32 }, seeded(i));
    expect(flood).not.toBe(null);
    const dry = patchNear(flat(Tile.Water), Tile.Sand, { x: 32, y: 32 }, seeded(2))!;
    expect(dry.tile).toBe(Tile.Sand);
    expect(dry.only! & (1 << Tile.Water)).toBeTruthy();
    expect(card("blizzard")).toMatch(/covers grass in snow/);
  });
});
