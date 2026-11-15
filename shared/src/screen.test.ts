import { describe, expect, it } from "vitest";
import {
  afflict, countersShown, falseRack, fakeCall, grandWords, hampered, hears, insightOf, KNOWS, knows, parsePhrase, PANELS, rackText, readPerson,
  resolve, restoresOf, screenLine, screenOf, SCREEN_RULES, STATUSES, voiceOf, VOICE, EARSHOT, type Affliction,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const stats = (w: string) => parsePhrase(dict, w).stats;
const has = (list: string[]) => list.map((status) => ({ status }));

describe("screen (screen.ts)", () => {
  it("statuses grey, blank and scramble panels; the worst blot wins", () => {
    for (const s of ["amnesia", "illiterate", "censor", "gag"]) expect(STATUSES).toContain(s);
    expect(screenOf(has(["blind"])).blots).toEqual({ minimap: "static", bars: "hide", intel: "hide" });
    expect(screenOf(has(["amnesia"])).blots).toMatchObject({ preview: "hide", best: "hide", inventory: "hide" });
    expect(screenOf(has(["censor"])).blots).toEqual({ chips: "hide", feed: "hide" });
    const both = screenOf(has(["illiterate", "amnesia"]));
    expect(both.blots.preview).toBe("hide");
    expect(both.by.preview).toBe("amnesia");
    expect(both.blots.rack).toBe("scramble");
    expect(screenOf([], [], true).blots).toEqual({ minimap: "static", feed: "static" });
    for (const rules of Object.values(SCREEN_RULES)) for (const p of Object.keys(rules!)) expect(PANELS).toContain(p);
  });

  it("restored panels are given back whatever greys them", () => {
    const s = screenOf(has(["blind", "censor"]), ["minimap", "bars"]);
    expect(s.blots).toEqual({ intel: "hide", chips: "hide", feed: "hide" });
    expect(s.restored).toEqual(["bars", "minimap"]);
  });

  it("words give panels back by meaning: GLASSES, a MAP, a BOOK, LITERACY, a DIARY, NEWS", () => {
    expect(restoresOf(stats("glasses"))).toEqual(expect.arrayContaining(["minimap", "bars"]));
    expect(restoresOf(stats("map"))).toContain("minimap");
    expect(restoresOf(stats("book"))).toEqual(expect.arrayContaining(["cards", "rack"]));
    expect(restoresOf(stats("literacy"))).toContain("cards");
    expect(restoresOf(stats("diary"))).toContain("preview");
    expect(restoresOf(stats("newspaper"))).toContain("chips");
    expect(stats("glasses").flag("immune_blind")).toBe(true);
  });

  it("words inflict the screen statuses by meaning: AMNESIA, ILLITERACY, REDACTION, GAG, a CLUB's concussion", () => {
    expect(stats("amnesia").num("inflict_amnesia")).toBeGreaterThan(0);
    expect(stats("illiteracy").num("inflict_illiterate")).toBeGreaterThan(0);
    expect(stats("redaction").num("inflict_censor")).toBeGreaterThan(0);
    expect(stats("gag").num("inflict_gag")).toBeGreaterThan(0);
    expect(stats("club").num("inflict_amnesia")).toBeGreaterThan(0);
    expect(stats("jammer").num("inflict_censor")).toBeGreaterThan(0);
    expect(screenLine("amnesia")).toMatch(/hides spell preview/);
  });

  it("the gagged and silenced are unheard; the screen statuses can be resisted like any other", () => {
    const list: Affliction[] = [];
    afflict(list, [["gag", 5]], resolve(dict, "human"), "x");
    expect(hampered(list).unheard).toBe(true);
    expect(hampered(has(["silence"]) as Affliction[]).unheard).toBe(true);
    const glasses: Affliction[] = [];
    const wearer = resolve(dict, "human");
    wearer.set("immune_blind", true);
    expect(afflict(glasses, [["blind", 5]], wearer, "x")).toEqual([]);
  });
});

describe("knowledge (knowledge.ts)", () => {
  it("insight is the most read_properties of the body and its things; levels unlock counters, racks, an oracle", () => {
    const body = resolve(dict, "human");
    expect(insightOf(body, [stats("book")])).toBeGreaterThanOrEqual(KNOWS.counters);
    expect(insightOf(body, [stats("spy")])).toBeGreaterThanOrEqual(KNOWS.racks);
    expect(insightOf(body, [stats("oracle")])).toBeGreaterThanOrEqual(KNOWS.oracle);
    expect(knows(3)).toEqual({ counters: true, racks: false, oracle: false });
    expect(countersShown(dict, "fire", 0)).toEqual([]);
    expect(countersShown(dict, "fire", 3).length).toBeGreaterThan(0);
  });

  it("reading a person: rack and gear at racks, best words at oracle; lies give a false rack of the same size", () => {
    const who = { id: "b", name: "B", letters: { s: 1, w: 1, o: 1, r: 1, d: 1 }, gear: ["coat"] };
    expect(readPerson(dict, 3, who, null)).toBeNull();
    expect(readPerson(dict, 5, who, null)).toEqual({ id: "b", name: "B", letters: "DORSW", gear: ["COAT"] });
    expect(readPerson(dict, 9, who, null)!.words).toContain("SWORD");
    const fake = falseRack(who.letters, "a:b:1");
    expect(Object.values(fake).reduce((a, b) => a + b, 0)).toBe(5);
    expect(rackText({ a: 9, e: 2, k: 1 })).toBe("A9 EEK");
    expect(falseRack(who.letters, "a:b:1")).toEqual(fake);
    expect(readPerson(dict, 5, who, "a:b:1")!.gear).toEqual([]);
  });
});

describe("communication (comms.ts)", () => {
  it("a voice carries VOICE × EARSHOT tiles plus hearing; a side hears its own anywhere; the deaf nothing", () => {
    expect(voiceOf(resolve(dict, "human"))).toBe(VOICE);
    const ear = { deaf: false, hearing: 10 };
    expect(hears(ear, VOICE, VOICE * EARSHOT, false)).toBe(true);
    expect(hears(ear, VOICE, VOICE * EARSHOT + 10, false)).toBe(false);
    expect(hears(ear, VOICE, 999, true)).toBe(true);
    expect(hears({ deaf: true, hearing: 1e6 }, VOICE, 1, true)).toBe(false);
    // A RADIO carried hears across the map (1 km).
    expect(hears({ deaf: false, hearing: 10 + 3000 }, VOICE, 260, false)).toBe(true);
  });

  it("lies send a made-up grand word, the same for a while", () => {
    expect(grandWords(dict).length).toBeGreaterThan(20);
    const a = fakeCall(dict, "k", ["BOT1", "BOT2"], 5), b = fakeCall(dict, "k", ["BOT1", "BOT2"], 6);
    expect(a).toEqual(b);
    expect(grandWords(dict)).toContain(a.word);
  });
});
