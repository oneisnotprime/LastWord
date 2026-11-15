import { describe, expect, it } from "vitest";
import { countersOf, lasting, parsePhrase, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const kind = (w: string) => parsePhrase(dict, w).kind;

describe("frequency batch 4: the next eleven hundred most common words", () => {
  it("common words of every part of speech are playable", () => {
    for (const w of ["enthusiast", "roam", "vigorous", "forcibly", "zeppelin", "revolver", "wildfire", "monstrous", "unleash", "defensively"]) {
      expect(dict.word(w), w).toBeDefined();
    }
    expect(dict.word("unleash")!.role).toBe("verb");
    expect(dict.word("monstrous")!.role).toBe("adjective");
    expect(dict.word("forcibly")!.role).toBe("adverb");
  });

  it("acts aimed at someone are events, states around you fields, units muster workers and soldiers", () => {
    for (const w of ["wildfire", "carnage", "manslaughter", "wrecking", "persuasion", "migraine", "intrigue", "appropriation"]) expect(kind(w), w).toBe("event");
    for (const w of ["holiness", "frenzy", "inferno", "solitude", "afterlife", "utopia"]) expect(kind(w), w).toBe("field");
    for (const w of ["manpower", "cohort"]) expect(dict.word(w)!.set.summons, w).toBeTruthy();
    for (const w of ["zeppelin", "chariot", "revolver", "launcher", "roach", "nemesis", "seeker"]) expect(kind(w), w).toBe("object");
  });

  it("adjectives act on meaning: MONSTROUS towers, PARALYZED stops, MICROSCOPIC all but vanishes", () => {
    expect(resolve(dict, "wolf", ["monstrous"]).num("mass")).toBeGreaterThan(resolve(dict, "wolf").num("mass") * 5);
    expect(resolve(dict, "horse", ["paralyzed"]).num("speed_land")).toBe(0);
    expect(resolve(dict, "wolf", ["microscopic"]).num("mass")).toBeLessThan(resolve(dict, "wolf").num("mass") * 0.01);
  });

  it("counter-words end what they name: legalization ends a ban, freeing a prison, pax a war", () => {
    expect(countersOf(dict, "ban")).toContain("legalization");
    expect(countersOf(dict, "prison")).toContain("freeing");
    expect(countersOf(dict, "war")).toContain("pax");
    for (const w of ["wildfire", "inferno", "jamming", "strife", "globalization"]) expect(lasting(dict, w), w).toBeNull();
  });
});
