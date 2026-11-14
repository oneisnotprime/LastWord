import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { regionOf } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "described", "sensed"];
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));

/** Two people side by side in a city, with every letter, too tough to die. */
async function setup() {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, unknown][]> = { a: [], b: [] };
  for (const t of MESSAGES) { a.onMessage(t, (m: unknown) => inbox.a!.push([t, m])); b.onMessage(t, (m: unknown) => inbox.b!.push([t, m])); }
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 1.5; wb.player.y = c.y + 0.5;
  const last = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).at(-1)?.[1];
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  return { room, a, b, wa, wb, walkers, last, second, inbox };
}

const things = (room: WorldRoom) => [...room.state.things.values()];

it("cooking and rotting: DOUGH by an OVEN bakes into BREAD; a carried STEAK cooks on a cook who BAKEs; meat left out rots", async () => {
  const { room, a, wa, last, second } = await setup();
  a.send("spell", "oven"); await wait();
  a.send("spell", "dough"); await wait();
  second(10);
  expect(things(room).some((t) => t.phrase === "bread"), JSON.stringify(things(room).map((t) => t.phrase))).toBe(true);
  wa.gear = [];
  wa.player.x += 20;
  room.rebuild(wa);
  a.send("spell", "steak"); await wait();
  a.send("take"); await wait();
  a.send("spell", "bake"); await wait();
  second(10);
  const carried = [...wa.gear, ...[...(room as any).grounded.values()]].map((g: any) => g.phrase);
  expect(carried.some((p: string) => p === "cooked steak"), JSON.stringify(carried) + String(last("a", "refused"))).toBe(true);
  a.send("spell", "bacon"); await wait();
  (room as any).elapsed += 11 * 60;
  second(2);
  expect(things(room).some((t) => t.phrase === "rotten bacon"), JSON.stringify(things(room).map((t) => t.phrase))).toBe(true);
});

it("eating HEMLOCK poisons you", async () => {
  const { a, wa, last } = await setup();
  a.send("spell", "hemlock"); await wait();
  a.send("use"); await wait();
  expect(String(last("a", "spelled") ?? last("a", "notice"))).toMatch(/poisoned for 60 s/);
  expect(wa.statuses.some((s: any) => s.status === "poison")).toBe(true);
});

it("a PENALTY fines whoever attacks inside it, paid to its maker", async () => {
  const { room, a, b, wa, wb, second, last } = await setup();
  a.send("spell", "penalty"); await wait();
  wa.letters = { e: 3 }; wb.letters = { e: 20, z: 1 };
  b.send("attack", a.sessionId); await wait();
  second(1);
  expect(wb.letters.e).toBe(12);
  expect(wb.letters.z).toBe(1);
  expect(wa.letters.e).toBe(11);
  expect(String(last("b", "notice"))).toMatch(/PENALTY: fined/);
  // Without the letters to pay, the law stands.
  wb.letters = { e: 2 };
  (room as any).fined.clear();
  second(1);
  await wait();
  expect(wb.foe).toBeNull();
  expect(String(last("b", "refused"))).toMatch(/PENALTY/);
});

it("an ALLIANCE puts two people on one side; attacking an ally breaks it and costs letters", async () => {
  const { room, a, b, wa, wb, second, last } = await setup();
  a.send("pick", { id: b.sessionId }); await wait();
  a.send("spell", "alliance"); await wait();
  expect(String(last("a", "spelled"))).toMatch(/binds/);
  const side = (id: string, w: any) => (room as any).side(id, w);
  expect(side(a.sessionId, wa)).toBe(side(b.sessionId, wb));
  wa.letters = { e: 10 }; wb.letters = {};
  a.send("attack", b.sessionId); await wait();
  expect(side(a.sessionId, wa)).not.toBe(side(b.sessionId, wb));
  expect(wa.letters.e).toBe(4);
  expect(wb.letters.e).toBe(6);
  expect(String(last("b", "notice"))).toMatch(/broke the ALLIANCE/);
  second(1);
});

it("a SCOUT ranges ahead and new ground it reaches pays its master J; a MASON makes structures sturdier", async () => {
  const { room, a, wa, walkers, second } = await setup();
  a.send("spell", "scout"); await wait();
  const scout = [...walkers.values()].find((w) => w.player.name === "scout")!;
  const before = wa.letters.j;
  scout.player.x = wa.player.x + 40; scout.player.y = wa.player.y;
  expect(wa.explored.has(regionOf(scout.player.x, scout.player.y))).toBe(false);
  second(1);
  expect(wa.letters.j).toBe(before + 1);
  second(1);
  expect(scout.target).not.toBeNull(); // off toward ground its master has not seen
  a.send("spell", "mason"); await wait();
  a.send("spell", "wall"); await wait();
  const wall = [...(room as any).grounded.values()].find((g: any) => g.phrase === "wall");
  expect(wall.built).toBe(2.5);
});
