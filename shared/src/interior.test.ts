import { describe, expect, it } from "vitest";
import { cardOf, DOOR_SHARE, parsePhrase, doorAt, interiorOf, interiorText, opensDoors, resolve, seesThroughWalls, within } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const s = (noun: string) => resolve(dict, noun, []);

describe("walk-in buildings", () => {
  it("are enterable buildings that shelter people and are big enough to walk around in", () => {
    for (const w of ["house", "cottage", "barn", "inn", "castle", "palace", "prison"]) expect(interiorOf(s(w)), w).not.toBeNull();
    // too small: a roof to duck under (shared hazard.ts), not a room
    for (const w of ["hut", "shed", "tent", "shack", "kennel"]) expect(interiorOf(s(w)), w).toBeNull();
    // workplaces that shelter nobody, and things that are not enterable at all
    for (const w of ["bakery", "smithy", "greenhouse", "sword", "wall", "horse"]) expect(interiorOf(s(w)), w).toBeNull();
  });

  it("grow with their footprint, and a pile of them is one bigger room", () => {
    const house = interiorOf(s("house"))!, castle = interiorOf(s("castle"))!;
    expect(house.radius).toBeCloseTo(1.5);
    expect(castle.radius).toBeCloseTo(5.5);
    expect(interiorOf(s("house"), 4)!.radius).toBeCloseTo(2.5);
    // two tents are still too small; four make a room
    expect(interiorOf(s("tent"), 1)).toBeNull();
  });

  it("have a door with a share of the building's integrity, on the south wall", () => {
    expect(interiorOf(s("house"))!.door).toBeCloseTo(s("house").num("integrity") * DOOR_SHARE);
    expect(doorAt(10, 10, 1.5)).toEqual({ x: 10, y: 11.5 });
    expect(within({ x: 10, y: 11 }, 10, 10, 1.5)).toBe(true);
    expect(within({ x: 10, y: 12 }, 10, 10, 1.5)).toBe(false);
  });

  it("are opened by door counters and seen into by sight through walls", () => {
    expect(opensDoors(s("key"))).toBe(true);
    expect(opensDoors(s("thief"))).toBe(true);
    expect(opensDoors(s("sword"))).toBe(false);
    expect(seesThroughWalls(s("radar"))).toBe(true);
    expect(seesThroughWalls(s("telescope"))).toBe(false);
  });

  it("say so on their card", () => {
    expect(interiorText(s("house")).join(" ")).toMatch(/walk-in.*door 300 HP/);
    expect(cardOf(dict, parsePhrase(dict, "house")).does.join(" ")).toMatch(/walk-in/);
    expect(interiorText(s("key")).join(" ")).toMatch(/breaks an enemy's door/);
  });
});
