import { describe, expect, it } from "vitest";
import {
  automates, breedRate, BREED_PACE, cardOf, claimOf, comfortOf, craftPlan, CRAFTED, craftsOf, exposed, eyeOf, hoards, holdFactor, homeComfort, keepSafe,
  makesAt, parsePhrase, resolve, seeded, storageOf, takeLetters, tickStatuses, worksAt, wildlife, type Affliction,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const make = (noun: string, adjectives: string[] = []) => resolve(dict, noun, adjectives);
const card = (text: string) => cardOf(dict, parsePhrase(dict, text)).does.join(" | ");

describe("buildings and furniture (themes 3 and 4): comfort", () => {
  it("comfort lifts morale and healing by the square root of all of it", () => {
    expect(homeComfort(0)).toEqual({ morale: 0, regeneration: 0 });
    expect(homeComfort(4)).toEqual({ morale: 2, regeneration: 0.5 });
    expect(homeComfort(100).morale).toBe(10); // a palace full of furniture is not a hundred cottages
  });

  it("a BED, a SOFA and a CAT are comfortable; a PRISON is not; a stack counts each", () => {
    expect(comfortOf(make("bed"))).toBeGreaterThan(comfortOf(make("chair")));
    expect(comfortOf(make("sofa"))).toBeGreaterThan(0);
    expect(comfortOf(make("cat"))).toBeGreaterThan(0);
    expect(comfortOf(make("prison"))).toBe(0);
    expect(comfortOf(make("chair"), 4)).toBe(comfortOf(make("chair")) * 4);
    expect(comfortOf(make("palace"))).toBeGreaterThan(comfortOf(make("cottage")));
    expect(card("bed")).toMatch(/comfort 4: inside your claimed ground your side's morale \+2/);
  });
});

describe("buildings and furniture: storage", () => {
  it("stored letters are out of a thief's and a fine's reach", () => {
    expect(storageOf(make("warehouse"))).toBeGreaterThan(storageOf(make("shed")));
    expect(storageOf(make("sword"))).toBe(0);
    const hand = { e: 5, a: 3, q: 1 };
    expect(exposed(hand, 6)).toBe(3);
    expect(takeLetters({ ...hand }, 9, seeded(1), 6)).toHaveLength(3);
    expect(takeLetters({ ...hand }, 9, seeded(1), 100)).toBe("");
    expect(takeLetters({ ...hand }, 2, seeded(1))).toHaveLength(2);
  });

  it("at death the rarest letters stay in the stores, shared by what each stores", () => {
    const { kept, loose } = keepSafe({ e: 5, a: 3, q: 1, z: 2 }, 4);
    expect(kept).toEqual({ q: 1, z: 2, a: 1 });
    expect(loose).toEqual({ e: 5, a: 2 });
    const shares = hoards({ e: 6, q: 2 }, [100, 300]);
    expect(shares.join("").length).toBe(8);
    expect(shares[1]!.length).toBeGreaterThan(shares[0]!.length);
    expect(hoards({ e: 3 }, [])).toEqual([]);
    expect(card("vault")).toMatch(/keeps 10000 of your letters safe/);
  });
});

describe("buildings: lockups hold the rooted", () => {
  it("a PRISON holds ten times; a HOUSE does not hold", () => {
    expect(holdFactor(make("prison"))).toBe(10);
    expect(holdFactor(make("house"))).toBe(1);
    expect(claimOf(make("jail"))!.holds).toBe(8);
    const list: Affliction[] = [{ status: "root", left: 10, from: "", origin: "" } as Affliction, { status: "poison", left: 10, from: "", origin: "" } as Affliction];
    tickStatuses(list, 5, 10);
    expect(list.find((a) => a.status === "root")!.left).toBeCloseTo(9.5);
    expect(list.find((a) => a.status === "poison")!.left).toBeCloseTo(5);
    expect(card("prison")).toMatch(/holds enemies in its claimed ground: their root and silence last ×10/);
  });

  it("a HOSPITAL heals and cures its side through its field; a LIBRARY trains", () => {
    const h = make("hospital");
    expect(h.num("heals")).toBeGreaterThan(0);
    expect(h.num("field_radius")).toBeGreaterThan(0);
    expect(h.tags("effect_status")).toContain("poison");
    expect(dict.word("library")!.ops.some(([p]) => p === "intelligence")).toBe(true);
  });
});

describe("tools and crafting (theme 5)", () => {
  it("an ANVIL makes weapons and works metal; a WORKBENCH furniture out of wood", () => {
    const anvil = craftsOf(make("anvil")), bench = craftsOf(make("workbench"));
    expect(makesAt(dict, anvil, "sword")).toBe(true);
    expect(makesAt(dict, anvil, "chair")).toBe(false);
    expect(makesAt(dict, bench, "chair")).toBe(true);
    expect(worksAt(dict, anvil, "iron")).toBe(true); // a metal
    expect(worksAt(dict, anvil, "wood")).toBe(false);
    expect(worksAt(dict, bench, "wood")).toBe(true);
    expect(makesAt(dict, anvil, "iron")).toBe(false); // materials are worked, not made
  });

  it("IRON carried to an ANVIL makes an IRON SWORD, handmade; a spelled material is kept", () => {
    const stations = [{ word: "anvil", crafts: craftsOf(make("anvil")) }];
    const plan = craftPlan(dict, "sword", [], stations, ["bread", "iron"])!;
    expect(plan).toEqual({ station: "anvil", used: 1, states: [CRAFTED, "iron"] });
    const sword = resolve(dict, "sword", [], plan.states), plain = make("sword", ["iron"]);
    expect(sword.tags("material")).toEqual(["iron"]);
    expect(sword.num("integrity")).toBeGreaterThan(plain.num("integrity")); // handmade
    expect(craftPlan(dict, "sword", ["glass"], stations, ["iron"])).toEqual({ station: "anvil", used: null, states: [CRAFTED] });
    expect(craftPlan(dict, "chair", [], stations, ["iron"])).toBeNull();
    expect(craftPlan(dict, "sword", [], stations, [])!.used).toBeNull();
  });

  it("gathering tools name their kind of gathering", () => {
    for (const w of ["hatchet", "trowel", "scythe", "hook", "drill"]) expect(make(w).num("harvest_bonus")).toBeGreaterThan(1);
    expect(card("anvil")).toMatch(/crafting station \(weapon, tool/);
  });
});

describe("machines and technology (theme 6)", () => {
  it("a CAMERA on the ground watches its ground; a SWORD or a DOG does not", () => {
    expect(eyeOf(make("camera"))).toBeGreaterThanOrEqual(40);
    expect(eyeOf(make("observatory"))).toBeGreaterThan(eyeOf(make("camera")));
    expect(eyeOf(make("sword"))).toBe(0);
    expect(eyeOf(make("eagle"))).toBe(0); // alive: a creature, not a thing on the ground
    expect(card("camera")).toMatch(/watches 50 tiles around where it stands/);
  });

  it("a CONVEYOR works like hands; a ROBOT is a worker with labour", () => {
    expect(automates(make("conveyor"))).toBe(5);
    expect(automates(make("conveyor"), 2)).toBe(10);
    expect(automates(make("farmer"))).toBe(0); // alive: works as a creature instead
    expect(make("robot").num("labor")).toBeGreaterThan(0);
    expect(make("generator").num("power_output")).toBeGreaterThan(0);
  });
});

describe("animals by family (theme 7)", () => {
  it("a pair breeds at its reproduction, BREED_PACE times faster than life; one alone does not", () => {
    expect(breedRate(6, 1)).toBe(0);
    expect(breedRate(6, 2)).toBeCloseTo((6 * BREED_PACE) / 60);
    expect(breedRate(6, 5)).toBeCloseTo(breedRate(6, 4)); // two pairs
    expect(breedRate(0, 10)).toBe(0);
    expect(card("hamster")).toMatch(/breeds/);
  });

  it("new animals live in their biomes", () => {
    expect(wildlife(dict, "savanna").map(([w]) => w)).toEqual(expect.arrayContaining(["cheetah", "wildebeest"]));
    expect(wildlife(dict, "jungle").map(([w]) => w)).toEqual(expect.arrayContaining(["leopard", "piranha"]));
  });
});
