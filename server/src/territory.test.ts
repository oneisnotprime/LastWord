import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { BOSS_TIMES, BOSS_Z, CITIZEN_LEAVE, CITIZENS, HIRED, MARKET, Tile, tileAt, TRANSMUTE_RATIO } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const TYPES = ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "gathering", "got", "hits", "sensed", "described", "offers"];
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 40]));

async function world(people = 1) {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const r = room as any;
  const clients: any[] = [], inbox: [string, any][][] = [];
  for (let i = 0; i < people; i++) {
    const c: any = await colyseus.connectTo(room as never);
    const box: [string, any][] = [];
    for (const t of TYPES) c.onMessage(t, (m: any) => box.push([t, m]));
    clients.push(c); inbox.push(box);
  }
  const me = (i = 0) => r.walkers.get(clients[i].sessionId);
  const of = (i: number, t: string) => inbox[i]!.filter(([k]) => k === t).map(([, m]) => m);
  const minutes = async (n: number) => { for (let i = 0; i < n * 60; i++) room.update(1); await wait(); };
  const got = (i: number, why: RegExp) => of(i, "got").filter((g) => why.test(g.why)).map((g) => g.letters).join("");
  for (let i = 0; i < people; i++) me(i).letters = all();
  return { room, r, clients, me, of, minutes, got };
}

/** A spot of open grass at least `gap` tiles from any city. */
function openGrass(room: WorldRoom, gap = 20) {
  for (let y = 10; y < room.map.size - 10; y += 3) for (let x = 10; x < room.map.size - 10; x += 3) {
    if (tileAt(room.map, x + 0.5, y + 0.5) !== Tile.Grass) continue;
    if (room.map.cities.every((c) => Math.hypot(c.x - x, c.y - y) > c.radius + gap)) return { x: x + 0.5, y: y + 0.5 };
  }
  throw new Error("no grass");
}

it("a claim holds land that pays L; where two people's claims meet the ground is contested", async () => {
  const { room, r, clients, me, minutes, got } = await world(2);
  const at = openGrass(room);
  Object.assign(me(0).player, at);
  clients[0].send("spell", "hedge"); await wait();
  await minutes(6);
  expect(got(0, /^LAND$/)).toMatch(/^l+$/);
  const line = () => (r.income.get(clients[0].sessionId).lines as string[]).find((l) => l.startsWith("LAND"))!;
  expect(line()).toMatch(/^LAND: \d+ tiles: L /);
  Object.assign(me(1).player, { x: at.x + 6, y: at.y });
  clients[1].send("spell", "hedge"); await wait();
  await minutes(0.2);
  expect(line()).toMatch(/\d+ contested/);
});

it("a LANE lays a run of road the way you face, which pays R and wears out", async () => {
  const { room, r, clients, me, minutes, got } = await world();
  const at = openGrass(room, 30);
  Object.assign(me().player, at);
  me().facing = { x: 1, y: 0 };
  clients[0].send("spell", "lane"); await wait();
  expect(tileAt(room.map, at.x + 8, at.y)).toBe(Tile.Road);
  expect(tileAt(room.map, at.x, at.y + 4)).not.toBe(Tile.Road);
  expect(room.state.edits.at(-1)!.x2).toBeGreaterThan(at.x + 10);
  await minutes(3);
  expect(got(0, /^ROADS$/)).toMatch(/^r+$/);
  const rate = () => r.income.get(clients[0].sessionId).letters.find((l: any) => l.letter === "r").rate;
  const early = rate();
  await minutes(12);
  expect(rate()).toBeLessThan(early * 0.6);
});

it("claiming a city's middle rules it: its citizens pay S, and leave one by one; CONQUEST takes it from its ruler", async () => {
  const { room, r, clients, me, minutes, got, of } = await world(2);
  const city = room.map.cities[0]!;
  expect(room.state.cities[0]!.citizens).toBe(CITIZENS);
  Object.assign(me(0).player, { x: city.x + 0.5, y: city.y + 0.5 });
  clients[0].send("spell", "flag"); await wait();
  await minutes(0.2);
  expect(room.state.cities[0]!.ruler).toBe(me(0).player.name);
  expect(of(1, "notice").some((n: string) => /claims a city/.test(n))).toBe(true);
  await minutes(3);
  expect(got(0, /^CITY$/)).toMatch(/^s+$/);
  await minutes(CITIZEN_LEAVE / 60);
  expect(room.state.cities[0]!.citizens).toBeLessThan(CITIZENS);
  Object.assign(me(1).player, { x: city.x + 1.5, y: city.y + 0.5 });
  clients[1].send("spell", "conquest"); await wait();
  expect(room.state.cities[0]!.ruler).toBe(me(1).player.name);
  void r;
});

it("hiring at a market takes a citizen into your service as a worker, who goes to work your KILN", async () => {
  const { room, r, clients, me, minutes, got } = await world();
  const [mid, market] = [...room.state.things].find(([, t]) => t.fixture === "market")!;
  const city = r.cityAt(market);
  Object.assign(me().player, { x: market.x + 1, y: market.y });
  room.update(1); await wait();
  const before = r.citizensOf(city).length;
  clients[0].send("hire", {}); await wait();
  expect(r.citizensOf(city).length).toBe(before - 1);
  const worker = [...r.walkers.values()].find((w: any) => w.master === clients[0].sessionId);
  expect(worker.player.name).toBe(HIRED);
  // A kiln a little way off: its owner walks away, and the worker keeps it going.
  Object.assign(me().player, { x: market.x + 5, y: market.y + 3 });
  clients[0].send("spell", "kiln"); await wait();
  Object.assign(me().player, { x: market.x + 30, y: market.y });
  for (let i = 0; i < 300; i++) room.update(0.1);
  expect(worker.job).toBe([...room.state.things].find(([, t]) => t.phrase === "kiln")![0]);
  await minutes(3);
  expect(got(0, /^KILN$/)).toMatch(/c/);
  expect(got(0, new RegExp(`^${HIRED.toUpperCase()}$`))).toMatch(/n/);
  void mid;
});

it("the market panel trades; players offer, counter, accept or decline, and a trade pays each a T", async () => {
  const { room, r, clients, me, of } = await world(2);
  const [, market] = [...room.state.things].find(([, t]) => t.fixture === "market")!;
  Object.assign(me(0).player, { x: market.x + 1, y: market.y });
  room.update(1);
  me(0).letters = { e: 30 };
  clients[0].send("market", { give: "e".repeat(MARKET.ratio), get: "a" }); await wait();
  expect(me(0).letters).toMatchObject({ a: 1, t: 1 });
  room.update(1); await wait();
  expect(of(0, "loadout").at(-1).market.ratio).toBe(MARKET.ratio);
  // Offers between two people close together.
  Object.assign(me(1).player, { x: market.x + 2, y: market.y });
  me(0).letters = { e: 5 }; me(1).letters = { a: 2 };
  clients[0].send("offer", { to: clients[1].sessionId, give: "ee", get: "a" }); await wait();
  const offer = of(1, "offers").at(-1)[0];
  expect(offer).toMatchObject({ give: "ee", get: "a", mine: false });
  clients[1].send("answer", { id: offer.id, accept: true }); await wait();
  expect(me(0).letters).toMatchObject({ e: 3, a: 1, t: 1 });
  expect(me(1).letters).toMatchObject({ e: 2, a: 1, t: 1 });
  // A counter is a new offer the other way; declining ends it.
  clients[1].send("spell", `offer ${me(0).player.name} a for eee`); await wait();
  const counter = of(0, "offers").at(-1)[0];
  expect(counter).toMatchObject({ give: "a", get: "eee", mine: false });
  clients[0].send("answer", { id: counter.id, accept: false }); await wait();
  expect(of(0, "offers").at(-1)).toEqual([]);
  expect(me(1).letters.a).toBe(1);
  void r;
});

it("transmuting ten common letters makes a Z; a roaming boss rises and drops Z when slain", async () => {
  const { room, r, clients, me, of, got } = await world();
  me().letters = { e: 12, q: 3 };
  clients[0].send("spell", `transmute ${"e".repeat(TRANSMUTE_RATIO)}`); await wait();
  expect(me().letters.z).toBe(1);
  clients[0].send("transmute", { give: "qqq" + "e".repeat(TRANSMUTE_RATIO - 3) }); await wait();
  expect(of(0, "refused").at(-1)).toMatch(/Only common letters/);
  while (r.elapsed < BOSS_TIMES[0]) room.update(1);
  room.update(1); await wait();
  const [bossId, boss] = [...r.walkers].find(([, w]: any) => w.boss)!;
  expect(room.state.players.get(bossId)!.boss).toBe(true);
  expect(of(0, "notice").some((n: string) => /rises in the/.test(n))).toBe(true);
  boss.unit.body.integrity = 0;
  r.kill(bossId, clients[0].sessionId); await wait();
  expect(got(0, /^slew /)).toBe("z".repeat(BOSS_Z));
  expect(of(0, "got").some((g: any) => /hoard/.test(g.why))).toBe(true);
});
