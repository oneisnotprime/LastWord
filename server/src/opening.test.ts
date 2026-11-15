import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Fun batch C2: a faster opening (walking, tiring prey), E digs a chest, set explosives go off,
// grand words make an entrance.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
beforeEach(() => { WorldRoom.testSeed = 108; });
afterAll(() => { WorldRoom.testSeed = null; });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const ticks = (room: WorldRoom, n: number) => { for (let i = 0; i < n; i++) room.update(0.1); };
const TYPES = ["hits", "letters", "loadout", "dead", "won", "roundover", "gathered", "gathering", "got", "spelled", "refused", "notice", "sensed", "watching", "described", "missed", "threats", "entrance"];

async function player(letters?: Record<string, number>) {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const c: any = await colyseus.connectTo(room as never);
  const got: [string, any][] = [];
  for (const t of TYPES) c.onMessage(t, (m: any) => got.push([t, m]));
  const r = room as any, walkers = r.walkers as Map<string, any>, w = walkers.get(c.sessionId);
  const city = room.map.cities[0]!;
  w.player.x = city.x + 0.5; w.player.y = city.y + 0.5;
  if (letters) w.letters = { ...letters };
  room.rebuild(w);
  const of = (t: string) => got.filter(([k]) => k === t).map(([, m]) => m);
  return { room, r, c, w, walkers, of };
}

it("people walk at FOOT_PACE times their body's speed; a mount goes at its own", async () => {
  const { r, w } = await player();
  expect(w.speed).toBeCloseTo(5 * 1.6);
  w.gear.push({ spelled: { noun: "horse" }, phrase: "horse", vehicle: true, integrity: null });
  r.rebuild(w);
  expect(w.speed).toBeCloseTo(18);
});

it("a wild animal running flat out tires after a few seconds, and gets its wind back resting", async () => {
  const { room, r, w, walkers } = await player();
  const id = r.addCreature({ spelled: { noun: "deer" }, phrase: "deer", vehicle: false, integrity: null }, "-", w.player.x + 2, w.player.y);
  const deer = walkers.get(id);
  // Kept running from the player tick after tick (its nerve would otherwise steady it).
  const run = (n: number) => { const x0 = deer.player.x; for (let i = 0; i < n; i++) { deer.fleeing = true; deer.target = { x: deer.player.x + 10, y: deer.player.y }; room.update(0.1); } return deer.player.x - x0; };
  const fresh = run(10);
  run(40);
  const tired = run(10);
  expect(deer.winded).toBeGreaterThan(4);
  expect(tired).toBeLessThan(fresh * 0.5);
  expect(tired).toBeLessThan(w.speed / 4); // tiles in a second: slower than a person walks
  deer.fleeing = false; deer.target = null; deer.foe = null;
  ticks(room, 120);
  expect(deer.winded).toBeLessThan(4);
});

it("E with nothing to pick up digs the chest you stand by", async () => {
  const { r, c, w, of } = await player();
  r.deposits.addSite({ id: "c1", x: w.player.x + 1, y: w.player.y, letter: "x", stock: 2, regen: 0, radius: 2.5 });
  c.send("take"); await wait();
  expect(of("gathering").length).toBe(1);
  expect(of("refused").filter((m: string) => /pick up/.test(m))).toEqual([]);
});

it("a BOMB set down goes off after its windup and hits everyone near, its maker too", async () => {
  const { room, r, c, w, walkers } = await player();
  const id = r.addCreature({ spelled: { noun: "ox" }, phrase: "ox", vehicle: false, integrity: null }, "-", w.player.x + 1.5, w.player.y);
  const ox = walkers.get(id);
  r.addThing({ spelled: { noun: "bomb" }, phrase: "bomb", vehicle: false, integrity: null }, c.sessionId, w.player.x + 1, w.player.y);
  expect(r.fuses.size).toBe(1);
  ticks(room, 30);
  expect(r.fuses.size).toBe(1); // not yet: a 5 s windup
  ticks(room, 25);
  expect(r.fuses.size).toBe(0);
  expect([...room.state.things.values()].some((t: any) => t.phrase === "bomb")).toBe(false);
  expect(walkers.has(id) ? ox.hp : 0).toBeLessThan(100);
  expect(w.hp).toBeLessThan(100);
});

it("a grand word makes an entrance on everyone's screen; a small one does not", async () => {
  const { c, of } = await player({ d: 2, r: 2, a: 2, g: 2, o: 2, n: 2, w: 1, l: 1, f: 1 });
  c.send("spell", "wolf"); await wait();
  expect(of("entrance")).toEqual([]);
  c.send("spell", "dragon"); await wait();
  expect(of("entrance").at(-1)).toMatchObject({ word: "DRAGON", kind: "object" });
  expect(of("entrance").at(-1).grandeur).toBeGreaterThanOrEqual(1000);
});
