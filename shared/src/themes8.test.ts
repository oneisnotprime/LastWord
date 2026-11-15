import { describe, expect, it } from "vitest";
import { capturesInto, cardOf, countersOf, endsPact, holds, isTrap, pactOf, parsePhrase, rearms, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const make = (noun: string) => resolve(dict, noun, []);
const card = (text: string) => cardOf(dict, parsePhrase(dict, text)).does.join(" | ");

describe("traps and dungeons (theme 30)", () => {
  it("traps that are not single-use re-arm; the rest are spent", () => {
    for (const w of ["mantrap", "minefield", "barbwire", "abatis", "crusher", "quicksand"]) expect(isTrap(make(w)) && rearms(make(w)), w).toBe(true);
    for (const w of ["landmine", "tripwire", "caltrop", "fetter", "snare"]) expect(isTrap(make(w)) && !rearms(make(w)), w).toBe(true);
    expect(card("minefield")).toMatch(/re-arms after 20 s/);
  });

  it("lockups hold enemies inside; homes and small cells do not", () => {
    for (const w of ["jail", "dungeon", "prison", "panopticon", "chokey", "slammer", "bullpen"]) expect(holds(make(w)), w).toBe(true);
    for (const w of ["house", "castle", "inn", "cage", "oubliette"]) expect(holds(make(w)), w).toBe(false);
    expect(card("dungeon")).toMatch(/a lockup: enemies inside cannot walk out/);
  });

  it("traps and events that capture say so; each has a way out", () => {
    for (const w of ["mantrap", "chute", "incarceration", "internment", "captivity", "remand"]) expect(capturesInto(make(w)), w).toBe(true);
    expect(card("mantrap")).toMatch(/captures: drops its victim into your nearest lockup/);
    for (const w of ["jailbreak", "breakout", "liberation"]) expect(make(w).tags("counters"), w).toContain("door");
    for (const w of ["mantrap", "minefield", "barbwire", "crusher", "chute"]) expect(countersOf(dict, w).length, w).toBeGreaterThan(0);
  });
});

describe("heraldry, courts and fealty (theme 31)", () => {
  it("fealty is a pact whose speller takes tribute from the others", () => {
    const f = pactOf(make("fealty"))!;
    expect(f.size).toBe(2);
    expect(f.tribute).toBeCloseTo(0.3);
    expect(pactOf(make("feudalism"))!.size).toBeGreaterThan(2);
    expect(pactOf(make("oath"))!.tribute).toBe(0);
    expect(pactOf(make("treaty"))!.tribute).toBe(0);
    expect(card("fealty")).toMatch(/the others pay you 30% of every letter they earn/);
  });

  it("every pact with tribute has words that end it free; BETRAYAL ends oaths", () => {
    for (const w of ["fealty", "homage", "allegiance", "suzerainty", "feudalism", "villeinage", "corvee", "socage", "enfeoffment"]) {
      expect(countersOf(dict, w).length, w).toBeGreaterThan(0);
      expect(endsPact(make("betrayal").tags("counters"), w) || endsPact(make("rebellion").tags("counters"), w), w).toBe(true);
    }
    expect(endsPact(make("betrayal").tags("counters"), "oath")).toBe(true);
    expect(endsPact(make("betrayal").tags("counters"), "war")).toBe(false);
  });

  it("challenges and courts act through the shared systems", () => {
    expect(make("challenge").num("stakes")).toBeGreaterThan(0);
    expect(make("usurpation").flag("takes_city")).toBe(true);
    expect(make("knighthood").get("summons")).toBe("knight");
  });
});
