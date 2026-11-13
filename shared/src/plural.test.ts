import { describe, expect, it } from "vitest";
import { parsePhrase, pluralize, readNoun, singulars } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("pluralize", () => {
  it("adds -s, -es, -ies and -ves", () => {
    expect(pluralize("cat")).toBe("cats");
    expect(pluralize("box")).toBe("boxes");
    expect(pluralize("church")).toBe("churches");
    expect(pluralize("bush")).toBe("bushes");
    expect(pluralize("glass")).toBe("glasses");
    expect(pluralize("city")).toBe("cities");
    expect(pluralize("day")).toBe("days"); // a vowel before the y keeps it
    expect(pluralize("roof")).toBe("roofs");
    expect(pluralize("half")).toBe("halves");
  });

  it("knows the irregulars", () => {
    const irregular: Record<string, string> = {
      man: "men", woman: "women", child: "children", mouse: "mice", goose: "geese", foot: "feet", tooth: "teeth",
      person: "people", ox: "oxen", wolf: "wolves", knife: "knives", life: "lives", leaf: "leaves",
    };
    for (const [one, many] of Object.entries(irregular)) {
      expect(pluralize(one)).toBe(many);
      expect(singulars(many)[0]).toBe(one);
    }
  });

  it("finds singulars that pluralize back", () => {
    expect(singulars("cats")).toEqual(["cat"]);
    expect(singulars("boxes")).toEqual(["box", "boxe"]); // the caller keeps whichever is a word
    expect(singulars("cities")[0]).toBe("city");
    expect(singulars("ties")).toEqual(["ty", "tie"]); // TIES is tie, since TY is no word
    expect(singulars("cat")).toEqual([]);
  });
});

describe("plural nouns", () => {
  it("reads a plural as several of its singular", () => {
    expect(readNoun(dict, "cats")).toEqual({ word: "cat", plural: true });
    expect(readNoun(dict, "cat")).toEqual({ word: "cat", plural: false });
    expect(readNoun(dict, "wolves")).toEqual({ word: "wolf", plural: true });
  });

  it("lets the plural win over a same-archetype word, and an unrelated word win over the plural", () => {
    // ROADS, LEGS and FALLS are in the data as their own words, of the same archetype as the singular.
    expect(readNoun(dict, "roads")).toEqual({ word: "road", plural: true });
    expect(readNoun(dict, "legs")).toEqual({ word: "leg", plural: true });
    expect(readNoun(dict, "falls")).toEqual({ word: "fall", plural: true });
    // MEN and PEOPLE are groups, not persons: their own data stands.
    expect(readNoun(dict, "men")).toEqual({ word: "men", plural: false });
    expect(readNoun(dict, "people")).toEqual({ word: "people", plural: false });
  });

  it("spawns plural_count of them, costs the S, and number words set how many", () => {
    const cats = parsePhrase(dict, "cats");
    expect(cats).toMatchObject({ kind: "object", noun: "cat", plural: true, count: 3, letters: "cats" });
    expect(parsePhrase(dict, "cat")).toMatchObject({ plural: false, count: 1 });
    // A singular is exactly one, whatever the noun's pack_size; a collective is its pack_size.
    for (const one of ["wolf", "bee", "ant", "sheep"]) expect(parsePhrase(dict, one).count).toBe(1);
    expect(parsePhrase(dict, "wolves").count).toBe(3);
    expect(parsePhrase(dict, "army").count).toBe(100);
    expect(parsePhrase(dict, "ten wolf").count).toBe(10);
    expect(parsePhrase(dict, "ten wolves")).toMatchObject({ noun: "wolf", count: 10, letters: "tenwolves" });
    expect(parsePhrase(dict, "thousand ants")).toMatchObject({ noun: "ant", count: 1000 });
    expect(parsePhrase(dict, "million ants").count).toBe(1e6);
    expect(parsePhrase(dict, "arrows").count).toBe(20);
    expect(parsePhrase(dict, "zero cats").count).toBe(0);
    // A number word takes the adjective slot, like any adjective.
    expect(() => parsePhrase(dict, "ten big wolves")).toThrow("holds 1 adjective");
  });

  it("refuses plurals of words that are not things", () => {
    expect(() => parsePhrase(dict, "fires")).toThrow("only things come in plurals");
    expect(() => parsePhrase(dict, "runs")).toThrow("RUNS is not in the dictionary yet");
  });
});
