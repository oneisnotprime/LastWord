import { describe, expect, it } from "vitest";
import { aimOf, becomes, inspectText, parsePhrase, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const card = (text: string) => {
  const r = inspectText(dict, text);
  if ("error" in r) throw new Error(r.error);
  return r.card;
};

describe("becomes", () => {
  it("a mover that is alive, sentient or self-propelled is a creature; a mount or slotted thing is worn; terrain reshapes; the rest lies on the ground", () => {
    expect(becomes(resolve(dict, "wolf"))).toBe("creature");
    expect(becomes(resolve(dict, "prince"))).toBe("creature");
    expect(becomes(resolve(dict, "ghost"))).toBe("creature"); // sentient
    expect(becomes(resolve(dict, "robot"))).toBe("creature"); // sentient machine
    expect(becomes(resolve(dict, "zombie"))).toBe("creature"); // self-propelled
    expect(becomes(resolve(dict, "rock"))).toBe("ground");
    expect(becomes(resolve(dict, "car"))).toBe("worn");
    expect(becomes(resolve(dict, "dragon"))).toBe("worn"); // mountable
    expect(becomes(resolve(dict, "sword"))).toBe("worn");
    expect(becomes(resolve(dict, "river"))).toBe("terrain");
    expect(becomes(resolve(dict, "stone"))).toBe("ground");
  });
});

describe("aimOf", () => {
  it("targeted events need someone, area events a spot, region events nothing", () => {
    expect(aimOf(parsePhrase(dict, "theft"))).toBe("someone");
    expect(aimOf(parsePhrase(dict, "murder"))).toBe("someone");
    expect(aimOf(parsePhrase(dict, "fire"))).toBe("anywhere");
    expect(aimOf(parsePhrase(dict, "sword"))).toBeNull();
    expect(aimOf(parsePhrase(dict, "run"))).toBeNull();
  });
});

describe("cards", () => {
  it("a creature card says what it is, its numbers and that it follows you", () => {
    const c = card("wolf");
    expect(c.title).toBe("WOLF");
    expect(c.kind).toContain("creature");
    expect(c.stats.some((s) => s.startsWith("integrity"))).toBe(true);
    expect(c.stats.some((s) => s.startsWith("damage"))).toBe(true);
    expect(c.does).toContain("walks with you and defends you");
    expect(c.letters).toBe("wolf");
  });
  it("a vehicle is ridden and draws fuel it comes with; plurals show a count", () => {
    const c = card("car");
    expect(c.does).toContain("you ride it: it moves and takes hits for you");
    expect(c.does.some((d) => /draws 0\.1 fuel a minute \(comes with 30 min\)/.test(d))).toBe(true);
    expect(card("wolves").title).toBe("WOLF ×3");
  });
  it("a GHOST follows and needs no food; BREAD can be used; adjectives alone are aimed", () => {
    expect(card("ghost").does).toContain("walks with you and defends you");
    expect(card("ghost").does).toContain("not alive: needs no food");
    expect(card("zombie").does).toContain("takes no orders (not sentient)");
    expect(card("bread").does.some((d) => d.startsWith("usable (U)"))).toBe(true);
    const a = card("worst");
    expect(a.kind).toBe("adjectives");
    expect(a.does[0]).toMatch(/^WORST: /);
  });
  it("an event says how it is aimed; nonsense gives the reason it cannot be spelled", () => {
    expect(card("theft").does).toContain("cast it, then click whom or what it acts on");
    expect(inspectText(dict, "xqzt")).toEqual({ error: "XQZT is not in the dictionary yet" });
  });
});
