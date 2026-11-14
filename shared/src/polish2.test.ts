import { describe, expect, it } from "vitest";
import { countersOf, inflicts, lasting, LASTING, parsePhrase, statusSeconds, STATUSES, type Status } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("polish batch 2: every lasting effect has a way out", () => {
  it("lasting reads how far and how long a spelling's area holds", () => {
    expect(lasting(dict, "winter")).toEqual({ wide: true, minutes: 20 });
    expect(lasting(dict, "fog")?.wide).toBe(true); // weather is over the whole map
    expect(lasting(dict, "district")).toEqual({ wide: false, minutes: 15 });
    expect(lasting(dict, "sword")).toBeNull(); // an object can be broken or taken
    expect(lasting(dict, "riot")).toBeNull(); // three minutes in one place is soon over
    expect(lasting(dict, "fire")).toEqual({ wide: false, minutes: 10 }); // ended by RAIN, FLOOD...
    expect(countersOf(dict, "fire")).toContain("rain");
    expect(lasting(dict, "truth")).toBeNull(); // follows its speller and ends when they fall
    expect(LASTING.localMinutes).toBeGreaterThan(LASTING.wideMinutes);
  });

  it("every area that lasts (map-wide, or long at one place) is ended by some other word", () => {
    const stuck: string[] = [];
    for (const [w] of dict.words) {
      if (!lasting(dict, w)) continue;
      if (!countersOf(dict, w).some((x) => x !== w)) stuck.push(w);
    }
    expect(stuck).toEqual([]);
  }, 60_000);

  it("weather that ends weather is declared both ways", () => {
    const pairs: [string, string][] = [["autumn", "summer"], ["autumn", "spring"], ["season", "winter"], ["season", "drought"], ["thawing", "winter"], ["rainbow", "storm"]];
    for (const [a, b] of pairs) {
      expect(countersOf(dict, a), `${b} ends ${a}`).toContain(b);
      expect(countersOf(dict, b), `${a} ends ${b}`).toContain(a);
    }
  });

  it("every status a word gives for a minute or more has a word that ends it", () => {
    const cures = new Set<string>();
    for (const [, d] of dict.words) if (Array.isArray(d.set.effect_status)) for (const s of d.set.effect_status as string[]) cures.add(s);
    const stuck = new Set<string>();
    for (const [w, d] of dict.words) {
      if (!Object.keys(d.set).some((k) => k.startsWith("inflict_")) && !d.ops.some(([p]) => p.startsWith("inflict_"))) continue;
      let s; try { s = parsePhrase(dict, w).stats; } catch { continue; }
      for (const [status, n] of inflicts(s)) if (statusSeconds(status as Status, n) >= 60 && !cures.has(status)) stuck.add(`${status} (${w})`);
    }
    expect([...stuck]).toEqual([]);
    expect(STATUSES).toContain("shrink");
    expect(cures.has("shrink")).toBe(true); // GROW
  }, 60_000);
});

describe("polish batch 2: faster counts, same answers", () => {
  it("discTiles gives the tiles whose centres lie in a disc, and the same again from memory", async () => {
    const { discTiles, generateMap } = await import("./index.js");
    const m = generateMap(5);
    const brute: number[] = [];
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (Math.hypot(x + 0.5 - 10.3, y + 0.5 - 20.7) <= 6.5) brute.push(y * m.size + x);
    expect([...discTiles(m, 10.3, 20.7, 6.5)]).toEqual(brute);
    expect(discTiles(m, 10.3, 20.7, 6.5)).toBe(discTiles(m, 10.3, 20.7, 6.5));
    expect([...discTiles(m, 1, 1, 3)].every((i) => i >= 0)).toBe(true); // clipped at the map's edge
  });
});
