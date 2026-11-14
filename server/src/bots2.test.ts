import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { cookable, parsePhrase, Tile, tileAt } from "@lastword/shared";
import appConfig from "./app.config.js";
import { adjectiveEffect, held, phraseFor, SKILL, sourceOf, wordBook, type Use } from "./bots.js";
import { loadDictionary } from "./data.js";
import { WorldRoom } from "./WorldRoom.js";

// Bots that play the whole game: each system, set up so it is the one thing a bot can do.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const dict = loadDictionary();
const book = wordBook(dict);
const letters = (word: string) => { const l: Record<string, number> = {}; for (const ch of word.replace(/\s/g, "")) l[ch] = (l[ch] ?? 0) + 1; return l; };

/** A room with bots and nobody else; the bots past their peaceful start, everything wild taken away. */
async function room(n: number, difficulty: "easy" | "normal" | "hard" = "hard") {
  WorldRoom.testSeed = 4242;
  const r = (await colyseus.createRoom("world", { bots: n, difficulty })) as unknown as WorldRoom;
  const R = r as any;
  const walkers = R.walkers as Map<string, any>;
  for (const [id, w] of [...walkers]) if (w.master === "-" && w.citizenOf === undefined) R.removeWalker(id);
  const ids = [...(R.bots as Map<string, any>).keys()];
  const bots = ids.map((id) => ({ id, w: walkers.get(id), mind: R.bots.get(id) }));
  for (const b of bots) { Object.assign(b.mind, { peaceUntil: 0, nextSpell: 0 }); b.w.letters = {}; b.w.hp = 1e6; r.rebuild(b.w); }
  return { r, R, bots, walkers };
}

const used = (mind: any, what: string) => mind.used[what] ?? 0;

it("sorts words into what a bot can use them for, from their data", () => {
  for (const use of ["buff", "debuff", "aimed", "boon", "levy", "hinder", "refuge", "war", "route", "city", "tiller", "cook"] as Use[]) {
    expect(book.byUse.get(use)?.length ?? 0, use).toBeGreaterThan(0);
  }
  for (const w of book.byUse.get("buff")!.slice(0, 20)) expect(adjectiveEffect(dict.word(w.word)!.ops)).toBeGreaterThan(0);
  for (const w of book.byUse.get("debuff")!.slice(0, 20)) expect(adjectiveEffect(dict.word(w.word)!.ops)).toBeLessThan(0);
  for (const w of book.byUse.get("city")!) expect(parsePhrase(dict, w.word).stats.flag("takes_city")).toBe(true);
  expect(sourceOf("forage")).toBe("gather");
  expect(sourceOf("hunted COW (+12 food)")).toBe("hunt");
  expect(sourceOf("FARM")).toBe("producer");
  expect(sourceOf("LAND")).toBe("territory");
  expect(sourceOf("bot3's letters")).toBe("loot");
});

it("spells plurals and adjective phrases that improve what it makes, as its skill allows", () => {
  const creature = book.byUse.get("creature")!.find((w) => /^[a-z]+$/.test(w.word) && parsePhrase(dict, w.word).count === 1)!;
  const all = held(Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((c) => [c, 9])));
  const hard = phraseFor(dict, creature, all, SKILL.hard, () => 0);
  expect(hard.text).not.toBe(creature.word);
  expect(hard.plural || !!hard.adjective).toBe(true);
  expect(parsePhrase(dict, hard.text).noun).toBe(creature.word);
  expect(phraseFor(dict, creature, all, SKILL.easy, () => 0).text).toBe(creature.word);
});

it("trades at a market for a letter it lacks, hires a hand, and makes and answers offers", async () => {
  const { r, R, bots } = await room(2, "normal");
  const [a, b] = bots;
  const c = r.map.cities[0]!;
  const market = [...r.state.things].find(([, t]) => t.phrase === "market" && Math.hypot(t.x - c.x, t.y - c.y) < 4)!;
  for (const x of [a!, b!]) { x.w.player.x = market[1].x + 0.5; x.w.player.y = market[1].y; }
  b!.w.player.x += 1;
  // One letter short of the best weapon, with plenty of one letter to trade.
  const weapon = book.byUse.get("weapon")!.find((w) => w.word.length >= 4 && !w.word.includes("e"))!;
  a!.w.letters = { ...letters(weapon.word.slice(1)), e: 20 };
  const want = R.botWant(a!.mind, held(a!.w.letters));
  expect(want).toBeTruthy();
  expect(R.botTrade(a!.id, a!.w, a!.mind, held(a!.w.letters))).toBe("trade");
  expect(a!.w.letters[want.letter]).toBeGreaterThan(0);
  // An offer to the bot beside it: two spare letters for the one it lacks; the other bot accepts.
  const now = R.botWant(a!.mind, held({ ...letters(weapon.word.slice(1)) }));
  const spare = [..."qjxzvkwyfbhmpgucdlnrstoiae"].find((ch) => !now.word.word.includes(ch) && ch !== now.letter)!;
  a!.w.letters = { ...letters(weapon.word.slice(1)), [spare]: 20 };
  b!.w.letters = { [now.letter]: 3 };
  b!.mind.difficulty = "easy"; // takes any fair deal (normal and hard keep letters they want)
  expect(R.botOffer(a!.id, a!.w, a!.mind, held(a!.w.letters))).toBe("offer");
  expect(used(b!.mind, "accept offer")).toBe(1);
  expect(a!.w.letters[now.letter]).toBeGreaterThan(0);
  // With a producer to work and letters to spare, it hires a hand.
  a!.mind.producers = 1;
  a!.w.letters = { e: 40, t: 20 };
  expect(R.botTrade(a!.id, a!.w, a!.mind, held(a!.w.letters))).toBe("hire");
});

it("picks up a weapon lying near, claims an ownerless producer, and takes a city", async () => {
  const { r, R, bots } = await room(1);
  const { id, w, mind } = bots[0]!;
  const weapon = book.byUse.get("weapon")!.find((x) => !parsePhrase(dict, x.word).stats.flag("single_use"))!;
  R.addThing({ spelled: { noun: weapon.word }, phrase: weapon.word, vehicle: false, integrity: null }, "", w.player.x + 3, w.player.y);
  for (let i = 0; i < 60 && !w.unit.weapon; i++) r.update(0.1);
  expect(w.unit.weapon, JSON.stringify(mind.used)).toBeTruthy();
  expect(used(mind, "pick up")).toBe(1);
  const producer = book.byUse.get("producer")!.find((x) => !parsePhrase(dict, x.word).stats.flag("portable"))!;
  const tid = R.addThing({ spelled: { noun: producer.word }, phrase: producer.word, vehicle: false, integrity: null }, "", w.player.x + 1, w.player.y);
  for (let i = 0; i < 20 && r.state.things.get(tid)?.owner !== id; i++) r.update(0.1);
  expect(r.state.things.get(tid)?.owner).toBe(id);
  expect(used(mind, "claim thing")).toBe(1);
  // In a city someone else holds, with the letters of a word that takes a city.
  const c = r.map.cities[1]!;
  w.player.x = c.x + 0.5; w.player.y = c.y + 0.5;
  w.letters = letters(book.byUse.get("city")![0]!.word);
  expect(R.botSystems(id, w, mind, held(w.letters), [], 0)).toBe("city");
  expect(r.state.cities[1]!.ruler).toBe(w.player.name);
});

it("puts a debuff on its foe and a buff on its own weapon; aims a field at its foe", async () => {
  const { r, R, bots, walkers } = await room(2);
  const [a, b] = bots;
  b!.w.player.x = a!.w.player.x + 2; b!.w.player.y = a!.w.player.y;
  a!.w.foe = b!.id;
  const debuff = book.byUse.get("debuff")!.find((x) => !x.word.includes(" "))!;
  a!.w.letters = letters(debuff.word);
  expect(R.botSystems(a!.id, a!.w, a!.mind, held(a!.w.letters), [b!.id], 0)).toBe("describe foe");
  expect(b!.w.player.traits).toContain(debuff.word);
  // Its own weapon: a buff that fits it.
  a!.w.foe = null;
  r.rebuild(a!.w);
  const weapon = book.byUse.get("weapon")!.find((x) => !parsePhrase(dict, x.word).stats.flag("single_use"))!;
  a!.w.letters = letters(weapon.word);
  R.spellWord(a!.id, a!.w, weapon.word);
  const buff = book.byUse.get("buff")!.find((x) => { try { parsePhrase(dict, `${x.word} ${weapon.word}`); return true; } catch { return false; } })!;
  a!.w.letters = letters(buff.word);
  expect(R.botSystems(a!.id, a!.w, a!.mind, held(a!.w.letters), [], 0)).toBe("describe own");
  // An aimed field lands where its foe stands.
  const aimed = book.byUse.get("aimed")!.find((x) => x.reach >= 3)!;
  a!.w.foe = b!.id;
  a!.w.letters = letters(aimed.word);
  a!.mind.tried.clear();
  a!.mind.producers = 9;
  r.rebuild(a!.w);
  // Armed, armoured and mounted already, with no letters for anything else: the aimed field is all it can spell.
  expect(R.botSpell(a!.id, a!.w, a!.mind, held(a!.w.letters), true, 9, false)).toBe("aimed");
  const zone = [...r.state.zones.values()].find((z) => z.word === aimed.word)!;
  expect(Math.hypot(zone.x - b!.w.player.x, zone.y - b!.w.player.y)).toBeLessThan(1);
  expect(walkers.get(b!.id)).toBeTruthy();
});

it("uses area words: plenty over its producers, taxes and laws where others are, war when it fights", async () => {
  const { r, R, bots } = await room(2);
  const [a, b] = bots;
  b!.w.player.x = a!.w.player.x + 4; b!.w.player.y = a!.w.player.y;
  a!.mind.home = { x: a!.w.player.x, y: a!.w.player.y };
  a!.mind.producers = 1;
  a!.mind.roads = 9; // no roads in this test
  const tryUse = (use: Use, people: string[], mine = 0) => {
    const word = book.byUse.get(use)!.find((x) => x.placement !== "object")!;
    a!.w.letters = letters(word.word);
    return R.botSystems(a!.id, a!.w, a!.mind, held(a!.w.letters), people, mine);
  };
  expect(tryUse("boon", [])).toBe("boon");
  expect(tryUse("levy", [b!.id])).toBe("levy");
  expect(tryUse("hinder", [b!.id])).toBe("hinder");
  a!.w.foe = b!.id;
  for (const x of book.byUse.get("debuff")!) a!.mind.tried.add(x.word); // nothing to put on its foe
  expect(tryUse("war", [b!.id], 1)).toBe("war");
  expect(r.state.zones.size).toBeGreaterThan(2);
});

it("lays a road from home toward a city, tills crop land and cooks raw food", async () => {
  const { r, R, bots } = await room(1);
  const { id, w, mind } = bots[0]!;
  // Somewhere on soil, away from cities.
  const spots: { x: number; y: number }[] = [];
  for (let y = 10; y < r.map.size - 10 && spots.length < 2; y += 3) for (let x = 10; x < r.map.size - 10 && spots.length < 2; x += 3) {
    if (tileAt(r.map, x, y) === Tile.Grass && r.map.cities.every((c) => Math.hypot(c.x - x, c.y - y) > 15) && spots.every((s) => Math.hypot(s.x - x, s.y - y) > 20)) spots.push({ x: x + 0.5, y: y + 0.5 });
  }
  const spot = spots[0]!;
  w.player.x = spot!.x; w.player.y = spot!.y;
  mind.home = { ...spot! }; mind.producers = 1;
  w.letters = letters(book.byUse.get("route")![0]!.word);
  expect(R.botSystems(id, w, mind, held(w.letters), [], 0)).toBe("route");
  expect(mind.roads).toBe(1);
  w.player.x = spots[1]!.x; w.player.y = spots[1]!.y;
  mind.home = { ...spots[1]! };
  mind.roads = 9;
  w.letters = letters(book.byUse.get("tiller")![0]!.word);
  expect(R.botSystems(id, w, mind, held(w.letters), [], 0)).toBe("tiller");
  // Raw food carried and no heat about: heat to cook it.
  const raw = book.byUse.get("food")!.find((x) => x.raw && !x.word.includes(" "))!;
  w.letters = letters(raw.word);
  R.spellWord(id, w, raw.word);
  R.takeNear(id, w, null);
  expect(w.gear.some((g: any) => cookable(R.statsOf(g)))).toBe(true);
  w.letters = letters(book.byUse.get("cook")![0]!.word);
  w.stores.food = 0.2; w.hungry = false;
  expect(R.botEat(id, w, mind, held(w.letters))).toBe("cook");
  const here = { x: w.player.x, y: w.player.y };
  R.bots.delete(id); // it waits by the fire
  for (let i = 0; i < 100; i++) { w.player.x = here.x; w.player.y = here.y; w.target = null; r.update(0.1); }
  expect(w.gear.some((g: any) => cookable(R.statsOf(g))), JSON.stringify(w.gear.map((g: any) => g.phrase))).toBe(false);
});

it("a hurt hard bot runs from its attacker and spells a refuge; an easy one fights on", async () => {
  for (const difficulty of ["hard", "easy"] as const) {
    const { r, R, bots, walkers } = await room(2, difficulty);
    const [a, b] = bots;
    b!.w.player.x = a!.w.player.x + 1.5; b!.w.player.y = a!.w.player.y;
    b!.w.foe = a!.id;
    b!.mind.nextSpell = 1e9;
    a!.w.hp = 10;
    a!.w.letters = letters(book.byUse.get("refuge")!.find((x) => x.placement !== "object")!.word);
    const before = Math.hypot(a!.w.player.x - b!.w.player.x, a!.w.player.y - b!.w.player.y);
    R.thinkBot(a!.id, a!.w, a!.mind);
    if (difficulty === "hard") {
      expect(used(a!.mind, "flee")).toBe(1);
      expect(used(a!.mind, "refuge")).toBe(1);
      expect(a!.w.target).toBeTruthy();
      const t = a!.w.target;
      expect(Math.hypot(t.x - b!.w.player.x, t.y - b!.w.player.y)).toBeGreaterThan(before);
    } else expect(used(a!.mind, "flee")).toBe(0);
    expect(walkers.get(a!.id)).toBeTruthy();
    void r;
  }
});
