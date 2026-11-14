import { describe, expect, it } from "vitest";
import { cannotRide, claimOf, combineSenses, HOME_GROUND, resolve, senseOf } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const sense = (w: string) => senseOf(dict, w, resolve(dict, w));

describe("senses", () => {
  it("a MAP or COMPASS only shows things, so it is a sense: map_reveal in tiles, detect ranges in metres / 4", () => {
    expect(sense("map")).toEqual({ word: "map", reveal: 200, letters: 125, life: 0 });
    expect(sense("compass")).toEqual({ word: "compass", reveal: 5, letters: 50, life: 0 });
  });

  it("anything that also acts is not: a creature, a lighthouse that shines, a sword, a radar that draws power", () => {
    for (const w of ["eagle", "sword", "radar", "dog", "home", "lighthouse", "laptop", "camera"]) expect(sense(w)).toBeNull();
  });

  it("every demo noun that is a sense shows something", () => {
    const all = [...dict.words].filter(([, d]) => d.role === "noun").map(([w]) => sense(w)).filter((s) => s !== null);
    expect(all.length).toBeGreaterThan(5);
    for (const s of all) expect(s!.reveal + s!.letters + s!.life).toBeGreaterThan(0);
  });

  it("several senses combine to the farthest of each reading", () => {
    expect(combineSenses([sense("map")!, sense("compass")!])).toEqual({ reveal: 200, letters: 125, life: 0 });
    expect(combineSenses([])).toEqual({ reveal: 0, letters: 0, life: 0 });
  });
});

describe("claims", () => {
  it("HOME shelters 10 tiles (twice its claim) at its cover; a CASTLE 60 tiles at 90%; a FLAG at least home ground", () => {
    expect(claimOf(resolve(dict, "home"))).toEqual({ radius: 10, shelter: 0.5, security: 5 });
    expect(claimOf(resolve(dict, "castle"))).toMatchObject({ radius: 60, shelter: 0.9 });
    expect(claimOf(resolve(dict, "base"))).toMatchObject({ radius: 40, shelter: 0.8, security: 8 });
    expect(claimOf(resolve(dict, "flag"))).toEqual({ radius: 20, shelter: HOME_GROUND, security: 2.5 });
    expect(claimOf(resolve(dict, "sword"))).toBeNull();
  });
});

describe("riding", () => {
  it("a HORSE or CAR can be ridden; a BOAT or WAGON cannot move on land", () => {
    expect(cannotRide(resolve(dict, "horse"), "horse")).toBeNull();
    expect(cannotRide(resolve(dict, "car"), "car")).toBeNull();
    expect(cannotRide(resolve(dict, "boat"), "boat")).toMatch(/cannot move on land/);
    expect(cannotRide(resolve(dict, "wagon"), "wagon")).toMatch(/cannot move on land/);
  });
});

describe("cards", () => {
  it("MAP's card says it goes on your screen; HOME's says what it claims", async () => {
    const { cardOf, parsePhrase } = await import("./index.js");
    expect(cardOf(dict, parsePhrase(dict, "map")).does).toEqual([
      "goes on your screen as a minimap, not on the ground", "shows the land within 200 tiles", "shows letter sources within 125 tiles",
    ]);
    expect(cardOf(dict, parsePhrase(dict, "home")).does).toContain("claims 10 tiles around it: your things there take 50% less damage and are harder to steal");
  });
});
