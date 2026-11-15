import { describe, expect, it } from "vitest";
import { auras, countersOf, lasting, parsePhrase } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const kind = (w: string) => parsePhrase(dict, w).kind;

describe("frequency batch 1: the most common words that had no data", () => {
  it("common words of every part of speech are playable", () => {
    for (const w of ["year", "night", "question", "knowledge", "animal", "believe", "remember", "clever", "vulnerable", "correctly", "repeatedly"]) {
      expect(dict.word(w), w).toBeDefined();
    }
    expect(dict.word("believe")!.role).toBe("verb");
    expect(dict.word("clever")!.role).toBe("adjective");
    expect(dict.word("correctly")!.role).toBe("adverb");
  });

  it("abstract words aimed at someone are events; feelings and ideas around you are fields", () => {
    for (const w of ["question", "threat", "infection", "poem", "kindness", "friendship"]) expect(kind(w), w).toBe("event");
    for (const w of ["knowledge", "health", "freedom", "stress", "loyalty"]) expect(kind(w), w).toBe("field");
    for (const w of ["night", "morning", "noon", "evening"]) expect(kind(w), w).toBe("sky");
  });

  it("night and day words end each other, and none of them lasts unanswered", () => {
    expect(countersOf(dict, "night")).toEqual(expect.arrayContaining(["morning", "noon", "dawn"]));
    expect(countersOf(dict, "morning")).toEqual(expect.arrayContaining(["night", "evening"]));
    for (const w of ["night", "morning", "evening", "afternoon", "noon"]) {
      if (lasting(dict, w)) expect(countersOf(dict, w).filter((x) => x !== w).length, w).toBeGreaterThan(0);
    }
  });

  it("things and creatures radiate fear, healing and fields locally, never over most of the map", () => {
    const far: string[] = [];
    for (const [w, def] of dict.words) {
      if (def.role !== "noun") continue;
      let p;
      try { p = parsePhrase(dict, w); } catch { continue; }
      if (p.kind !== "object") continue;
      const s = p.stats;
      for (const a of auras(s, s.num("sight_range"))) if (a.kind !== "light" && a.radius > 200) far.push(`${w} ${a.kind} ${a.radius}`);
      const field = s.num("field_radius");
      if (field > 200 && (def.ops.length || Object.keys(def.set).some((k) => k.startsWith("inflict_")))) far.push(`${w} field ${field}`);
    }
    expect(far).toEqual([]);
  }, 60_000);
});
