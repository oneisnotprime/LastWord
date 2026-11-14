import { describe, expect, it } from "vitest";
import { ACTION_LETTERS, missing, parsePhrase, PENDING_SOURCES, producerOf, reachability, reachTable, seeded, starterHand, starterWords, STARTING_HAND } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("starting hand", () => {
  it("is eight letters, no free SWORD, and always spells a word that produces a letter the actions do not give", () => {
    const words = starterWords(dict);
    expect(words).toEqual(expect.arrayContaining(["dog", "farm", "mill", "hoe", "hedge"]));
    expect(words).not.toContain("sword");
    // Nothing that needs something else built first: furniture (a claim), a machine (vowels, power), a crop off tilled land.
    for (const w of ["bed", "press", "engine", "corn"]) if (w !== "corn") expect(words).not.toContain(w);
    for (let seed = 0; seed < 300; seed++) {
      const hand = starterHand(dict, seeded(seed));
      expect(Object.values(hand).reduce((n, v) => n + v, 0)).toBe(STARTING_HAND);
      const spellable = words.filter((w) => !missing(hand, w));
      expect(spellable.length).toBeGreaterThan(0);
      const makes = producerOf(parsePhrase(dict, spellable[0]!).stats).rates;
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
  it("letters not yet reached are only those part 3 builds (land, roads, cities, bosses)", () => {
    for (const ch of unreached) expect(PENDING_SOURCES).toContain(ch);
    expect(routes.get("f")?.how).toBe("burns");
  });
  it("chains go through the plan's producers: crops on tilled land, livestock, flora, labour, stations, machines", () => {
    expect(routes.get("a")!.chain).toEqual(["hoe"]);
    expect(routes.get("i")!.chain).toEqual(["dog"]);
    expect(routes.get("p")!.chain).toEqual(["hedge"]);
    expect(routes.get("n")!.word).toBe("aide");
    expect(routes.get("y")!.how).toBe("ages");
    // Furniture comes only once claimed ground is reached.
    const b = routes.get("b")!;
    expect(b.chain.some((w) => parsePhrase(dict, w).stats.num("claim_radius") > 0)).toBe(true);
    for (const r of routes.values()) if (r.how === "produces") expect(producerOf(parsePhrase(dict, r.word).stats).rates).toHaveProperty(r.letter);
  });
  it("each chain is spellable in order from the letters before it", () => {
    for (const r of routes.values()) {
      const have = new Set(ACTION_LETTERS + "v");
      for (const w of r.chain) {
        for (const ch of w) expect(have.has(ch) || [...routes.values()].some((o) => o.letter === ch && o.depth < r.depth)).toBe(true);
        for (const o of routes.values()) if (o.word === w) have.add(o.letter);
      }
    }
  });
});
