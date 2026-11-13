import { describe, expect, it } from "vitest";
import { duel, resolve, seeded, spawn, strike, tick } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
/** Always hits, never blocks, never crits. */
const sure = () => 0;
const never = () => 0.999;
const make = (noun: string, adjectives: string[] = []) => spawn(noun, resolve(dict, noun, adjectives));

describe("strike", () => {
  it("deals raw damage to an unprotected target", () => {
    const dog = make("dog");
    const hit = strike(resolve(dict, "club"), dog, never);
    expect(hit).toMatchObject({ hit: false });
    const landed = strike(resolve(dict, "club"), dog, () => 0.5);
    expect(landed.damage).toBe(35);
    expect(dog.integrity).toBe(80 - 35);
  });

  it("applies resistance, then armor", () => {
    const tank = make("tank");
    // rifle: 110 pierce, 0.5 armor pierce; tank: 0.9 pierce resistance, 200 armor
    expect(strike(resolve(dict, "rifle"), tank, () => 0.5).damage).toBe(0);
    // cannon: 300 blast * (1 - 0.6) + 200 crush - 200 armor
    expect(strike(resolve(dict, "cannon"), tank, () => 0.5).damage).toBeCloseTo(120);
  });

  it("lets a vulnerability raise damage", () => {
    const zombie = make("zombie");
    // torch: 8 fire; zombie res_fire -0.5
    expect(strike(resolve(dict, "torch"), zombie, () => 0.5).damage).toBeCloseTo(12);
  });

  it("stops everything at an indestructible target", () => {
    const wall = make("wall", ["indestructible"]);
    expect(strike(resolve(dict, "cannon"), wall, () => 0.5).damage).toBe(0);
    expect(wall.integrity).toBe(8000);
  });

  it("lets an attack absolute beat a general defence absolute", () => {
    const wall = make("wall", ["indestructible"]);
    const hit = strike(resolve(dict, "cannon", ["irresistible"]), wall, () => 0.5);
    expect(hit.damage).toBe(2000); // 300 blast + 200 crush, times 4 for siege against a structure
    expect(wall.integrity).toBe(6000);
  });

  it("lets a specific defence absolute beat a general attack absolute", () => {
    const wall = make("wall", ["fireproof"]);
    const hit = strike(resolve(dict, "torch", ["irresistible"]), wall, () => 0.5);
    expect(hit.damage).toBe(0);
    const blast = strike(resolve(dict, "cannon", ["irresistible"]), wall, () => 0.5);
    expect(blast.damage).toBe(2000);
  });

  it("never hits what cannot be targeted", () => {
    const cat = make("cat", ["hidden"]);
    expect(strike(resolve(dict, "gun"), cat, sure).hit).toBe(false);
  });

  it("spends shield before integrity", () => {
    const dog = make("dog");
    dog.shield = 20;
    strike(resolve(dict, "club"), dog, () => 0.5);
    expect(dog.shield).toBe(0);
    expect(dog.integrity).toBe(80 - 15);
  });
});

describe("tick and duel", () => {
  it("strikes at the attack rate", () => {
    const wolf = make("wolf");
    const cow = make("cow");
    tick(wolf, cow, 1, () => 0.5); // wolf: 1.2 strikes a second, 35 pierce
    expect(cow.integrity).toBe(450 - 70);
  });

  it("uses up single-use weapons", () => {
    const bomb = make("bomb");
    const house = make("house");
    tick(bomb, house, 6, () => 0.5); // 5 second windup, then one strike
    expect(bomb.integrity).toBe(0);
    expect(house.integrity).toBeLessThan(3000);
  });

  it("replays exactly from a seed", () => {
    const run = () => duel(make("bear"), make("lion"), seeded(7));
    expect(run()).toEqual(run());
  });

  it("gives sensible winners", () => {
    expect(duel(make("bear"), make("wolf"), seeded(1)).winner).toBe("bear");
    expect(duel(make("dragon"), make("knight"), seeded(1)).winner).toBe("dragon");
    expect(duel(make("sheep"), make("cow"), seeded(1)).winner).toBeNull();
  });
});
