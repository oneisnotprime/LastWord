import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { roomAround, stampTerrain, Tile, tileAt, walkable } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const ticks = (room: WorldRoom, n: number) => { for (let i = 0; i < n; i++) room.update(0.1); };
const TYPES = ["hits", "letters", "loadout", "dead", "won", "roundover", "gathered", "gathering", "got", "spelled", "refused", "notice", "sensed", "watching", "described"];

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
  return { room, r, c, w, walkers, city, got, of };
}

it("a player steering along a corner the old line test missed keeps moving instead of freezing", async () => {
  const { room, r, c, w } = await player();
  // Water on one tile just off a straight line: the case from the playtest (a car going west by a shore).
  const at = { x: Math.floor(w.player.x) + 0.79, y: Math.floor(w.player.y) + 0.75 };
  w.player.x = at.x; w.player.y = at.y;
  room.map.tiles[(Math.floor(at.y) + 1) * room.map.size + Math.floor(at.x)] = Tile.Water;
  const start = { ...at };
  for (let i = 0; i < 30; i++) { r.messages.move({ sessionId: c.sessionId }, { x: w.player.x - 2.83, y: w.player.y + 1.01 }); room.update(0.1); }
  expect(Math.hypot(w.player.x - start.x, w.player.y - start.y)).toBeGreaterThan(1);
  expect(walkable(room.map, w.player.x, w.player.y)).toBe(true);
});

it("land laid around someone never boxes them into a pocket they cannot step out of", async () => {
  const { room, r, w } = await player();
  const x = Math.floor(w.player.x), y = Math.floor(w.player.y);
  // A ring of pit round the player's tile: the nearest walkable ground would be the tile itself.
  stampTerrain(room.map, { x: x + 0.5, y: y + 0.5, radius: 3, tile: Tile.Pit });
  room.map.tiles[y * room.map.size + x] = Tile.Grass;
  r.reshape(x + 0.5, y + 0.5, 0.4, Tile.Grass);
  expect(roomAround(room.map, w.player)).toBeGreaterThanOrEqual(24);
});

it("gathering where nothing is left says so at once; a gather tells the client how long it takes, and the letter says why", async () => {
  const { room, c, w, of } = await player();
  // Out in the water off the map's edge there is nothing; on land there is forage.
  c.send("gather"); await wait();
  expect(of("gathering")).toEqual([2]);
  ticks(room, 21); await wait();
  const got = of("got").at(-1);
  expect(got.letters.length).toBe(1);
  expect(["forage", "fishing", "digging", "cave"]).toContain(got.why);
  // Pick the patch clean, then ask again: refused at once, with no wait.
  const deposits = (room as any).deposits;
  for (let i = 0; i < 30; i++) deposits.gather(w.player.x, w.player.y, (room as any).elapsed, () => 0.5);
  const before = of("gathering").length;
  c.send("gather"); await wait();
  expect(of("refused").at(-1)).toMatch(/picked clean|Nothing to gather/);
  expect(of("gathering").length).toBe(before);
  expect(w.gathering).toBe(0);
});

it("a starting player hunts a PIG in a few blows, and gets H and food by its mass", async () => {
  const { room, r, c, w, walkers, of } = await player();
  const food = w.stores.food;
  const pig = r.addCreature({ spelled: { noun: "pig" }, phrase: "pig", vehicle: false, integrity: null }, "-", w.player.x + 1, w.player.y);
  c.send("attack", pig); await wait();
  let t = 0;
  for (; t < 200 && walkers.has(pig); t++) room.update(0.1);
  expect(walkers.has(pig)).toBe(false);
  expect(t / 10).toBeLessThan(12); // six fist blows, not fifty
  await wait();
  const hunted = of("got").find((g) => g.letters === "h");
  expect(hunted.why).toMatch(/^hunted PIG \(\+\d+(\.\d)? food\)$/);
  expect(w.stores.food - food).toBeGreaterThan(5);
});

it("E by a ruin nobody owns makes it yours, and it then makes its letters for you", async () => {
  const { room, r, c, w, of } = await player();
  const id = r.addThing({ spelled: { noun: "ruin" }, phrase: "ruin", vehicle: false, integrity: null, fixture: "ruin" }, "", w.player.x + 1, w.player.y);
  c.send("take"); await wait();
  expect(room.state.things.get(id)!.owner).toBe(c.sessionId);
  expect(of("spelled").at(-1)).toBe("RUIN is yours: it makes R");
  ticks(room, 60 * 10 * 4); await wait(); // four minutes: 0.3 R a minute
  expect(of("got").some((g) => g.letters === "r" && g.why === "RUIN")).toBe(true);
});

it("UNIT is a band of soldiers who follow you; MOUNT is something to ride", async () => {
  const all = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 20]));
  const { c, w, walkers, of } = await player(all);
  c.send("spell", "unit"); await wait();
  const band = [...walkers.values()].filter((o) => o.master === c.sessionId);
  expect(band.length).toBe(6);
  expect(band[0].unit.body.stats.flag("sentient")).toBe(true);
  c.send("spell", "mount"); await wait();
  expect(w.gear.map((g: any) => g.phrase)).toContain("mount");
  expect(w.gear.find((g: any) => g.phrase === "mount").vehicle).toBe(true);
  void of;
});

it("DEBUG on the live server is a word: it wipes out the insects about you", async () => {
  const all = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 20]));
  const { r, c, w, walkers, of } = await player(all);
  const ants = r.addCreature({ spelled: { noun: "ant" }, phrase: "ant", vehicle: false, integrity: null }, "-", w.player.x + 2, w.player.y, 1000);
  const dog = r.addCreature({ spelled: { noun: "dog" }, phrase: "dog", vehicle: false, integrity: null }, "-", w.player.x + 2, w.player.y);
  c.send("spell", "debug"); await wait();
  expect(walkers.has(ants)).toBe(false);
  expect(walkers.has(dog)).toBe(true);
  expect(of("spelled").at(-1)).toMatch(/wiped out 1000 ANT/);
  expect(w.letters.a).toBeLessThan(20 + 1); // no letters handed out
});

it("with DEBUG=1 (local development) spelling DEBUG fills every letter instead", async () => {
  const { c, w, of } = await player({ d: 1 });
  process.env.DEBUG = "1";
  try { c.send("spell", "debug"); await wait(); } finally { delete process.env.DEBUG; }
  expect(w.letters.q).toBe(999);
  expect(of("spelled").at(-1)).toMatch(/^DEBUG/);
});

it("xxx (playtest shortcut, live for now) fills every letter, holding none of them", async () => {
  const { c, w, of } = await player({});
  c.send("spell", " XXX "); await wait();
  expect(w.letters.x).toBe(999);
  expect(w.letters.q).toBe(999);
  expect(of("spelled").at(-1)).toMatch(/^DEBUG/);
});

it("blows are sent as compact hits to whoever can see them, merged per attacker and target", async () => {
  const { room, r, c, w, of } = await player();
  const pig = r.addCreature({ spelled: { noun: "pig" }, phrase: "pig", vehicle: false, integrity: null }, "-", w.player.x + 0.8, w.player.y);
  r.refreshViews();
  c.send("attack", pig); await wait();
  ticks(room, 15); await wait();
  const hits = of("hits").flat();
  expect(hits.length).toBeGreaterThan(0);
  const mine = hits.find((h: any) => h.by === c.sessionId && h.kind !== "miss");
  expect(mine).toMatchObject({ on: pig, layer: "", ranged: false });
  expect(mine.amount).toBe(5); // a bare hand
  expect(["hit", "crit"]).toContain(mine.kind);
  for (const h of hits) expect(Object.keys(h).sort()).toEqual(["amount", "by", "kind", "layer", "on", "ranged"]);
});
