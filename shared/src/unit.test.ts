import { describe, expect, it } from "vitest";
import { cannotCarry, carryLimit, resolve, spawn, strike, strikeUnit, Unit } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const hit = () => 0.5; // lands, no block, no critical
const human = (items: { noun: string; adjectives?: string[]; count?: number }[] = [], adjectives: string[] = []) =>
  new Unit(dict, { body: { noun: "human", adjectives }, items });

describe("what a character strikes with", () => {
  it("is a bare hand when it holds nothing", () => {
    expect(human().attack.num("dmg_blunt")).toBe(5);
  });

  it("is the held weapon, scaled by strength when swung", () => {
    expect(human([{ noun: "sword" }]).attack.num("dmg_slash")).toBe(40);
    expect(human([{ noun: "sword" }], ["strong"]).attack.num("dmg_slash")).toBeCloseTo(40 * (8 / 5));
    expect(human([{ noun: "sword" }], ["weak"]).attack.num("dmg_slash")).toBeCloseTo(40 * (3 / 5));
  });

  it("is not scaled by strength when fired, but is by training", () => {
    expect(human([{ noun: "rifle" }], ["strong"]).attack.num("dmg_pierce")).toBe(110);
    const knight = new Unit(dict, { body: { noun: "knight" }, items: [{ noun: "bow" }] });
    expect(knight.attack.num("dmg_pierce")).toBeCloseTo(35 * 1.6);
  });

  it("keeps the weapon's own adjectives", () => {
    expect(human([{ noun: "sword", adjectives: ["sharp"] }]).attack.num("dmg_slash")).toBeCloseTo(64);
  });

  it("needs hands, and has only two", () => {
    expect(() => human([{ noun: "rifle" }, { noun: "sword" }])).toThrow("sword needs a free hand");
    expect(() => new Unit(dict, { body: { noun: "dog" }, items: [{ noun: "sword" }] })).toThrow("dog has no hands");
  });
});

describe("what gear does for its wearer", () => {
  it("applies worn and grafted effects to the body", () => {
    expect(human().body.stats.num("speed_air")).toBe(0);
    expect(human([{ noun: "wing" }]).movement.num("speed_air")).toBe(15);
    expect(human([{ noun: "boot" }]).movement.num("speed_land")).toBe(6);
  });
});

describe("passing effects", () => {
  it("apply a cast verb to the body", () => {
    const fly = dict.word("fly")!;
    const u = new Unit(dict, { body: { noun: "human" }, effects: [{ ops: fly.ops }] });
    expect(u.movement.num("speed_air")).toBe(20);
  });

  it("make a hidden character impossible to hit, armor or not", () => {
    const hide = dict.word("hide")!;
    const target = new Unit(dict, { body: { noun: "human" }, items: [{ noun: "armor" }], effects: [{ set: { untargetable: true }, ops: hide.ops }] });
    expect(strikeUnit(human([{ noun: "gun" }]), target, hit)).toMatchObject({ hit: false, damage: 0 });
  });
});

describe("where damage lands", () => {
  it("destroys armor before the body is hurt", () => {
    const target = human([{ noun: "armor" }]);
    const attacker = human([{ noun: "club" }]); // 35 blunt; armor resists 0.3 and blocks 30 flat
    expect(strikeUnit(attacker, target, hit)).toMatchObject({ on: "armor", damage: 0 });
    const gunner = human([{ noun: "cannon", adjectives: ["light"] }]);
    while (target.outer.name === "armor") strikeUnit(gunner, target, hit);
    expect(target.body.integrity).toBe(100);
    expect(strikeUnit(gunner, target, hit).on).toBe("human");
    expect(target.dead).toBe(true);
  });

  it("takes shield, then armor, then body, in the order carried", () => {
    const target = human([{ noun: "shield" }, { noun: "armor" }]);
    expect(target.layers.map((l) => l.name)).toEqual(["shield", "armor", "human"]);
  });
});

describe("riding", () => {
  const tanker = (adjectives: string[] = [], tank: string[] = []) =>
    new Unit(dict, { body: { noun: "human", adjectives }, items: [{ noun: "sword" }], riding: { noun: "tank", adjectives: tank } });

  it("fights and moves as the vehicle", () => {
    const u = tanker();
    expect(u.attack.num("dmg_blast")).toBe(1200);
    expect(u.movement.num("speed_land")).toBe(18);
    expect(u.outer.name).toBe("tank");
  });

  it("lends the rider's adjectives to the vehicle on top of its own", () => {
    expect(tanker(["fast"]).movement.num("speed_land")).toBe(36);
    expect(tanker(["fast"], ["big"]).movement.num("speed_land")).toBeCloseTo(36 * 0.9);
  });

  it("puts the rider on foot when the vehicle is destroyed", () => {
    const u = tanker();
    u.outer.integrity = 0;
    expect(u.riding).toBeNull();
    expect(u.outer.name).toBe("human");
    expect(u.attack.num("dmg_slash")).toBe(40);
    expect(u.movement.num("speed_land")).toBe(5);
  });
});

describe("nothing is indestructible by default", () => {
  const blow = (weapon: string, target: string) => strike(resolve(dict, weapon), spawn(target, resolve(dict, target)), hit).damage;

  it("a gun cannot hurt a mountain but dynamite can", () => {
    expect(blow("gun", "mountain")).toBe(0);
    expect(blow("dynamite", "mountain")).toBe(2500 * 6 - 2000);
  });

  it("a god ignores the physical but not the spiritual or magical", () => {
    expect(blow("gun", "god")).toBe(0);
    expect(blow("nuke", "god")).toBe(0);
    expect(blow("wizard", "god")).toBe(300);
    expect(blow("angel", "god")).toBe(400);
    expect(resolve(dict, "god").num("upkeep_food")).toBe(0);
  });

  it("siege weapons do not multiply against the living or the portable", () => {
    expect(blow("dynamite", "cow")).toBe(2500);
  });
});

describe("carrying light things", () => {
  it("holds a thing with no slot as an improvised weapon, harder and heavier hitting harder", () => {
    const stone = human([{ noun: "stone" }]).attack.num("dmg_blunt");
    const bread = human([{ noun: "bread" }]).attack.num("dmg_blunt");
    expect(stone).toBeCloseTo(2 * 7 * Math.sqrt(2.6), 0);
    expect(bread).toBeLessThan(5); // softer than a fist
    expect(stone).toBeGreaterThan(5 * 4);
    expect(human([{ noun: "stone" }]).weapon?.noun).toBe("stone");
  });

  it("swings it with strength like any melee weapon", () => {
    expect(human([{ noun: "stone" }], ["strong"]).attack.num("dmg_blunt")).toBeCloseTo(human([{ noun: "stone" }]).attack.num("dmg_blunt") * 8 / 5);
  });

  it("refuses what is too heavy for the carrier's strength", () => {
    expect(carryLimit(resolve(dict, "human"))).toBe(20);
    expect(() => human([{ noun: "table" }])).toThrow("TABLE is too heavy to carry");
    expect(() => human([{ noun: "chair" }])).not.toThrow();
    expect(() => human([{ noun: "table" }], ["strong"])).not.toThrow();
    expect(() => human([{ noun: "stone", count: 5 }], ["weak"])).toThrow("STONE is too heavy to carry");
    expect(cannotCarry(resolve(dict, "tree"), resolve(dict, "human"), "tree")).toBe("TREE cannot be picked up");
  });

  it("takes a free hand, or both for something over half the limit", () => {
    expect(() => human([{ noun: "stone" }, { noun: "stone" }])).not.toThrow();
    expect(() => human([{ noun: "stone" }, { noun: "stone" }, { noun: "stone" }])).toThrow("needs a free hand");
    expect(() => human([{ noun: "rifle" }, { noun: "stone" }])).toThrow("needs a free hand");
    expect(() => human([{ noun: "sword" }, { noun: "chair" }])).not.toThrow();
    expect(() => human([{ noun: "sword" }, { noun: "stone", count: 5 }])).toThrow("needs a free hand"); // 13 kg: two hands
  });
});
