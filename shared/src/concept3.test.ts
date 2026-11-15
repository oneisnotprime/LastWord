import { describe, expect, it } from "vitest";
import {
  bentClock, combineSpeech, commandText, deathText, graveSplit, helpful, lastStandOf, lettersOf, livesOf, loyaltyLeft, mutinies, NO_RULES, outsideBy,
  parsePhrase, priceOf, raisesOf, readMisspelt, revivesOf, speechOf, stormAt, stormBendOf, stormPlan, seeded, STORM_END, STORM_STAGES, SUDDEN_DEATH_AT,
  type SpeechRules,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const stats = (w: string) => parsePhrase(dict, w).stats;
const rules = (r: Partial<SpeechRules>): SpeechRules => ({ ...NO_RULES, ...r });
const has = (prop: string) => [...dict.words].filter(([, d]) => (d.set[prop] !== undefined && d.set[prop] !== false && d.set[prop] !== 0) || d.ops.some((o) => o[0] === prop)).map(([w]) => w);

describe("spelling rules: language is the battlefield (speech.ts)", () => {
  it("a banned letter cannot be spelled with, and a blank does not cover it", () => {
    const p = priceOf("sword", ["sword"], rules({ banned: ["o"], wild: 3, by: ["CENSORSHIP"] }), { s: 1, w: 1, o: 1, r: 1, d: 1 });
    expect(p.problem).toBe("O is banned (CENSORSHIP)");
  });

  it("a word limit stops long words; short ones pass", () => {
    const r = rules({ limit: 4 });
    expect(priceOf("sword", ["sword"], r, { s: 1, w: 1, o: 1, r: 1, d: 1 }).problem).toMatch(/too long/);
    expect(priceOf("axe", ["axe"], r, { a: 1, x: 1, e: 1 }).problem).toBeNull();
  });

  it("a tax adds copies of the word's own letters; a discount makes the rarest free", () => {
    const taxed = priceOf("sword", ["sword"], rules({ cost: 2 }), { s: 2, w: 2, o: 2, r: 2, d: 2 });
    expect(taxed.extra).toBe("sword");
    expect(taxed.pay.length).toBe(10);
    const cheap = priceOf("jazz", ["jazz"], rules({ cost: 0.5 }), { j: 1, a: 1, z: 2 });
    expect(cheap.free).toBe("zz");
    expect(cheap.pay.length).toBe(2);
  });

  it("blanks pay for missing letters; doubled letters pay for two copies", () => {
    const p = priceOf("sword", ["sword"], rules({ wild: 1 }), { s: 1, w: 1, o: 1, r: 1 });
    expect(p.problem).toBeNull();
    expect(p.wild).toBe(1);
    expect(p.pay).not.toContain("d");
    const d = priceOf("book", ["book"], rules({ doubled: ["o"] }), { b: 1, o: 1, k: 1 });
    expect(d.problem).toBeNull();
    expect(d.pay.length).toBe(3);
  });

  it("free speech ignores others' hindering rules but keeps help; `top` bans the commonest letter held", () => {
    const ban = speechOf(stats("censorship"))!;
    const free = speechOf(stats("freedom"))!;
    expect(free.free).toBe(true);
    const r = combineSpeech([{ word: "censorship", rule: ban, mine: false }, { word: "freedom", rule: free, mine: true }, { word: "poet", rule: speechOf(stats("poet"))!, mine: true }], { e: 5, a: 1 });
    expect(r.banned).toEqual([]);
    expect(r.wild).toBe(1);
    expect(lettersOf("top", { e: 5, a: 1 })).toEqual(["e"]);
    expect(combineSpeech([{ word: "censorship", rule: ban, mine: false }], { e: 5, a: 1 }).banned).toEqual(["e"]);
  });

  it("a word a letter off reads as the real one where typos are allowed", () => {
    expect(readMisspelt(dict, "swrd")?.text).toBe("sword");
    expect(readMisspelt(dict, "sword")).toBeNull();
  });

  it("the core words carry their rules by meaning", () => {
    expect(speechOf(stats("censorship"))!.ban).toBe("top");
    expect(speechOf(stats("gag"))!.ban).toBe("top");
    expect(speechOf(stats("tax"))!.cost).toBe(1.5);
    expect(speechOf(stats("inflation"))!.cost).toBe(2);
    expect(speechOf(stats("stutter"))!.limit).toBe(4);
    expect(speechOf(stats("brevity"))!.limit).toBe(5);
    expect(speechOf(stats("poet"))!.wild).toBe(1);
    expect(speechOf(stats("joker"))!.wild).toBe(1);
    expect(speechOf(stats("emphasis"))!.double).toBe("all");
    expect(speechOf(stats("slang"))!.typos).toBe(1);
    expect(parsePhrase(dict, "gag").kind).toBe("event");
    expect(parsePhrase(dict, "brevity").kind).toBe("field");
  });

  it("broadly: hundreds of words bend spelling, and none hinders its own owner", () => {
    const words = new Set(["ban_letters", "spell_cost", "word_limit", "wild_letters", "double_letters", "misspell_ok", "free_speech"].flatMap(has));
    expect(words.size).toBeGreaterThan(300);
    for (const w of words) {
      const def = dict.word(w)!;
      if (def.role !== "noun") continue;
      let p;
      try { p = parsePhrase(dict, w); } catch { continue; }
      const r = speechOf(p.stats);
      // A thing owned binds its owner: it may only help (a JOKER's blank, a POET's), unless it radiates on enemies.
      if (r && p.kind === "object" && !(p.stats.num("field_radius") > 0)) expect(helpful(r), w).toBe(true);
    }
  });
});

describe("command capacity (mind.ts)", () => {
  it("loyalty left falls with hunger and fear; a mutiny breaks away those below it", () => {
    expect(loyaltyLeft(6, 2.5)).toBe(3.5);
    expect(mutinies(6, 2.5, 5)).toBe(true);
    expect(mutinies(9, 0, 5)).toBe(false);
    expect(commandText(stats("treason"))[0]).toMatch(/come over to you/);
  });

  it("broadly: crowns, banners, leaders and charisma raise command; treason and desertion break it", () => {
    expect(stats("crown").num("command_limit")).toBeGreaterThan(0);
    expect(dict.word("banner")!.ops.some(([p]) => p === "command_limit")).toBe(true);
    expect(dict.word("charisma")!.ops.some(([p]) => p === "command_limit")).toBe(true);
    expect(stats("desertion").num("mutiny")).toBeGreaterThan(0);
    expect(stats("treason").flag("mutiny_joins")).toBe(true);
    expect(has("command_limit").length).toBeGreaterThan(600);
    expect(has("mutiny").length).toBeGreaterThan(50);
  });
});

describe("death and respawn (death.ts)", () => {
  it("extra lives, last stands, rising, revivers, tombs and final deaths come from meaning", () => {
    expect(livesOf(stats("phoenix"))).toBe(1);
    expect(livesOf(stats("survive"))).toBe(1);
    expect(livesOf(stats("immortal sword"))).toBe(Infinity);
    expect(lastStandOf(stats("martyr"))).toBeGreaterThan(0);
    expect(raisesOf(stats("zombie"))).toBe("zombie");
    expect(raisesOf(stats("necromancer"))).toBe("skeleton");
    expect(revivesOf(stats("medic"))).toBeGreaterThan(0);
    expect(revivesOf(stats("resurrection"))).toBeGreaterThan(0);
    expect(stats("tomb").flag("entombs")).toBe(true);
    expect(stats("reaper").flag("denies_revival")).toBe(true);
    expect(stats("boo").flag("haunts")).toBe(true);
    expect(deathText(stats("phoenix"))).toContain("1 extra life");
  });

  it("a grave keeps the rarer half; with no killer it keeps everything", () => {
    expect(graveSplit("eeeazq", true)).toEqual({ grave: "zqa", loot: "eee" });
    expect(graveSplit("eeq", false)).toEqual({ grave: "eeq", loot: "" });
  });

  it("broadly: hundreds of words a ghost may spell, and every one acts on others (never a thing)", () => {
    const ghostly = has("haunts");
    expect(ghostly.length).toBeGreaterThan(300);
    for (const w of ghostly) {
      let kind: string;
      try { kind = parsePhrase(dict, w).kind; } catch { continue; }
      expect(kind, w).not.toBe("object");
    }
    expect(has("prevents_death").length).toBeGreaterThan(100);
    expect(has("last_stand").length).toBeGreaterThan(80);
    expect(has("revives").length).toBeGreaterThan(80);
  });
});

describe("the round: the storm wall (round.ts)", () => {
  it("each circle lies inside the one before, and the wall closes to nothing in ten minutes", () => {
    const plan = stormPlan(256, seeded(7));
    for (let i = 1; i < plan.circles.length; i++) {
      const a = plan.circles[i - 1]!, b = plan.circles[i]!;
      expect(Math.hypot(a.x - b.x, a.y - b.y) + b.r).toBeLessThanOrEqual(a.r + 1e-6);
    }
    expect(STORM_END).toBe(600);
    expect(stormAt(plan, 0)).toMatchObject({ stage: 0, shrinking: false, dps: 0 });
    expect(stormAt(plan, STORM_STAGES[0]!.wait + 10)).toMatchObject({ stage: 1, shrinking: true });
    expect(stormAt(plan, STORM_END + 5)).toMatchObject({ closed: true, r: 0 });
    // The first circle covers every corner from the middle.
    expect(outsideBy(stormAt(plan, 0), 0, 0)).toBeLessThan(0);
  });

  it("words bend it: a truce holds it, doomsday hurries it, overtime holds it long, a showdown brings sudden death", () => {
    expect(stormBendOf(stats("truce"))!.pause).toBeGreaterThan(0);
    expect(stormBendOf(stats("armistice"))!.pause).toBeGreaterThanOrEqual(stormBendOf(stats("truce"))!.pause);
    expect(stormBendOf(stats("overtime"))!.pause).toBeGreaterThan(60);
    expect(stormBendOf(stats("doomsday"))!.shift).toBeGreaterThan(0);
    expect(stormBendOf(stats("showdown"))!.sudden).toBe(true);
    expect(bentClock(100, { pause: 0, shift: 60, sudden: false })).toBe(160);
    expect(bentClock(100, { pause: 0, shift: 0, sudden: true })).toBe(SUDDEN_DEATH_AT);
    expect(new Set(["storm_pause", "storm_shift", "sudden_death"].flatMap(has)).size).toBeGreaterThan(150);
  });
});
