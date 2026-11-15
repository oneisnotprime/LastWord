import { describe, expect, it } from "vitest";
import { BORE_TILES, bores, cardOf, cooks, heatNeeded, matured, matureSeconds, parsePhrase, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const make = (noun: string, adjectives: string[] = []) => resolve(dict, noun, adjectives);
const card = (text: string) => cardOf(dict, parsePhrase(dict, text)).does.join(" | ");

describe("bugs, grubs and swarms (theme 26)", () => {
  it("a young creature grows into its matures_into, count and adjectives kept, after growth_time × GROW_PACE", () => {
    expect(matureSeconds(make("maggot"))).toBeCloseTo(18);
    expect(matured(dict, { noun: "maggot", count: 30, adjectives: ["giant"] }, make("maggot"))).toEqual({ noun: "blowfly", count: 30, adjectives: ["giant"] });
    expect(matured(dict, { noun: "caterpillar" }, make("caterpillar"))?.noun).toBe("butterfly");
    expect(matured(dict, { noun: "tadpole" }, make("tadpole"))?.noun).toBe("frog");
    expect(matured(dict, { noun: "wolf" }, make("wolf"))).toBeNull();
    expect(matureSeconds(make("wolf"))).toBe(Infinity);
    expect(card("larva")).toMatch(/grows into BEETLE/);
  });

  it("a borer eats into things made of what it bores, not things of other stuff", () => {
    expect(bores(dict, make("termite"), make("house"))).toBe(true);
    expect(bores(dict, make("termite"), make("house", ["stone"]))).toBe(false);
    expect(bores(dict, make("shipworm"), make("boat"))).toBe(true);
    expect(bores(dict, make("shipworm"), make("boat", ["iron"]))).toBe(false);
    expect(bores(dict, make("wolf"), make("house"))).toBe(false);
    expect(card("termite")).toMatch(new RegExp(`bores into wood.*${BORE_TILES} tiles`));
  });
});

describe("stone and ore (theme 27)", () => {
  it("ore is raw and smelts into its metal only by heat of its smelts_at: a forge, not a campfire", () => {
    expect(heatNeeded(make("dough"))).toBe(150);
    expect(heatNeeded(make("hematite"))).toBe(1200);
    expect(String(make("malachite").get("cooks_into"))).toBe("copper");
    const campfire = make("campfire"), forge = make("forge");
    expect(cooks(campfire) && campfire.num("temperature") >= heatNeeded(make("hematite"))).toBe(false);
    expect(forge.num("temperature") >= heatNeeded(make("hematite"))).toBe(true);
    expect(card("cassiterite")).toMatch(/becomes TIN/);
  });

  it("rocks and minerals are materials that remake what they come before", () => {
    const talc = make("sword", ["talc"]), sword = make("sword");
    expect(talc.num("hardness")).toBeLessThan(sword.num("hardness"));
    expect(make("shield", ["muscovite"]).num("res_electric")).toBeGreaterThan(0.5);
    expect(make("pitchblende").num("dmg_radiation")).toBeGreaterThan(0);
    expect(make("gorge").get("tile_type")).toBe("pit");
  });
});

describe("display: numbers shown felt", () => {
  it("cards and the best-words strip show damage and HP on the felt curve, not raw millions", () => {
    const nuke = cardOf(dict, parsePhrase(dict, "nuke")).stats.find((s) => s.startsWith("damage"))!;
    expect(nuke).not.toMatch(/,000,000/);
    expect(cardOf(dict, parsePhrase(dict, "sword")).stats.find((s) => s.startsWith("damage"))).toMatch(/^damage 40/);
  });
});
