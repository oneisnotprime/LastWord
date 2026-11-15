import { describe, expect, it } from "vitest";
import { countersOf, lasting, parsePhrase, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const kind = (w: string) => parsePhrase(dict, w).kind;

describe("frequency batch 6: the next eleven hundred most common words", () => {
  it("common words of every part of speech are playable", () => {
    for (const w of ["linkage", "lovingly", "parlour", "glider", "streetcar", "boomerang", "shiv", "detonation", "superhuman", "extinguish", "inexplicably"]) {
      expect(dict.word(w), w).toBeDefined();
    }
    expect(dict.word("extinguish")!.role).toBe("verb");
    expect(dict.word("superhuman")!.role).toBe("adjective");
    expect(dict.word("powerfully")!.role).toBe("adverb");
    expect(dict.word("wildcat")!.archetype).toBe("mammal");
  });

  it("acts aimed at someone are events, states around you fields, units muster soldiers", () => {
    for (const w of ["detonation", "crossfire", "manhunt", "flak", "rout", "cremation", "subversion", "dizziness"]) expect(kind(w), w).toBe("event");
    for (const w of ["tenacity", "hegemony", "cadre", "stench", "anarchism", "battleground", "armament"]) expect(kind(w), w).toBe("field");
    for (const w of ["cadre", "subgroup", "humankind"]) expect(dict.word(w)!.set.summons, w).toBeTruthy();
    for (const w of ["glider", "streetcar", "airliner", "scarecrow", "wildcat", "fiend", "toon", "aegis", "wetland", "hilltop"]) expect(kind(w), w).toBe("object");
    for (const w of ["nightfall", "daybreak", "smog"]) expect(kind(w), w).toBe("sky");
  });

  it("adjectives act on meaning: SUPERHUMAN strengthens, INANIMATE stills, BLINDFOLDED blinds", () => {
    expect(resolve(dict, "wolf", ["superhuman"]).num("integrity")).toBeGreaterThan(resolve(dict, "wolf").num("integrity") * 2);
    expect(resolve(dict, "horse", ["inanimate"]).num("speed_land")).toBe(0);
    expect(resolve(dict, "wolf", ["blindfolded"]).num("inflict_blind")).toBeGreaterThan(0);
    expect(resolve(dict, "wolf", ["teeny"]).num("mass")).toBeLessThan(resolve(dict, "wolf").num("mass") * 0.1);
  });

  it("counter-words end what they name: extinguish ends fire, flak an airliner, daybreak nightfall", () => {
    expect(countersOf(dict, "fire")).toContain("extinguish");
    expect(countersOf(dict, "airliner")).toContain("flak");
    expect(countersOf(dict, "glider")).toContain("flak");
    expect(countersOf(dict, "nightfall")).toContain("daybreak");
    expect(countersOf(dict, "altercation")).toContain("mediate");
    for (const w of ["detonation", "crossfire", "manhunt", "nightfall", "daybreak", "smog", "moratorium", "hegemony"]) expect(lasting(dict, w), w).toBeNull();
  });
});
