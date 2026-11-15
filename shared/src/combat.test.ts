import { describe, expect, it } from "vitest";
import { duel, felt, landed, resolve, seeded, spawn, strike, tick, windupOf } from "./index.js";
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
    const blow = strike(resolve(dict, "club"), dog, () => 0.5);
    // A club's 35 blunt, felt (under FELT_KNEE, in full) and at FIGHT_PACE.
    expect(blow.damage).toBeCloseTo(landed(35, 80));
    expect(dog.integrity).toBeCloseTo(80 - landed(35, 80));
  });

  it("applies resistance, then armor", () => {
    const tank = make("tank");
    // rifle: 110 pierce, 0.5 armor pierce; tank: 0.9 pierce resistance, 200 armor
    expect(strike(resolve(dict, "rifle"), tank, () => 0.5).damage).toBe(0);
    // cannon: 300 blast * (1 - 0.6) + 200 crush - 200 armor
    expect(strike(resolve(dict, "cannon"), tank, () => 0.5).damage).toBeCloseTo(landed(120, 12000));
  });

  it("lets a vulnerability raise damage", () => {
    const zombie = make("zombie");
    // torch: 8 fire; zombie res_fire -0.5
    expect(strike(resolve(dict, "torch"), zombie, () => 0.5).damage).toBeCloseTo(landed(12, zombie.stats.num("integrity")));
  });

  it("stops everything at an indestructible target", () => {
    const wall = make("wall", ["indestructible"]);
    expect(strike(resolve(dict, "cannon"), wall, () => 0.5).damage).toBe(0);
    expect(wall.integrity).toBe(8000);
  });

  it("lets an attack absolute beat a general defence absolute", () => {
    const wall = make("wall", ["indestructible"]);
    const hit = strike(resolve(dict, "cannon", ["irresistible"]), wall, () => 0.5);
    expect(hit.damage).toBeCloseTo(landed(2000, 8000)); // 300 blast + 200 crush, times 4 for siege against a structure
    expect(wall.integrity).toBeCloseTo(8000 - landed(2000, 8000));
  });

  it("lets a specific defence absolute beat a general attack absolute", () => {
    const wall = make("wall", ["fireproof"]);
    const hit = strike(resolve(dict, "torch", ["irresistible"]), wall, () => 0.5);
    expect(hit.damage).toBe(0);
    const blast = strike(resolve(dict, "cannon", ["irresistible"]), wall, () => 0.5);
    expect(blast.damage).toBeCloseTo(landed(2000, wall.stats.num("integrity")));
  });

  it("never hits what cannot be targeted", () => {
    const cat = make("cat", ["hidden"]);
    expect(strike(resolve(dict, "gun"), cat, sure).hit).toBe(false);
  });

  it("spends shield before integrity", () => {
    const dog = make("dog");
    dog.shield = 5;
    strike(resolve(dict, "club"), dog, () => 0.5);
    expect(dog.shield).toBe(0);
    expect(dog.integrity).toBeCloseTo(80 - (landed(35, 80) - 5));
  });
});

describe("tick and duel", () => {
  it("strikes at the attack rate", () => {
    const wolf = make("wolf");
    const horse = make("horse");
    tick(wolf, horse, 1, () => 0.5); // wolf: 1.2 strikes a second, 35 pierce
    expect(horse.integrity).toBeCloseTo(400 - 2 * landed(35, 400));
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

describe("felt size", () => {
  it("counts blows and bodies in full up to a person's scale and by the square root past it, keeping their order", () => {
    expect(felt(30)).toBe(30);
    expect(felt(4000)).toBeCloseTo(400);
    expect(felt(250_000)).toBeGreaterThan(felt(60_000));
    // A COLOSSUS's crush still kills a person outright, but a gun on a BEHEMOTH takes tens of shots, not thousands.
    expect(landed(7000, 100)).toBeGreaterThan(100);
    const shots = 250_000 / landed(60, 250_000);
    expect(shots).toBeGreaterThan(50);
    expect(shots).toBeLessThan(400);
  });

  it("a fight between two armed people lasts several seconds, not one", () => {
    const a = make("human"), b = make("human");
    let t = 0;
    while (b.integrity > 0 && t < 60) { strike(resolve(dict, "sword"), b, () => 0.5); t += 1 / resolve(dict, "sword").num("attack_rate"); }
    expect(t).toBeGreaterThanOrEqual(5);
    expect(t).toBeLessThanOrEqual(15);
    expect(a.integrity).toBe(100);
  });

  it("heavy blows wind up first; ordinary ones do not", () => {
    expect(windupOf(resolve(dict, "sword"), make("human"))).toBe(0);
    expect(windupOf(resolve(dict, "behemoth"), make("human"))).toBeGreaterThan(1);
    expect(windupOf(resolve(dict, "gun"), make("tank"))).toBe(0);
  });
});
