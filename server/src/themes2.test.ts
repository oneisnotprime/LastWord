import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "described", "sensed", "got"];
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

const grounded = (room: WorldRoom) => [...(room as any).grounded.entries()] as [string, any][];

it("comfort at home: a HOUSE with a BED and a SOFA lifts the morale of its owner standing in it", async () => {
  const { a, wa, second } = await setup();
  const before = wa.unit.body.stats.num("morale");
  a.send("spell", "house"); await wait();
  a.send("spell", "bed"); await wait();
  a.send("spell", "sofa"); await wait();
  second(2);
  expect(wa.home?.ops).toEqual(expect.arrayContaining([["morale", "add", expect.any(Number)]]));
  expect(wa.unit.body.stats.num("morale")).toBeGreaterThan(before + 2);
  wa.player.x += 60; // away from home
  second(2);
  expect(wa.home).toBeNull();
});

it("storage: a VAULT keeps letters from a thief's fine, and at its owner's death holds them for whoever takes it", async () => {
  const { room, a, b, wa, wb, second, last } = await setup();
  a.send("spell", "vault"); await wait();
  second(1);
  expect(wa.stored).toBe(10000);
  wa.letters = { e: 4, q: 1 }; wb.letters = {};
  (room as any).kill(a.sessionId, b.sessionId);
  await wait();
  expect(wb.letters.q ?? 0).toBe(0); // nothing loose to loot: all of it was stored
  const [vid, vault] = grounded(room).find(([, g]) => g.phrase === "vault")!;
  expect(room.state.things.get(vid)!.owner).toBe("");
  expect(vault.hoard).toHaveLength(5);
  wb.player.x = room.state.things.get(vid)!.x; wb.player.y = room.state.things.get(vid)!.y;
  b.send("take", { id: vid }); await wait();
  expect(wb.letters.q).toBe(1);
  expect(wb.letters.e).toBe(4);
  expect(JSON.stringify(last("b", "got"))).toMatch(/VAULT's hoard/);
});

it("a PRISON holds an enemy rooted in its ground ten times longer", async () => {
  const { a, wa, wb, second } = await setup();
  a.send("spell", "prison"); await wait();
  wb.statuses.push({ status: "root", left: 10, from: a.sessionId, origin: a.sessionId });
  wa.statuses.push({ status: "root", left: 10, from: "x", origin: "x" });
  second(5);
  expect(wb.statuses.find((s: any) => s.status === "root")?.left).toBeCloseTo(9.5, 1);
  expect(wa.statuses.find((s: any) => s.status === "root")?.left).toBeCloseTo(5, 1); // its owner is not held
});

it("crafting: IRON at an ANVIL makes a handmade IRON SWORD and uses the iron up", async () => {
  const { room, a, wa, last } = await setup();
  wa.gear = []; room.rebuild(wa);
  a.send("spell", "anvil"); await wait();
  a.send("spell", "iron"); await wait();
  expect(grounded(room).some(([, g]) => g.phrase === "iron"), JSON.stringify(grounded(room).map(([, g]) => g.phrase))).toBe(true);
  a.send("spell", "sword"); await wait();
  expect(String(last("a", "spelled")), String(last("a", "refused"))).toMatch(/handmade at your ANVIL out of your IRON/);
  const sword = [...wa.gear, ...grounded(room).map(([, g]) => g)].find((g: any) => g.spelled.noun === "sword");
  expect(sword.spelled.states).toEqual(["handmade", "iron"]);
  expect(grounded(room).some(([, g]) => g.phrase === "iron")).toBe(false);
});

it("technology: a CAMERA left on the ground shows its ground on its owner's minimap; a CONVEYOR works a WORKBENCH", async () => {
  const { room, a, wa, second, last } = await setup();
  a.send("spell", "camera"); await wait();
  second(2); await wait();
  expect(wa.eyes).toHaveLength(1);
  expect((last("a", "sensed") as any)?.eyes?.[0]?.word).toBe("camera");
  a.send("spell", "workbench"); await wait();
  a.send("spell", "conveyor"); await wait();
  wa.player.x += 40; // its owner walks off: only the machine works it
  second(3);
  const [bid] = grounded(room).find(([, g]) => g.phrase === "workbench")!;
  const p = (room as any).producers.get(bid);
  expect(p.idle).not.toBe("nobody working it");
  expect(p.now.c).toBeGreaterThan(0);
});

it("breeding: three HAMSTERS, fed, have young", async () => {
  const { a, wa, walkers, second } = await setup();
  wa.stores.food = 100;
  a.send("spell", "hamsters"); await wait();
  const count = () => [...walkers.values()].filter((w) => w.master === a.sessionId && w.body.noun === "hamster").length;
  const before = count();
  expect(before).toBe(3);
  second(150);
  expect(count()).toBeGreaterThan(before);
});
