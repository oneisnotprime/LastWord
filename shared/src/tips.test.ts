import { describe, expect, it } from "vitest";
import { knowsWord, RULE_TIPS, seeded, TIP_KINDS, tipText, tipWeight, wordIdeas, wordTip } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("word tips", () => {
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
