import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { Tile, tileAt, walkable } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "described", "sensed", "got", "threats", "hits"];
const all = (n = 99) => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, n]));
const count = (letters: Record<string, number>) => Object.values(letters).reduce((a, n) => a + n, 0);

/** Two people side by side in a city, with every letter. */
async function setup(tough = true) {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, unknown][]> = { a: [], b: [] };
  for (const t of MESSAGES) { a.onMessage(t, (m: unknown) => inbox.a!.push([t, m])); b.onMessage(t, (m: unknown) => inbox.b!.push([t, m])); }
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); if (tough) w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 1.5; wb.player.y = c.y + 0.5;
  const said = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m);
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const thing = (phrase: string) => [...(room as any).grounded.entries()].find(([, g]: [string, any]) => g.phrase === phrase) as [string, any] | undefined;
  const on = async (who: any, target: string, word: string) => { who.send("pick", { id: target }); who.send("spell", word); who.send("pick", null); await wait(); };
  return { room, a, b, wa, wb, walkers, said, second, thing, on };
}

/** A walkable tile beside water (a shore) on the room's map, and the water tile next to it. */
function shore(room: WorldRoom): { land: { x: number; y: number }; water: { x: number; y: number } } {
  const m = room.map;
  for (let y = 2; y < m.size - 2; y++) for (let x = 2; x < m.size - 2; x++) {
    if (!walkable(m, x + 0.5, y + 0.5)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const t = tileAt(m, x + dx, y + dy), t2 = tileAt(m, x + 2 * dx, y + 2 * dy);
      if ((t === Tile.Water || t === Tile.DeepWater) && (t2 === Tile.Water || t2 === Tile.DeepWater)) return { land: { x: x + 0.5, y: y + 0.5 }, water: { x: x + dx * 2 + 0.5, y: y + dy * 2 + 0.5 } };
    }
  }
  throw new Error("no shore");
}

it("time: HASTE doubles a side's speed; STASIS freezes B, who cannot be struck; REWIND undoes the last harm; CENTURY ages a thing", async () => {
  const { a, b, wa, wb, said, second, thing, on, room } = await setup(false);
  const speed = wa.speed;
  a.send("spell", "haste"); await wait(); second(1);
  expect(wa.statuses.some((s: any) => s.status === "haste")).toBe(true);
  expect(wa.speed).toBeCloseTo(speed * 2, 1);
  await on(a, b.sessionId, "timeout");
  expect(wb.statuses.some((s: any) => s.status === "stasis")).toBe(true);
  expect(wb.hamper.untouchable).toBe(true);
  b.send("spell", "rock"); await wait();
  expect(said("b", "refused").at(-1)).toMatch(/cannot spell while you are out of time/);
  wa.foe = b.sessionId; const hp = wb.hp; second(2);
  expect(wb.hp).toBe(hp);
  // REWIND: what A lost in the last seconds comes back.
  const full = wa.hp; second(2); wa.hp = full / 2; room.rebuild(wa); second(1);
  a.send("spell", "rewind"); await wait();
  expect(said("a", "spelled").at(-1)).toMatch(/harm undone/);
  expect(wa.hp).toBe(full);
  // CENTURY on A's chair: it counts as made 6000 minutes ago.
  a.send("spell", "chair"); await wait();
  const [cid, chair] = thing("chair")!;
  const born = chair.born;
  await on(a, cid, "century");
  expect(chair.born).toBeLessThanOrEqual(born - 6000 * 60 + 1);
});

it("space: GRAVITY grounds B's wings; LEVITATION floats A; a SINGULARITY pulls B in; a BOMBARDMENT's impacts strike", async () => {
  const { a, b, wa, wb, second, on, room } = await setup();
  await on(b, b.sessionId, "wings"); second(1);
  expect(wb.flying).toBe(true);
  a.send("pick", { x: wb.player.x, y: wb.player.y }); a.send("spell", "gravity"); a.send("pick", null); await wait(); second(2);
  expect(wb.gravity).toBeGreaterThanOrEqual(3);
  expect(wb.flying).toBe(false);
  a.send("spell", "levitation"); await wait(); second(2);
  expect(wa.gravity).toBeLessThan(0.3);
  expect(wa.flying).toBe(true);
  // A singularity a few tiles off pulls B toward its middle.
  const mid = { x: wb.player.x + 5, y: wb.player.y };
  const before = Math.hypot(wb.player.x - mid.x, wb.player.y - mid.y);
  a.send("pick", mid); a.send("spell", "singularity"); a.send("pick", null); await wait(); second(2);
  expect(Math.hypot(wb.player.x - mid.x, wb.player.y - mid.y)).toBeLessThan(before - 1);
  const hits = (room as any).hits.length;
  const hp = wb.hp;
  a.send("pick", { x: wb.player.x, y: wb.player.y }); a.send("spell", "bombardment"); a.send("pick", null); await wait(); second(5);
  expect(wb.hp).toBeLessThan(hp);
  void hits;
});

it("sea: a BOAT is launched on the water, boarded from the shore and sails only on water; R puts you ashore; waves wreck it", async () => {
  const { a, wa, said, second, thing, room } = await setup();
  const { land, water } = shore(room);
  wa.player.x = land.x; wa.player.y = land.y;
  a.send("spell", "boat"); await wait();
  expect(said("a", "spelled").at(-1)).toMatch(/launched on the water/);
  const [bid, boat] = thing("boat")!;
  const t = room.state.things.get(bid)!;
  expect(walkable(room.map, t.x, t.y)).toBe(false); // it floats
  void boat;
  a.send("take", { id: bid }); await wait();
  expect(wa.sailing).toBe(true);
  expect(walkable(room.map, wa.player.x, wa.player.y)).toBe(false);
  // Told to walk inland, it stays on the water.
  a.send("move", { x: land.x, y: land.y }); second(3);
  expect(walkable(room.map, wa.player.x, wa.player.y)).toBe(false);
  // Waves: a MAELSTROM on the boat wrecks it and throws A ashore.
  a.send("pick", { x: wa.player.x, y: wa.player.y }); a.send("spell", "maelstrom"); a.send("pick", null); await wait(); second(6);
  expect(wa.gear.some((g: any) => g.vehicle)).toBe(false);
  expect(walkable(room.map, wa.player.x, wa.player.y)).toBe(true);
  void water;
});

it("sea: R off a boat by the shore leaves it moored; a PORT is a market whose owner takes a toll; fishing with a ROD lands a catch", async () => {
  const { a, b, wa, wb, said, second, thing, room } = await setup();
  const { land } = shore(room);
  wa.player.x = land.x; wa.player.y = land.y;
  a.send("spell", "rowboat"); await wait();
  const [bid] = thing("rowboat")!;
  a.send("take", { id: bid }); await wait();
  expect(wa.sailing).toBe(true);
  a.send("dismount"); await wait();
  expect(wa.sailing).toBe(false);
  expect(walkable(room.map, wa.player.x, wa.player.y)).toBe(true);
  expect(thing("rowboat")).toBeTruthy();
  // A port of A's: B trades at it, A gets a T toll.
  a.send("spell", "port"); await wait();
  const [pid] = thing("port")!;
  const p = room.state.things.get(pid)!;
  wb.player.x = p.x; wb.player.y = p.y;
  const t = wa.letters.t;
  b.send("spell", "trade eee for o"); await wait(); second(1);
  expect(said("b", "spelled").join(" ")).toMatch(/Traded EEE for O/);
  expect(wa.letters.t).toBeGreaterThan(t);
  // Fishing with a rod: a catch's first letter comes with the O.
  wa.player.x = land.x; wa.player.y = land.y;
  a.send("spell", "rod"); await wait();
  (room as any).deposits.gather = () => ({ letter: "o", from: "fish" }); // a bite every time
  (room as any).deposits.problem = () => null;
  const got = said("a", "got").length;
  a.send("gather"); await wait();
  second(4); await wait();
  expect(said("a", "got").slice(got).some((g: any) => /caught [A-Z]+/.test(g.why))).toBe(true);
});

it("sports: a DUEL stakes letters; blows inside cannot kill and the winner takes the pot; FORFEIT gives it up; FOUL voids it", async () => {
  const { a, b, wa, wb, said, second, on, room } = await setup(false);
  const [ta, tb] = [count(wa.letters), count(wb.letters)];
  await on(a, b.sessionId, "duel");
  expect(said("a", "spelled").at(-1)).toMatch(/DUEL with .*20 letters in the pot/);
  expect(Math.abs(count(wa.letters) - (ta - 10 - "duel".length))).toBeLessThanOrEqual(2); // a J or Y may come in meanwhile
  expect(Math.abs(count(wb.letters) - (tb - 10))).toBeLessThanOrEqual(2);
  // A knocks B down: B is left standing, A takes the pot.
  const before = count(wa.letters);
  (room as any).kill(b.sessionId, a.sessionId); await wait();
  expect(room.state.players.has(b.sessionId)).toBe(true);
  expect(wb.hp).toBeGreaterThan(0);
  expect(count(wa.letters) - before).toBeGreaterThanOrEqual(20);
  expect((room as any).challenges.size).toBe(0);
  // Another: B forfeits, A wins.
  await on(a, b.sessionId, "wager");
  const mid = count(wa.letters);
  b.send("spell", "forfeit"); await wait();
  expect(count(wa.letters) - mid).toBeGreaterThanOrEqual(40);
  // A third, voided by a FOUL: stakes back.
  await on(a, b.sessionId, "bet");
  const [ra, rb] = [count(wa.letters), count(wb.letters)];
  await on(b, a.sessionId, "foul"); second(2);
  expect((room as any).challenges.size).toBe(0);
  expect(count(wa.letters) - ra).toBeGreaterThanOrEqual(6);
  expect(count(wb.letters) - rb).toBeGreaterThanOrEqual(6 - "foul".length);
  void ta; void tb;
});

it("sports: a GAVEL gives a truce once: untouchable and harmless; PROVOCATION ends it", async () => {
  const { a, b, wa, wb, said, second, on } = await setup();
  a.send("spell", "gavel"); await wait();
  expect(wa.statuses.some((s: any) => s.status === "truce")).toBe(true);
  wb.foe = a.sessionId; const hp = wa.hp; second(2);
  expect(wa.hp).toBe(hp);
  a.send("spell", "rock"); await wait();
  expect(said("a", "refused").at(-1)).toMatch(/under a truce/);
  await on(b, a.sessionId, "provocation");
  expect(wa.statuses.some((s: any) => s.status === "truce")).toBe(false);
  // Put down and taken again, the same gavel gives no second truce.
  a.send("drop"); await wait(); a.send("take"); await wait();
  expect(wa.statuses.some((s: any) => s.status === "truce")).toBe(false);
});

it("ideas: NOTHING voids B's gear; FATE dooms B; CHAOS scrambles; PARADOX swaps owners; a TYPO turns a thing into another word", async () => {
  const { a, b, wa, wb, second, thing, on, room } = await setup(false);
  b.send("spell", "sword"); await wait();
  expect(wb.unit.attack.num("dmg_slash")).toBeGreaterThan(0);
  await on(a, b.sessionId, "nothing"); second(1);
  expect(wb.hamper.nulled).toBe(true);
  expect(wb.unit.attack.num("dmg_slash")).toBe(0);
  await on(a, b.sessionId, "existence");
  b.send("spell", "existence"); await wait(); second(1);
  expect(wb.hamper.nulled).toBe(false);
  // FATE: when it runs out, three quarters of B's full health.
  await on(a, b.sessionId, "fate");
  const full = wb.unit.body.stats.num("integrity");
  wb.hp = full; room.rebuild(wb);
  wb.statuses.find((s: any) => s.status === "doom").left = 0.5; second(1);
  expect(wb.hp).toBeLessThanOrEqual(full * 0.26);
  // CHAOS draws random changes.
  a.send("pick", { x: wb.player.x, y: wb.player.y }); a.send("spell", "chaos"); a.send("pick", null); await wait(); second(2);
  expect(wb.statuses.find((s: any) => s.status === "chaos")?.ops?.length).toBeGreaterThan(0);
  // PARADOX: B's chest is A's, A's statue is B's.
  wb.hp = 1e9; wa.hp = 1e9;
  b.send("spell", "barrel"); a.send("spell", "statue"); await wait();
  const [chest] = thing("barrel")!, [statue] = thing("statue")!;
  await on(a, chest, "paradox");
  expect(room.state.things.get(chest)!.owner).toBe(a.sessionId);
  expect(room.state.things.get(statue)!.owner).toBe(b.sessionId);
  // A TYPO on A's cat turns it into a word one letter off (or breaks it).
  a.send("spell", "chair"); await wait();
  const [cid] = thing("chair")!;
  await on(a, cid, "typo");
  expect(room.state.things.has(cid)).toBe(false);
});
