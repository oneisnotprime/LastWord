import { describe, expect, it } from "vitest";
import { demo, kitData } from "./testdata.js";
import {
  buildingLines, dealKits, jobBodyOps, jobLines, jobRules, jobStats, kitCard, kitHand, legendCost, sealedLetters, unlockNeed, unlockText,
  type KitData,
} from "./kits.js";
import { starterWords, STARTING_HAND } from "./economy.js";
import { parsePhrase } from "./phrase.js";
import { becomes } from "./inspect.js";
import { seeded } from "./rng.js";
import { harvest, tradeRateOf } from "./place.js";
import { toolHelp } from "./biome.js";

const dict = demo();
const data = kitData() as KitData;

describe("kit tables (data/kits.json)", () => {
  it("has 100 jobs and 100 buildings, all different", () => {
    expect(data.jobs).toHaveLength(100);
    expect(new Set(data.jobs.map((j) => j.word)).size).toBe(100);
    expect(data.buildings).toHaveLength(100);
    expect(new Set(data.buildings).size).toBe(100);
  });

  it("every job is a person word with perks through shared properties", () => {
    for (const j of data.jobs) {
      expect(dict.word(j.word)?.class, j.word).toBe("person");
      expect(Object.keys(j.set).length + j.ops.length, j.word).toBeGreaterThan(0);
      for (const id of [...Object.keys(j.set), ...j.ops.map((o) => o[0])]) expect(dict.properties.has(id), `${j.word} ${id}`).toBe(true);
      expect(jobLines(j).length, j.word).toBeGreaterThan(0);
    }
  });

  it("every building is a fixed thing on the ground that does something", () => {
    for (const b of data.buildings) {
      const p = parsePhrase(dict, b);
      expect(p.kind, b).toBe("object");
      expect(["ground", "terrain"], b).toContain(becomes(p.stats));
      if (becomes(p.stats) === "terrain") expect(p.stats.get("tile_type"), b).toBe("tilled");
      expect(p.stats.flag("portable"), b).toBe(false);
      // Something besides its integrity.
      expect(buildingLines(dict, b).length, b).toBeGreaterThan(1);
    }
  });

  it("every legendary has a counter that names it and an unlock condition", () => {
    expect(data.legendaries.length).toBeGreaterThanOrEqual(12);
    for (const l of data.legendaries) {
      expect(dict.word(l.word), l.word).toBeTruthy();
      expect(dict.word(l.counter)?.set.counters, l.word).toContain(l.word);
      expect(unlockText(l), l.word).toMatch(/\w/);
      expect(unlockNeed(l), l.word).toBeGreaterThan(0);
    }
    expect(new Set(data.legendaries.map((l) => l.unlock.kind)).size).toBeGreaterThanOrEqual(8);
  });
});

describe("kits", () => {
  it("deals three kits with different jobs, buildings and legendaries", () => {
    for (let seed = 1; seed < 50; seed++) {
      const kits = dealKits(data, dict, seeded(seed));
      expect(kits).toHaveLength(3);
      for (const k of ["job", "building", "legend"] as const) expect(new Set(kits.map((x) => x[k])).size).toBe(3);
      const card = kitCard(data, dict, kits[0]!);
      expect(card.letters).toHaveLength(STARTING_HAND);
      expect(card.legend.unlock).toMatch(/\w/);
    }
  });

  it("every job's starting hand is eight letters that spell at least one producer", () => {
    const starters = starterWords(dict);
    const spells = (hand: Record<string, number>, w: string) => {
      const need: Record<string, number> = {};
      for (const ch of w) need[ch] = (need[ch] ?? 0) + 1;
      return Object.entries(need).every(([ch, n]) => (hand[ch] ?? 0) >= n);
    };
    for (const job of data.jobs) {
      for (let seed = 0; seed < 20; seed++) {
        const hand = kitHand(dict, job, seeded(seed * 31 + job.word.length));
        expect(Object.values(hand).reduce((a, b) => a + b, 0)).toBe(STARTING_HAND);
        expect(starters.some((w) => spells(hand, w)), `${job.word} ${JSON.stringify(hand)}`).toBe(true);
        for (const ch of "jqxz") expect(hand[ch] ?? 0, job.word).toBe(0);
      }
    }
  });

  it("a job leans the hand toward its letters", () => {
    const fisher = data.jobs.find((j) => j.letters.includes("o"))!;
    let o = 0;
    for (let seed = 0; seed < 50; seed++) o += kitHand(dict, fisher, seeded(seed)).o ?? 0;
    expect(o / 50).toBeGreaterThan(1.5);
  });

  it("a job acts through shared systems: tool help, body operations, letter yields, prices", () => {
    const farmer = data.jobs.find((j) => j.word === "farmer")!;
    expect(toolHelp("forage", [{ name: "farmer", stats: jobStats(dict, farmer) }])[0]?.chance).toBeCloseTo(0.2);
    const rules = jobRules(dict, farmer)!;
    expect(harvest("aaaaaaaaaa", [rules], seeded(1)).length).toBeGreaterThan(10);
    expect(jobBodyOps(farmer).some((o) => o[0].startsWith("produce_"))).toBe(false);
    const merchant = data.jobs.find((j) => j.word === "merchant")!;
    expect(tradeRateOf([jobRules(dict, merchant)!])).toBe(0.75);
  });

  it("an unsealed legendary spells free; adjectives and plurals still cost", () => {
    expect(legendCost("dragon", "dragon", "dragon")).toBe("");
    expect([...legendCost("hugedragon", "dragon", "dragon")!].sort().join("")).toBe("eghu");
    expect(legendCost("dragons", "dragon", "dragon")).toBe("s");
    expect(legendCost("wolf", "wolf", "dragon")).toBeNull();
    expect(sealedLetters("dragon")).toBe("rgn");
  });
});
