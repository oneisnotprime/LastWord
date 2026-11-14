import { describe, expect, it } from "vitest";
import { MARKET, parsePhrase, SALE_MAX, salePrice, spellchecked, standIn, standsFor, STATUSES, TILE_METERS } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("polish batch 1", () => {
  it("a market pays for a thing by its worth: a letter a tenfold at the usual ratio, fewer where dear, up to SALE_MAX", () => {
    expect(salePrice(0, 1, MARKET.ratio)).toBe(0);
    expect(salePrice(5, 1, MARKET.ratio)).toBe(0);
    expect(salePrice(10, 1, MARKET.ratio)).toBe(1);
    expect(salePrice(5000, 1, MARKET.ratio)).toBe(3);
    expect(salePrice(5000, 1, MARKET.ratio * 2)).toBe(1);
    expect(salePrice(1e12, 1, MARKET.ratio)).toBe(SALE_MAX);
    expect(salePrice(50, 20, MARKET.ratio)).toBe(salePrice(1000, 1, MARKET.ratio));
  });

  it("WORD stands for four-letter words, LETTER for six-letter ones, BOOK for documents", () => {
    expect(standsFor(dict.word("word")!.set.stands_for)).toEqual({ length: 4 });
    expect(standIn(dict, "word wolf")).toEqual({ stand: "word", word: "wolf", letters: "word" });
    expect(standIn(dict, "word sword")).toBeNull();
    expect(standIn(dict, "letter dragon")?.letters).toBe("letter");
    expect(standIn(dict, "book map")?.word).toBe("map");
    expect(standIn(dict, "book wolf")).toBeNull();
    expect(standIn(dict, "word")).toBeNull();
    expect(standIn(dict, "wolf word")).toBeNull();
    // Alone, each is still its own word.
    expect(parsePhrase(dict, "letter").stats.num("inflict_charm")).toBeGreaterThan(0);
    expect(parsePhrase(dict, "book").kind).toBe("object");
  });

  it("a DICTIONARY spellchecks what is close to it", () => {
    const s = parsePhrase(dict, "dictionary").stats;
    expect(spellchecked(s.num("spellchecks"), 2, TILE_METERS)).toBe(true);
    expect(spellchecked(s.num("spellchecks"), 1000, TILE_METERS)).toBe(false);
    expect(s.num("inflict_expose")).toBeGreaterThan(0);
  });

  it("only a handful of words seal a fate, and every one of them can be ended", () => {
    const doom = [...dict.words].filter(([, d]) => d.set.inflict_doom !== undefined || d.ops.some(([p]) => p === "inflict_doom")).map(([w]) => w);
    expect(doom.length).toBeLessThanOrEqual(10);
    for (const w of ["fate", "doom", "deadline"]) expect(doom).toContain(w);
    for (const w of ["kismet", "portent", "voodoo", "ominous"]) expect(doom).not.toContain(w);
    const enders = [...dict.words].filter(([, d]) => Array.isArray(d.set.effect_status) && (d.set.effect_status as string[]).includes("doom"));
    expect(enders.length).toBeGreaterThan(3);
    expect(STATUSES).toContain("doom");
  });

  it("EON, AEON and EPOCH (time ×2 or more for the whole map) are ended by ETERNITY and DECELERATION", () => {
    for (const w of ["eon", "aeon", "epoch"]) {
      const enders = [...dict.words].filter(([, d]) => Array.isArray(d.set.counters) && (d.set.counters as string[]).includes(w)).map(([x]) => x);
      expect(enders, w).toEqual(expect.arrayContaining(["eternity", "deceleration"]));
    }
  });
});
