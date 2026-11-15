import { describe, expect, it } from "vitest";
import { bestWords, knowsWord, RULE_TIPS, seeded, spellableNow, spellGroup, TIP_KINDS, tipText, tipWeight, wordIdeas, wordTip } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("words you can spell now, by group", () => {
  it("sorts words by what spelling them makes", () => {
    expect(spellGroup(dict, "sword")).toBe("weapons");
    expect(spellGroup(dict, "wolf")).toBe("creatures");
    expect(spellGroup(dict, "horse")).toBe("rides");
    expect(spellGroup(dict, "fire")).toBe("events");
    expect(spellGroup(dict, "mill")).toBe("buildings");
    const g = spellableNow(dict, { d: 1, o: 1, g: 1 });
    expect(g.creatures).toContain("dog");
    expect(Object.values(g).flat().every((w) => /^[dog]+$/.test(w))).toBe(true);
  });
});

describe("word tips", () => {
  it("give each property a short plain meaning", () => {
    const huge = wordTip(dict, "huge")!;
    expect(huge.lines[0]).toMatchObject({ text: expect.stringMatching(/^integrity ×8/), why: expect.stringMatching(/damage it takes/) });
    expect(wordTip(dict, "dog")!.lines.find((l) => l.text.startsWith("makes I"))!.why).toMatch(/letters/);
  });

  it("say what a word does in plain numbers, with a counter-word when one exists", () => {
    const huge = wordTip(dict, "huge")!;
    expect(huge.kind).toBe("adjective");
    expect(tipText(huge)).toMatch(/^HUGE \(adj\): integrity ×8/);
    const dog = wordTip(dict, "dog")!;
    expect(dog.kind).toBe("creature");
    expect(dog.does).toMatch(/follows you, damage 20 pierce, makes I \+0\.3\/min/);
    const fire = wordTip(dict, "fire")!;
    expect(fire.kind).toBe("event");
    expect(fire.counter).toBeTruthy();
    expect(tipText(fire)).toContain("countered by");
    expect(wordTip(dict, "lake")!.kind).toBe("terrain");
    expect(wordTip(dict, "mill")!.does).toMatch(/makes W \+1\.2\/min, needs/);
    expect(wordTip(dict, "sword")!.kind).toBe("weapon");
    expect(wordTip(dict, "quickly")).toBeNull();
  });

  it("ideas cover different kinds and lean toward words the player could spell soon", () => {
    const ideas = wordIdeas(dict, {}, seeded(1), 6);
    expect(ideas.length).toBe(6);
    expect(new Set(ideas.map((i) => i.kind)).size).toBe(6);
    for (const i of ideas) expect(TIP_KINDS).toContain(i.kind);
    const held = { d: 1, o: 1, g: 1 };
    expect(tipWeight(held, "dog")).toBeGreaterThan(tipWeight(held, "dogs"));
    expect(tipWeight(held, "dogs")).toBeGreaterThan(tipWeight(held, "zebra"));
    // Over many draws, the held letters show: most ideas are within three letters of the hand.
    const hand = { w: 1, o: 2, l: 1, f: 1, e: 2, r: 1, a: 1, s: 1, t: 1 };
    let near = 0, all = 0;
    for (let s = 0; s < 40; s++) for (const i of wordIdeas(dict, hand, seeded(s), 4)) {
      all++;
      const need: Record<string, number> = {};
      for (const ch of i.word) need[ch] = (need[ch] ?? 0) + 1;
      const miss = Object.entries(need).reduce((m, [ch, n]) => m + Math.max(0, n - ((hand as Record<string, number>)[ch] ?? 0)), 0);
      if (miss <= 3) near++;
    }
    expect(near / all).toBeGreaterThan(0.6);
  });
});

describe("rule tips", () => {
  it("each is one short line naming only real words and properties", () => {
    for (const t of RULE_TIPS) {
      expect(t.text.length, t.text).toBeLessThanOrEqual(80);
      expect(t.words.length + t.properties.length, t.text).toBeGreaterThan(0);
      for (const w of t.words) {
        expect(knowsWord(dict, w), w).toBe(true);
        expect(t.text, w).toContain(w.toUpperCase());
      }
      for (const p of t.properties) expect(dict.properties.has(p), p).toBe(true);
    }
  });
});

describe("crude words (tools/crude.txt)", () => {
  it("are never offered as tips, words of the moment or counter-words", () => {
    const dict = demo();
    expect(dict.crude("porn")).toBe(true);
    expect(dict.crude("PORNS")).toBe(true);
    expect(dict.crude("wolf")).toBe(false);
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) for (const t of wordIdeas(dict, {}, seeded(seed), 8)) { seen.add(t.word); if (t.counter) seen.add(t.counter); }
    expect([...seen].filter((w) => dict.crude(w))).toEqual([]);
  }, 30000);
});

describe("the best words to spell now", () => {
  const hand = (t: string) => [...t].reduce<Record<string, number>>((h, c) => ({ ...h, [c]: (h[c] ?? 0) + 1 }), {});
  const fresh = { armed: false, riding: false, income: 0, creatures: 0, health: 1 };
  it("offers a weapon to empty hands and a ride to someone on foot, at most five, two of a group", () => {
    const best = bestWords(dict, hand("swordhorsee"), fresh);
    expect(best.length).toBeLessThanOrEqual(5);
    expect(best.map((b) => b.word)).toEqual(expect.arrayContaining(["sword", "horse"]));
    expect(best.find((b) => b.word === "sword")!.why).toBe("40 dmg");
    for (const g of new Set(best.map((b) => b.group))) expect(best.filter((b) => b.group === g).length).toBeLessThanOrEqual(2);
  });
  it("keeps a place for the biggest word on offer (the playtester's METEOR)", () => {
    expect(bestWords(dict, hand("meteortrollsa"), fresh).map((b) => b.word)).toContain("meteor");
  });
  it("once armed and mounted, weapons and rides give way; hurt, something that heals comes in", () => {
    const set = bestWords(dict, hand("swordhorsee"), { armed: true, riding: true, income: 5, creatures: 2, health: 0.3 });
    expect(set.some((b) => b.why === "heals")).toBe(true);
    expect(bestWords(dict, {}, fresh)).toEqual([]);
  });
});
