import { describe, expect, it } from "vitest";
import { countersOf, lasting, parsePhrase, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const kind = (w: string) => parsePhrase(dict, w).kind;

describe("frequency batch 5: the next eleven hundred most common words", () => {
  it("common words of every part of speech are playable", () => {
    for (const w of ["defunct", "degrade", "dreamer", "bayonet", "omnibus", "horde", "shelling", "towering", "shatter", "lecturing"]) {
      expect(dict.word(w), w).toBeDefined();
    }
    expect(dict.word("shatter")!.role).toBe("verb");
    expect(dict.word("towering")!.role).toBe("adjective");
    expect(dict.word("relentlessly")!.role).toBe("adverb");
  });

  it("acts aimed at someone are events, states around you fields, units muster barbarians and guards", () => {
    for (const w of ["shelling", "vendetta", "deforestation", "coercion", "hypnosis", "gunpoint", "vertigo", "insolvency"]) expect(kind(w), w).toBe("event");
    for (const w of ["heroism", "fortitude", "allure", "expanse", "alchemy", "vigilance", "horde", "cordon"]) expect(kind(w), w).toBe("field");
    for (const w of ["horde", "cordon", "troupe", "entourage", "paramilitary"]) expect(dict.word(w)!.set.summons, w).toBeTruthy();
    for (const w of ["bayonet", "aeroplane", "omnibus", "goliath", "wight", "cupid", "vantage", "wasteland"]) expect(kind(w), w).toBe("object");
    expect(kind("nighttime")).toBe("sky");
  });

  it("adjectives act on meaning: TOWERING looms, LIFELESS stops, BLINDING blinds", () => {
    expect(resolve(dict, "wolf", ["towering"]).num("mass")).toBeGreaterThan(resolve(dict, "wolf").num("mass") * 4);
    expect(resolve(dict, "horse", ["lifeless"]).num("speed_land")).toBe(0);
    expect(resolve(dict, "lamp", ["blinding"]).num("inflict_blind")).toBeGreaterThan(0);
  });

  it("counter-words end what they name: peacekeeping ends rioting, reconciled a vendetta, deregulation a ban", () => {
    expect(countersOf(dict, "rioting")).toContain("peacekeeping");
    expect(countersOf(dict, "vendetta")).toContain("reconciled");
    expect(countersOf(dict, "ban")).toContain("deregulation");
    expect(countersOf(dict, "forest")).toContain("deforestation");
    for (const w of ["vendetta", "horde", "shelling", "endgame", "nighttime", "attrition"]) expect(lasting(dict, w), w).toBeNull();
  });
});
