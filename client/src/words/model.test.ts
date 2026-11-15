import { describe, expect, it } from "vitest";
import { dictionary as dict } from "../data.js";
import { buildIndex, cardFor, countersFor, DIMENSIONS, EMPTY, fromSearch, passes, propertyRows, search, summaryOf, toSearch, valueOf, type Query } from "./model.js";

const index = buildIndex(dict);
const find = (patch: Partial<Query>) => search(index, { ...EMPTY, ...patch }).map((e) => e.w);

describe("word browser model (words.html)", () => {
  it("indexes every playable word", () => {
    expect(index.length).toBe(dict.size);
    expect(index.find((e) => e.w === "hat")!.props.has("temp_max")).toBe(true); // from its ops
  });

  it("searches by substring, prefix, suffix and exact word, the word itself first", () => {
    const sw = find({ q: "sword" });
    expect(sw[0]).toBe("sword");
    expect(sw).toContain("broadsword");
    expect(find({ q: "sword", mode: "starts" })).not.toContain("broadsword");
    expect(find({ q: "sword", mode: "ends" })).toContain("broadsword");
    expect(find({ q: "sword", mode: "exact" })).toEqual(["sword"]);
  });

  it("filters by role, class, group, dimension and a property comparison", () => {
    expect(find({ role: "verb" }).every((w) => dict.word(w)!.role === "verb")).toBe(true);
    const fire = find({ prop: "dmg_fire", cmp: ">", val: "0" });
    expect(fire).toContain("fire");
    expect(fire.every((w) => valueOf(dict.word(w)!, "dmg_fire")! > 0)).toBe(true);
    expect(find({ prop: "nature", cmp: "=", val: "metal" })).toContain("sword");
    expect(find({ group: "rules" }).length).toBeGreaterThan(0);
    for (const d of Object.keys(DIMENSIONS)) expect(find({ dim: d }).length, d).toBeGreaterThan(0);
    expect(passes(dict.word("sword")!, "dmg_slash", "<", "10")).toBe(false);
  });

  it("sorts by a number, words without it last", () => {
    const by = find({ sort: "dmg_slash", desc: true, role: "noun" });
    const vals = by.map((w) => valueOf(dict.word(w)!, "dmg_slash"));
    const known = vals.filter((v) => v !== undefined) as number[];
    expect(known.length).toBeGreaterThan(10);
    expect(known).toEqual([...known].sort((a, b) => b - a));
    expect(vals.slice(0, known.length).every((v) => v !== undefined)).toBe(true);
    const freq = search(index, { ...EMPTY, sort: "freq", desc: true }, { sword: [5, "core", ""], wolf: [4, "core", ""] }).map((e) => e.w);
    expect(freq.slice(0, 2)).toEqual(["sword", "wolf"]);
  });

  it("keeps the whole view in the query string", () => {
    const q: Query = { ...EMPTY, q: "fire", role: "noun", prop: "dmg_fire", cmp: ">", val: "0", sort: "freq", desc: true, w: "fire", gloss: true };
    expect(toSearch(EMPTY)).toBe("");
    expect(fromSearch(toSearch(q))).toEqual(q);
  });

  it("says what the game says", () => {
    const c = cardFor(dict, "sword");
    expect("card" in c && c.card.stats[0]).toMatch(/damage 40 slash/);
    expect(summaryOf(dict, "sword").effect).toMatch(/damage 40 slash/);
    expect(summaryOf(dict, "rain").effect).toMatch(/wetness/);
    expect(summaryOf(dict, "fly").effect).toMatch(/flying speed/);
    const adv = cardFor(dict, "quickly");
    expect("card" in adv && adv.card.kind).toMatch(/adverb/);
    for (const e of index.slice(0, 2000)) expect(() => summaryOf(dict, e.w)).not.toThrow();
  });

  it("finds counters both ways and groups properties", () => {
    const fire = countersFor(dict, "fire");
    expect(fire.endedBy).toContain("water");
    expect(countersFor(dict, "water").ends).toContain("fire");
    const groups = propertyRows(dict, dict.word("sword")!).map(([g]) => g);
    expect(groups).toContain("offence");
  });
});
