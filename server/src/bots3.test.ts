import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { isBoon, isGraft, Tile, tileAt, walkable, type Status } from "@lastword/shared";
import appConfig from "./app.config.js";
import { held, wordBook, type ThemeUse } from "./bots.js";
import { loadDictionary } from "./data.js";
import { WorldRoom } from "./WorldRoom.js";

// Bots use the dictionary themes' systems (batches 3 to 5): each set up so it is what a bot can do.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const dict = loadDictionary();
const book = wordBook(dict);
const letters = (word: string) => { const l: Record<string, number> = {}; for (const ch of word.replace(/\s/g, "")) l[ch] = (l[ch] ?? 0) + 1; return l; };
const used = (mind: any, what: string) => mind.used[what] ?? 0;

/** Bots and nobody else, side by side in a city, past their peaceful start, with nothing wild about. */
async function room(n: number, difficulty: "easy" | "normal" | "hard" = "hard") {
  WorldRoom.testSeed = 4242;
  const r = (await colyseus.createRoom("world", { bots: n, difficulty })) as unknown as WorldRoom;
  const R = r as any;
  const walkers = R.walkers as Map<string, any>;
  for (const [id, w] of [...walkers]) if (w.master === "-" && w.citizenOf === undefined) R.removeWalker(id);
  const c = r.map.cities[0]!;
  const bots = [...(R.bots as Map<string, any>).keys()].map((id, i) => ({ id, w: walkers.get(id), mind: R.bots.get(id) }));
  bots.forEach((b, i) => {
    Object.assign(b.mind, { peaceUntil: 0, nextSpell: 0 });
    b.w.letters = {}; b.w.hp = 1e6; b.w.player.x = c.x + 0.5 + i; b.w.player.y = c.y + 0.5;
    r.rebuild(b.w);
  });
  /** The themes' choice, a few times over (each thought starts from a different system), until one is made. */
  const themes = (b: (typeof bots)[number], people: string[] = [], attackers: string[] = [], creatures = 0, only?: ThemeUse) => {
    // Only the use under test: every affordable word of the other uses is set aside.
    const have = held(b.w.letters);
    const mine = new Set((only ? book.byUse.get(only) ?? [] : []).map((x) => x.word));
    b.mind.tried = new Set([...book.byUse].filter(([u]) => only && u !== only).flatMap(([, l]) => l.filter((x) => !mine.has(x.word) && x.cost.every((n, i) => n <= have[i]!)).map((x) => x.word)));
    for (let i = 0; i < 30; i++) {
      b.mind.themedAt = undefined;
      const done = R.botThemes(b.id, b.w, b.mind, held(b.w.letters), people, attackers, creatures, false);
      if (done) return done as string;
    }
    return null;
  };
  return { r, R, bots, walkers, themes };
}

it("sorts the themes' words by use from their data", () => {
  for (const use of ["warm", "disguise", "graft", "cure", "hex", "duel", "gift", "loan", "bribe", "trap", "lie", "jam", "shrine", "miracle", "morale", "haste", "rewind", "gravity", "vessel", "fishing", "luck"] as ThemeUse[]) {
    expect(book.byUse.get(use)?.length ?? 0, use).toBeGreaterThan(0);
  }
  for (const w of book.byUse.get("hex")!) expect(w.statuses!.every((st) => !isBoon(st as Status))).toBe(true);
  expect(book.byUse.get("hex")!.some((w) => w.word === "doom" && w.statuses!.includes("doom"))).toBe(true);
  expect(book.byUse.get("cure")!.some((w) => w.statuses!.includes("doom"))).toBe(true);
  expect(book.byUse.get("cure")!.some((w) => w.statuses!.includes("sick"))).toBe(true);
  expect(book.byUse.get("warm")!.some((w) => w.word === "parka")).toBe(true);
  expect(book.byUse.get("vessel")!.some((w) => w.word === "boat")).toBe(true);
});

it("cures its sickness, calms its rage, ends its doom, and dresses warm in the cold", async () => {
  const { r, R, bots } = await room(1);
  const { id, w, mind } = bots[0]!;
  const ail = (status: Status) => { w.statuses.push({ status, left: 120, from: "", origin: "" }); R.statusChanged(w); };
  ail("sick");
  w.letters = letters("cure");
  expect((mind.curedAt = undefined, R.botCure(id, w, mind, held(w.letters)))).toBe("cure");
  expect(w.statuses.some((a: any) => a.status === "sick")).toBe(false);
  expect(used(mind, "cure sick")).toBe(1);
  ail("doom");
  w.letters = letters("reprieve");
  expect((mind.curedAt = undefined, R.botCure(id, w, mind, held(w.letters)))).toBe("cure");
  for (let i = 0; i < 12; i++) r.update(0.1);
  expect(w.statuses.some((a: any) => a.status === "doom")).toBe(false);
  ail("rage");
  w.letters = letters("order");
  expect((mind.curedAt = undefined, R.botCure(id, w, mind, held(w.letters)))).toBe("calm");
  for (let i = 0; i < 12; i++) r.update(0.1);
  expect(w.statuses.some((a: any) => a.status === "rage")).toBe(false);
  w.exposed = "cold";
  w.letters = letters("parka");
  expect((mind.curedAt = undefined, R.botCure(id, w, mind, held(w.letters)))).toBe("warm");
  expect(w.gear.some((g: any) => g.spelled.noun === "parka")).toBe(true);
});

it("passes a sealed fate on the person it fights, and duels them when well ahead", async () => {
  const { R, bots, themes } = await room(2);
  const [a, b] = bots;
  a!.w.foe = b!.id;
  a!.w.letters = letters("doom");
  expect(themes(a!, [b!.id], [], 0, "hex")).toBe("hex");
  expect(b!.w.statuses.some((s: any) => s.status === "doom")).toBe(true);
  expect(used(a!.mind, "hex doom")).toBe(1);
  // Well ahead: a DUEL stakes letters, the two of them ringed in.
  b!.w.hp = a!.w.hp * 0.2; R.rebuild(b!.w);
  a!.w.letters = { ...letters("duel"), e: 30 };
  b!.w.letters = { e: 30 };
  const duel = themes(a!, [b!.id], [], 0, "duel");
  expect(duel, String(R.clients)).toBe("duel");
  expect(R.challengeOf(a!.id, b!.id)).toBeTruthy();
});

it("grafts a body part on itself or a creature, wins a fierce wild animal over with a GIFT, and loans to a neighbour", async () => {
  const { R, bots, walkers, themes } = await room(2);
  const [a, b] = bots;
  a!.w.letters = letters("wings");
  expect(themes(a!, [], [], 0, "graft")).toBe("graft");
  expect(a!.w.gear.some((g: any) => isGraft(R.statsOf(g)))).toBe(true);
  expect(used(a!.mind, "graft self")).toBe(1);
  const wolf = R.addCreature({ spelled: { noun: "wolf" }, phrase: "wolf", vehicle: false, integrity: null }, "-", a!.w.player.x + 1, a!.w.player.y, 1);
  const wid = typeof wolf === "string" ? wolf : [...walkers].find(([, w]) => w.body.noun === "wolf")![0];
  a!.w.letters = { ...letters("gift"), e: 10 };
  expect(themes(a!, [], [], 0, "gift")).toBe("gift");
  const charmed = walkers.get(wid); expect(charmed.statuses.some((s: any) => s.status === "charm") || charmed.master === a!.id, JSON.stringify([charmed.statuses, charmed.master, a!.mind.used])).toBe(true);
  a!.w.letters = { ...letters("loan"), e: 40 };
  b!.w.player.x = a!.w.player.x + 1; b!.w.player.y = a!.w.player.y;
  expect(themes(a!, [b!.id], [], 0, "loan")).toBe("loan");
  expect(b!.w.statuses.some((s: any) => s.status === "debt")).toBe(true);
});

it("steps away from the sick; lays a trap and builds a shrine at home; hastes itself in a fight", async () => {
  const { r, R, bots, themes } = await room(2);
  const [a, b] = bots;
  b!.w.statuses.push({ status: "sick", left: 120, from: "", origin: "", contagion: 0 }); R.statusChanged(b!.w);
  b!.w.player.x = a!.w.player.x + 1; b!.w.player.y = a!.w.player.y;
  b!.mind.nextSpell = Infinity; a!.mind.nextSpell = Infinity;
  R.thinkBot(a!.id, a!.w, a!.mind);
  expect(used(a!.mind, "avoid sick")).toBe(1);
  expect(Math.hypot(a!.w.target.x - b!.w.player.x, a!.w.target.y - b!.w.player.y)).toBeGreaterThan(3);
  b!.w.statuses.length = 0; R.statusChanged(b!.w);
  b!.w.player.x += 30;
  a!.mind.home = { x: a!.w.player.x, y: a!.w.player.y };
  a!.mind.producers = 1;
  a!.w.letters = letters("landmine");
  expect(themes(a!, [], [], 0, "trap")).toBe("trap");
  a!.w.letters = letters("shrine");
  expect(themes(a!, [], [], 0, "shrine")).toBe("shrine");
  a!.w.foe = b!.id;
  a!.w.letters = letters("hurry");
  expect(themes(a!, [], [], 0, "haste")).toBe("haste");
  r.update(0.1);
});

it("by the water, fishes with a rod, and takes a boat out and back", async () => {
  const { r, R, bots, themes } = await room(1);
  const { id, w, mind } = bots[0]!;
  const m = r.map;
  let land: { x: number; y: number } | null = null;
  for (let y = 3; y < m.size - 3 && !land; y++) for (let x = 3; x < m.size - 3 && !land; x++) {
    if (!walkable(m, x + 0.5, y + 0.5)) continue;
    const t = tileAt(m, x + 1, y), t2 = tileAt(m, x + 4, y);
    if ((t === Tile.Water || t === Tile.DeepWater) && (t2 === Tile.Water || t2 === Tile.DeepWater)) land = { x: x + 0.5, y: y + 0.5 };
  }
  w.player.x = land!.x; w.player.y = land!.y;
  w.letters = letters("rod");
  expect(themes(bots[0]!, [], [], 0, "fishing")).toBe("fishing");
  w.letters = letters("boat");
  for (let i = 0; i < 30 && !mind.boat; i++) mind.themedAt = undefined, R.botThemes(id, w, mind, held(w.letters), [], [], 0, false);
  expect(mind.boat).toBeTruthy();
  mind.nextSpell = Infinity;
  for (let i = 0; i < 600 && !w.sailing; i++) { if (i % 5 === 0) R.thinkBot(id, w, mind); r.update(0.1); }
  expect(w.sailing).toBe(true);
  expect(used(mind, "sail")).toBe(1);
  mind.boat.until = 0;
  for (let i = 0; i < 1200 && w.sailing; i++) { if (i % 5 === 0) R.thinkBot(id, w, mind); r.update(0.1); }
  expect(w.sailing).toBe(false);
  expect(mind.boat).toBeUndefined();
});
