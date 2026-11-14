import { describe, expect, it } from "vitest";
import { ACTION_LETTERS, missing, parsePhrase, production, reachability, reachTable, seeded, starterHand, starterWords, STARTING_HAND } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("starting hand", () => {
  it("is eight letters, no free SWORD, and always spells a word that produces a letter the actions do not give", () => {
    const words = starterWords(dict);
    expect(words).toEqual(expect.arrayContaining(["dog", "farm", "mill"]));
    expect(words).not.toContain("sword");
    for (let seed = 0; seed < 300; seed++) {
      const hand = starterHand(dict, seeded(seed));
      expect(Object.values(hand).reduce((n, v) => n + v, 0)).toBe(STARTING_HAND);
      const spellable = words.filter((w) => !missing(hand, w));
      expect(spellable.length).toBeGreaterThan(0);
      const makes = production(parsePhrase(dict, spellable[0]!).stats);
      expect(Object.keys(makes).some((ch) => !ACTION_LETTERS.includes(ch))).toBe(true);
    }
  });
});

describe("reachability", () => {
  const { routes, unreached } = reachability(dict);
  it("prints the shortest chain to every letter", () => {
    console.log(`Letter reachability from the action letters:\n${reachTable(dict)}`);
  });
  it("every action letter is reached by its action, and keeps the words that need it in play", () => {
    for (const ch of ACTION_LETTERS) expect(routes.get(ch)?.how).toBe("action");
  });
  it("letters not yet reached are only those that wait on later parts (land, roads, citizens, labour, producers)", () => {
    // Parts 2 and 3 add sources for these; until then a word producing them is the only way in.
    const pending = new Set("abcilmnprswyz");
    for (const ch of unreached) expect(pending.has(ch)).toBe(true);
    expect(routes.get("f")?.how).toBe("burns");
  });
  it("each chain is spellable in order from the letters before it", () => {
    for (const r of routes.values()) {
      const have = new Set(ACTION_LETTERS + "v");
      for (const w of r.chain) {
        for (const ch of w) expect(have.has(ch) || [...routes.values()].some((o) => o.letter === ch && o.depth < r.depth)).toBe(true);
        for (const [ch] of Object.entries(production(parsePhrase(dict, w).stats))) have.add(ch);
      }
    }
  });
});
