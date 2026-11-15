import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { CHEST_X, exploredSight, MAP_SOURCES, MARKET, REGION_TILES, SPAWN_APART, STARTING_HAND } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["got", "letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "described"];

async function setup(bots = 0) {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", { bots })) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const inbox: [string, unknown][] = [];
  for (const t of MESSAGES) a.onMessage(t, (m: unknown) => inbox.push([t, m]));
  const walkers = (room as any).walkers as Map<string, any>;
  const grounded = (room as any).grounded as Map<string, any>;
  const fixtures = (kind: string) => [...grounded].filter(([, g]) => g.fixture === kind).map(([id]) => [id, room.state.things.get(id)!] as const);
  return { room, a, inbox, walkers, me: walkers.get(a.sessionId), fixtures };
}
const second = (room: WorldRoom, n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
const total = (letters: Record<string, number>) => Object.values(letters).reduce((n, v) => n + v, 0);

it("a map has a market in every city, one temple, chests, broken ruins and wild animals", async () => {
  const { room, walkers, fixtures } = await setup();
  expect(fixtures("market")).toHaveLength(room.map.cities.length);
  expect(fixtures("temple")).toHaveLength(1);
  expect(fixtures("chest")).toHaveLength(MAP_SOURCES.chests);
  expect(fixtures("ruin")).toHaveLength(MAP_SOURCES.ruins);
  expect(fixtures("ruin")[0]![1].hp).toBeLessThan(100);
  const wild = [...walkers.values()].filter((w) => w.master === "-");
  expect(wild.length).toBeGreaterThan(MAP_SOURCES.animals * 0.8);
});

it("people start with eight letters, far apart, and no free SWORD", async () => {
  const { room, walkers } = await setup(7);
  const people = [...walkers.values()].filter((w) => w.master === null);
  expect(people).toHaveLength(8);
  for (const p of people) expect(total(p.letters)).toBe(STARTING_HAND);
  let closest = Infinity;
  for (const p of people) for (const q of people) if (p !== q) closest = Math.min(closest, Math.hypot(p.player.x - q.player.x, p.player.y - q.player.y));
  expect(closest).toBeGreaterThan(SPAWN_APART * 0.6);
  void room;
});

it("digging beside a chest gives X until it is gone; the temple gives Q", async () => {
  const { room, a, me, fixtures, inbox } = await setup();
  const [cid, chest] = fixtures("chest")[0]!;
  me.player.x = chest.x + 1; me.player.y = chest.y;
  me.letters = {};
  (room as any).rng = () => 0; // every dig finds it
  for (let i = 0; i < CHEST_X; i++) { a.send("gather"); await wait(); second(room, 2.1); }
  expect(me.letters.x).toBe(CHEST_X);
  expect(room.state.things.has(cid)).toBe(false);
  const [, temple] = fixtures("temple")[0]!;
  me.player.x = temple.x + 1; me.player.y = temple.y;
  a.send("gather"); await wait(); second(room, 2.1);
  expect(me.letters.q).toBe(1);
  await wait();
  expect(inbox.some(([t, m]) => t === "gathered" && m === "q")).toBe(true);
});

it("a market trades any four letters you choose for one, pays a T, and runs short", async () => {
  const { room, a, me, fixtures, inbox } = await setup();
  const [, market] = fixtures("market")[0]!;
  me.player.x = market.x + 1; me.player.y = market.y;
  me.letters = { e: 40, b: 1, k: 1, q: 1 };
  a.send("spell", "trade bkqe for a"); await wait();
  expect(me.letters).toMatchObject({ e: 39, b: 0, k: 0, q: 0, a: 1, t: 1 });
  expect(inbox.some(([t, m]) => t === "spelled" && /Traded BKQE for A/.test(String(m)))).toBe(true);
  a.send("market", { give: "eeee", get: "u" }); await wait();
  expect(me.letters).toMatchObject({ e: 35, u: 1, t: 2 });
  a.send("spell", "trade eee for a"); await wait();
  a.send("spell", "trade eeee for z"); await wait();
  const refusals = inbox.filter(([t]) => t === "refused").map(([, m]) => String(m));
  expect(refusals[0]).toMatch(/4 letters for each/);
  expect(refusals[1]).toMatch(/No market sells Z/);
  for (let i = 2; i < MARKET.stock; i++) { a.send("spell", "trade eeee for o"); await wait(30); }
  await wait();
  expect(me.letters.o).toBe(MARKET.stock - 2);
  a.send("spell", "trade eeee for o"); await wait();
  expect(String(inbox.filter(([t]) => t === "refused").at(-1)![1])).toMatch(/traded all it can/);
  me.player.x += 30;
  a.send("spell", "trade eeee for o"); await wait();
  expect(String(inbox.filter(([t]) => t === "refused").at(-1)![1])).toMatch(/Trade at a MARKET/);
});

it("a market swaps your whole rack for as many random letters, once per market", async () => {
  const { room, a, me, fixtures, inbox } = await setup();
  const markets = fixtures("market");
  const [, market] = markets[0]!;
  me.player.x = market.x + 1; me.player.y = market.y;
  second(room, 0.2); // a J for walking into the market's region, first
  me.letters = { z: 2, e: 5, q: 1 };
  a.send("swap"); await wait();
  expect(total(me.letters)).toBe(8);
  const got = inbox.filter(([t]) => t === "got").map(([, m]) => m as { letters: string; why: string });
  expect(got.at(-1)).toMatchObject({ why: "swap" });
  expect(got.at(-1)!.letters).toHaveLength(8);
  expect(got.at(-1)!.letters).not.toMatch(/[jqxz]/);
  a.send("spell", "swap"); await wait();
  expect(String(inbox.filter(([t]) => t === "refused").at(-1)![1])).toMatch(/once/);
  if (markets.length > 1) {
    const [, other] = markets[1]!;
    me.player.x = other.x + 1; me.player.y = other.y;
    a.send("spell", "swap"); await wait();
    expect(inbox.filter(([t, m]) => t === "got" && (m as { why: string }).why === "swap")).toHaveLength(2);
  }
  void room;
});

it("a chest pays exactly the letters its popups list: every one, into the rack", async () => {
  const { room, a, me, fixtures, inbox } = await setup();
  const [cid, chest] = fixtures("chest")[0]!;
  me.player.x = chest.x + 1; me.player.y = chest.y;
  me.letters = { a: 1 };
  const before = { ...me.letters };
  // Varied rolls so the prize is not one letter over and over; the dig is retried until the chest is gone.
  const seq = [0.01, 0.42, 0.77, 0.13, 0.95, 0.58, 0.29];
  let i = 0;
  (room as any).rng = () => seq[i++ % seq.length]!;
  const start = inbox.length;
  for (let n = 0; n < 30 && room.state.things.has(cid); n++) { a.send("gather"); await wait(40); second(room, 2.1); }
  await wait();
  expect(room.state.things.has(cid)).toBe(false);
  const got = inbox.slice(start).filter(([t]) => t === "got").map(([, m]) => m as { letters: string; why: string });
  const chestGot = got.filter((g) => g.why === "chest");
  // The X and the prize arrive together, one letter each, in a single message.
  expect(chestGot).toHaveLength(1);
  expect(chestGot[0]!.letters).toMatch(/^x[a-z]{3}$/);
  const delta: string[] = [];
  for (const [ch, n] of Object.entries(me.letters as Record<string, number>)) for (let k = (before as Record<string, number>)[ch] ?? 0; k < n; k++) delta.push(ch);
  expect(got.map((g) => g.letters).join("").split("").sort()).toEqual(delta.sort());
  // And the rack the client is sent is the server's.
  const last = inbox.filter(([t]) => t === "letters").at(-1)![1] as Record<string, number>;
  expect(Object.fromEntries(Object.entries(last).filter(([, n]) => n > 0))).toEqual(Object.fromEntries(Object.entries(me.letters as Record<string, number>).filter(([, n]) => n > 0)));
});

it("hunting a wild animal gives H; breaking a ruin gives D and X; a new region gives J and more sight", async () => {
  const { room, a, me, walkers, fixtures, inbox } = await setup();
  me.letters = {};
  me.hp = 1e6; room.rebuild(me);
  // An unarmoured one (bare fists do not get through a CRAB's shell) whose name has no H of its own.
  const [pid, prey] = [...walkers].find(([, w]) => w.master === "-" && !(w.unit.body.stats.num("armor") > 0) && !w.player.name.includes("h"))!;
  me.player.x = prey.player.x + 0.5; me.player.y = prey.player.y;
  prey.hp = 1; prey.unit.body.integrity = 1;
  a.send("attack", pid); await wait();
  second(room, 3);
  expect(walkers.has(pid)).toBe(false);
  expect(me.letters.h).toBe(1);
  expect(me.letters.k ?? 0).toBe(0);
  const [rid, ruin] = fixtures("ruin")[0]!;
  me.player.x = ruin.x + 0.5; me.player.y = ruin.y;
  (room as any).grounded.get(rid).integrity = 1;
  // Whether a ruin holds an X is a roll; every roll lands here (citizens and animals also draw on these numbers).
  (room as any).rng = () => 0;
  a.send("attack", rid); await wait();
  second(room, 3);
  expect(room.state.things.has(rid)).toBe(false);
  expect(me.letters).toMatchObject({ d: 1, x: 1 });
  const j = me.letters.j ?? 0;
  const sight = me.sight, regions = me.explored.size;
  me.player.x = (me.player.x + REGION_TILES) % room.map.size;
  second(room, 0.2);
  me.player.x = (me.player.x + REGION_TILES) % room.map.size;
  second(room, 0.2);
  expect(me.letters.j).toBeGreaterThanOrEqual(j + 1);
  // Exploring widens sight (shared exploredSight), said on the J's popup.
  expect(me.explored.size).toBeGreaterThan(regions);
  expect(me.sight).toBeCloseTo(sight * exploredSight(me.explored.size) / exploredSight(regions));
  await wait();
  expect(inbox.some(([t, m]) => t === "got" && (m as { detail?: string }).detail === "first here · +sight")).toBe(true);
});

it("markets, the temple and chests cannot be attacked or picked up", async () => {
  const { a, me, fixtures, inbox } = await setup();
  const [mid, market] = fixtures("market")[0]!;
  me.player.x = market.x; me.player.y = market.y;
  a.send("attack", mid); await wait();
  expect(me.foe).toBeNull();
  a.send("take"); await wait();
  expect(inbox.some(([t]) => t === "refused")).toBe(true);
});

it("a GHOST, a ZOMBIE and a ROBOT follow their maker and fight for them; the ROBOT comes with power", async () => {
  const { room, a, me, walkers } = await setup();
  me.letters = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 20]));
  for (const w of ["ghost", "zombie", "robot"]) { a.send("spell", w); await wait(); }
  const mine = [...walkers.values()].filter((w) => w.master === a.sessionId).map((w) => w.player.name).sort();
  expect(mine).toEqual(["ghost", "robot", "zombie"]);
  expect(me.stores.power).toBeGreaterThan(0);
  second(room, 2);
  expect(me.upkeep.short).toEqual([]);
});
