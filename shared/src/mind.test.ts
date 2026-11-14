import { describe, expect, it } from "vitest";
import {
  aggressive, carcassFood, authorityOf, chooseTarget, commandLimit, draw, groundFood, ignoresOrder, moraleAim, moraleGoal, needs, nextMorale,
  outputs, recruitRate, startingSupply, STARTING_SUPPLY_MINUTES, rerouteSeconds, resolve, retreats, routed, seeded, strikeUnit, supply, theftResistance, Tile, UNCOMMANDED, Unit, useObject,
  type Stores,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("morale", () => {
  it("a drop is scaled by courage: FEAR's -4 breaks a body whose courage it also cut to 1", () => {
    expect(moraleGoal(5, 1, 1)).toBe(0); // FEAR: morale 5 - 4, courage 5 - 4
    expect(moraleGoal(5, 3, 5)).toBe(3); // a wolf's fear_aura 2 on ordinary courage
    expect(moraleGoal(5, 3, 10)).toBe(4); // a brave one feels half of it
    expect(moraleGoal(5, 1, Infinity)).toBe(5); // absolute courage feels nothing
    expect(moraleGoal(5, 8, 1)).toBe(8); // LOVE's lift counts in full
  });

  it("falls at once, climbs back slowly; routed at 0, shaken below 3", () => {
    expect(nextMorale(5, 0, 1)).toBe(0);
    expect(nextMorale(0, 5, 1)).toBe(0.5);
    expect(nextMorale(4.8, 5, 1)).toBe(5);
    expect(routed(0)).toBe(true);
    expect(routed(0.5)).toBe(false);
    expect(moraleAim(2.9)).toBe(0.5);
    expect(moraleAim(3)).toBe(1);
  });

  it("a shaken striker's aim is halved", () => {
    const a = new Unit(dict, { body: { noun: "human" } }), b = new Unit(dict, { body: { noun: "human" } });
    let steady = 0, shaken = 0;
    const r1 = seeded(3), r2 = seeded(3);
    for (let i = 0; i < 400; i++) {
      if (strikeUnit(a, b, r1).hit) steady++;
      if (strikeUnit(a, b, r2, moraleAim(1)).hit) shaken++;
      b.body.integrity = 1e9;
    }
    expect(shaken).toBeLessThan(steady * 0.65);
    expect(shaken).toBeGreaterThan(steady * 0.35);
  });
});

describe("intelligence, obedience, authority", () => {
  const near = [{ id: "far-weak", distance: 5, health: 10 }, { id: "near-strong", distance: 1, health: 90 }];

  it("a dim or ordinary creature goes for the nearest, a cunning one for the weakest", () => {
    expect(chooseTarget(0, near)).toBe("near-strong");
    expect(chooseTarget(5, near)).toBe("near-strong");
    expect(chooseTarget(8, near)).toBe("far-weak");
    expect(chooseTarget(8, [])).toBeNull();
    expect(rerouteSeconds(1)).toBeGreaterThan(rerouteSeconds(5));
  });

  it("a cunning creature retreats below a quarter of its integrity; a dim one fights on", () => {
    expect(retreats(8, 20, 100)).toBe(true);
    expect(retreats(8, 30, 100)).toBe(false);
    expect(retreats(5, 1, 100)).toBe(false);
  });

  it("disobedience is a chance in proportion to how far obedience falls short of 3; authority makes up for it", () => {
    const rng = seeded(7);
    const rate = (ob: number, auth = 0) => { let n = 0; for (let i = 0; i < 2000; i++) if (ignoresOrder(ob, auth, rng)) n++; return n / 2000; };
    expect(rate(5)).toBe(0);
    expect(rate(0)).toBe(1);
    expect(rate(1.5)).toBeCloseTo(0.5, 1);
    expect(rate(0, 9)).toBe(0); // a KING's authority
    // WILD (-4 obedience) on a creature of ordinary obedience makes it unreliable.
    expect(resolve(dict, "wolf", ["wild"]).num("obedience")).toBeLessThan(3);
  });

  it("command comes from authority: a KING or a CROWN adds its command_limit; KING recruits", () => {
    const king = resolve(dict, "king"), crown = resolve(dict, "crown"), human = resolve(dict, "human");
    expect(commandLimit([human])).toBe(UNCOMMANDED);
    expect(commandLimit([human, king, crown])).toBe(UNCOMMANDED + 50 + 10);
    expect(authorityOf([human, crown])).toBe(6);
    expect(recruitRate([human, king])).toBe(1);
  });

  it("a wolf is aggressive and a sheep is not; loyalty resists theft of a creature", () => {
    expect(aggressive(resolve(dict, "wolf"))).toBe(true);
    expect(aggressive(resolve(dict, "sheep"))).toBe(false);
    expect(theftResistance(resolve(dict, "dog"), "security")).toBe(9);
  });
});

describe("upkeep", () => {
  it("a DRAGON eats 5 food a minute, a TANK burns 1 fuel; a FARM makes 10 food, COAL 2 fuel", () => {
    expect(needs(resolve(dict, "dragon")).food).toBe(5);
    expect(needs(resolve(dict, "tank")).fuel).toBe(1);
    expect(needs(resolve(dict, "wolf"), 10).food).toBeCloseTo(0.6);
    expect(outputs(resolve(dict, "farm")).food).toBe(10);
    expect(outputs(resolve(dict, "coal")).fuel).toBe(2);
  });

  it("draws what it can and says what fell short", () => {
    const stores: Stores = { food: 2, fuel: 0, power: 0, faith: 0 };
    expect(draw(stores, needs(resolve(dict, "dragon")), 60)).toEqual(["food"]);
    expect(stores.food).toBe(0);
    supply(stores, outputs(resolve(dict, "farm")), 60);
    expect(draw(stores, needs(resolve(dict, "dragon")), 60)).toEqual([]);
    expect(stores.food).toBe(5);
  });

  it("food grows where things grow; WHEAT can be eaten for its nutrition", () => {
    expect(groundFood(Tile.Forest)).toBeGreaterThan(0);
    expect(groundFood(Tile.City)).toBe(0);
    expect(useObject(dict, "wheat")?.stats.num("nutrition")).toBe(4);
  });
});

describe("starting supply", () => {
  it("a made machine comes with half an hour of what it draws; a living thing brings nothing", () => {
    expect(startingSupply(resolve(dict, "car"))).toEqual({ food: 0, fuel: 0.1 * STARTING_SUPPLY_MINUTES, power: 0, faith: 0 });
    expect(startingSupply(resolve(dict, "radar"), 2)).toEqual({ food: 0, fuel: 0, power: 2 * 20 * STARTING_SUPPLY_MINUTES, faith: 0 });
    expect(startingSupply(resolve(dict, "dragon"))).toEqual({ food: 0, fuel: 0, power: 0, faith: 0 });
    expect(startingSupply(resolve(dict, "sword"))).toEqual({ food: 0, fuel: 0, power: 0, faith: 0 });
  });
});

describe("hunting", () => {
  it("a hunted body feeds by its mass: a cow far more than a chicken, nothing from a car", () => {
    const dict = demo();
    const cow = carcassFood(resolve(dict, "cow", [])), chicken = carcassFood(resolve(dict, "chicken", []));
    expect(cow).toBeGreaterThan(10);
    expect(chicken).toBeGreaterThan(0);
    expect(cow / chicken).toBeGreaterThan(20);
    expect(carcassFood(resolve(dict, "chicken", []), 3)).toBeCloseTo(chicken * 3, 0);
    expect(carcassFood(resolve(dict, "car", []))).toBe(0);
  });
});
