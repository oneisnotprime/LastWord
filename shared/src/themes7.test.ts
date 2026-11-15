import { describe, expect, it } from "vitest";
import { becomes, cardOf, countersOf, doorGuard, hatches, matured, matureSeconds, opensDoors, opensPast, parsePhrase, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const make = (noun: string) => resolve(dict, noun, []);
const card = (text: string) => cardOf(dict, parsePhrase(dict, text)).does.join(" | ");

describe("medieval siege and arms (theme 28)", () => {
  it("door guards: lockable things that bar the way, not rooms, not carried, not terrain", () => {
    for (const w of ["portcullis", "drawbridge", "gate", "postern"]) expect(doorGuard(make(w)), w).toBe(true);
    for (const w of ["house", "castle", "key", "ram", "moat", "wall"]) expect(doorGuard(make(w)), w).toBe(false);
    expect(card("portcullis")).toMatch(/hung on your walk-in building's door.*\+6000 door HP.*bolted against RAM, KEY/);
  });

  it("a guard bolts its door against what it counters, unless the breaker counters the guard", () => {
    const guards = [{ noun: "portcullis", stats: make("portcullis") }];
    const breaker = (noun: string) => ({ noun, archetype: dict.word(noun)!.archetype, counters: make(noun).tags("counters") });
    expect(opensDoors(make("ram")) && opensDoors(make("key")) && opensDoors(make("petard"))).toBe(true);
    expect(opensPast(breaker("ram"), guards)).toBe(false);
    expect(opensPast(breaker("key"), guards)).toBe(false);
    expect(opensPast(breaker("petard"), guards)).toBe(true);
    expect(opensPast(breaker("ram"), [{ noun: "gate", stats: make("gate") }])).toBe(true); // a GATE bolts against nothing
    expect(opensPast(breaker("ram"), [])).toBe(true);
  });

  it("siege engines are ridden and say they batter buildings from afar; a BREACH breaks doors", () => {
    for (const w of ["trebuchet", "catapult", "mangonel", "ballista", "helepolis"]) expect(becomes(make(w)), w).toBe("worn");
    expect(card("trebuchet")).toMatch(/siege ×12: its blows on buildings, walls and doors, from afar/);
    expect(parsePhrase(dict, "breach").kind).toBe("event");
    expect(opensDoors(make("breach"))).toBe(true);
  });
});

describe("mythic beasts and prehistoric giants (theme 29)", () => {
  it("eggs and cocoons hatch; young beasts grow into their beasts", () => {
    expect(hatches(dict, make("egg"))).toBe(true);
    expect(becomes(make("cocoon"))).toBe("ground"); // it cannot move: before hatching it never grew up
    expect(hatches(dict, make("cocoon"))).toBe(true);
    expect(card("egg")).toMatch(/hatches into CHICK in 120 s/);
    expect(matured(dict, { noun: "hatchling" }, make("hatchling"))?.noun).toBe("dinosaur");
    expect(matured(dict, { noun: "dragonet", count: 3 }, make("dragonet"))).toEqual({ noun: "dragon", count: 3 });
    expect(matured(dict, { noun: "eohippus" }, make("eohippus"))?.noun).toBe("horse");
    expect(matureSeconds(make("dragonet"))).toBe(360);
    expect(card("hatchling")).toMatch(/grows into DINOSAUR/);
  });

  it("every new beast has a word that wipes it out or ends it", () => {
    for (const w of ["cockatrice", "gorgon", "dragonet", "wyrm", "lycanthrope", "kelpie", "tyrannosaur", "spinosaurus", "megalodon", "amphisbaena", "lich", "manticore"]) {
      expect(countersOf(dict, w).length, w).toBeGreaterThan(0);
    }
  });
});
