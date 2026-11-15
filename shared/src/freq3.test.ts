import { describe, expect, it } from "vitest";
import { countersOf, lasting, parsePhrase, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const kind = (w: string) => parsePhrase(dict, w).kind;

describe("frequency batch 3: the next eleven hundred most common words", () => {
  it("common words of every part of speech are playable", () => {
    for (const w of ["needless", "nerd", "suppress", "drastically", "parachute", "waterfall", "blitz", "gigantic", "withstand", "endlessly"]) {
      expect(dict.word(w), w).toBeDefined();
    }
    expect(dict.word("suppress")!.role).toBe("verb");
    expect(dict.word("gigantic")!.role).toBe("adjective");
    expect(dict.word("drastically")!.role).toBe("adverb");
  });

  it("acts aimed at someone are events, states around you fields, units muster soldiers", () => {
    for (const w of ["gunshot", "concussion", "demolition", "meltdown", "telegram", "showdown", "paralysis"]) expect(kind(w), w).toBe("event");
    for (const w of ["patriotism", "secrecy", "mastery", "rooftop", "graveyard", "malware"]) expect(kind(w), w).toBe("field");
    for (const w of ["platoon", "vanguard"]) expect(dict.word(w)!.set.summons, w).toBeTruthy();
    for (const w of ["parachute", "ammo", "nerd", "heroine", "blockbuster"]) expect(kind(w), w).toBe("object");
  });

  it("adjectives act on meaning: GIGANTIC and TITANIC tower, POWERLESS disarms, STATIONARY stops", () => {
    expect(resolve(dict, "wolf", ["gigantic"]).num("mass")).toBeGreaterThan(resolve(dict, "wolf").num("mass") * 10);
    expect(resolve(dict, "sword", ["powerless"]).num("dmg_slash")).toBeLessThan(resolve(dict, "sword").num("dmg_slash") * 0.2);
    expect(resolve(dict, "car", ["stationary"]).num("speed_land")).toBe(0);
  });

  it("counter-words end what they name: mediation ends a feud, containment a meltdown", () => {
    expect(lasting(dict, "graveyard")).toBeNull();
    expect(countersOf(dict, "feud")).toContain("mediation");
    expect(countersOf(dict, "meltdown")).toContain("containment");
  });
});
