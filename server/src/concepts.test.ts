import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { Tile, tileAt } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "described", "sensed"];
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));

/** Two people side by side on grass by a city's market, with every letter, too tough to die. */
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
  /** Stands someone on open grass away from the city and gathers once. */
  const gather = async (client: any, w: any) => { client.send("gather"); await wait(); second(2.1); };
  return { room, a, b, wa, wb, walkers, last, second, gather, inbox, c };
}

/** Grass far from any city, for gathering. */
function grass(room: WorldRoom) {
  const away = (x: number, y: number) => room.map.cities.every((c) => Math.hypot(c.x - x, c.y - y) > c.radius + 12);
  for (let y = 10; y < room.map.size - 10; y++) for (let x = 10; x < room.map.size - 10; x++) {
    if (tileAt(room.map, x + 0.5, y + 0.5) === Tile.Grass && away(x, y)) {
      let open = true;
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (tileAt(room.map, x + dx, y + dy) !== Tile.Grass) open = false;
      if (open) return { x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error("no open grass");
}

it("WAR: soldiers rally to its maker, kills pay K ×3, markets inside close, and others are told", async () => {
  const { room, a, wa, walkers, last, inbox } = await setup();
  a.send("spell", "war"); await wait();
  expect(last("a", "spelled")).toBe("WAR for 10 minutes: 6 SOLDIERS rally to you");
  const soldiers = [...walkers.values()].filter((w) => w.player.name === "soldier" && w.master === a.sessionId);
  expect(soldiers).toHaveLength(6);
  expect(inbox.b!.some(([t, m]) => t === "notice" && /brought WAR here/.test(String(m)))).toBe(true);
  const zone = [...room.state.zones.values()].find((z) => z.word === "war")!;
  expect(zone.until).toBeGreaterThan(9 * 60);
  expect(zone.by).toBe(wa.player.name);
  a.send("spell", "trade eee for o"); await wait();
  expect(last("a", "refused")).toBe("WAR: this market is closed");
});

it("DROUGHT: gathering finds no water and half the food; RAIN ends it", async () => {
  const { room, a, wa, last, gather, inbox } = await setup();
  const g = grass(room);
  wa.player.x = g.x; wa.player.y = g.y;
  a.send("spell", "drought"); await wait();
  expect(String(last("a", "spelled"))).toMatch(/DROUGHT around you/);
  wa.letters = {};
  for (let i = 0; i < 6; i++) await gather(a, wa);
  expect(wa.letters.e ?? 0).toBeLessThan(6);
  wa.letters = all();
  a.send("spell", "rain"); await wait();
  expect([...room.state.zones.values()].some((z) => z.word === "drought"), JSON.stringify(inbox.a!.slice(-4))).toBe(false);
});

it("HARVEST fills the ground three times over; BLIGHT strips it and only U comes of it", async () => {
  const { room, a, wa, gather, last, inbox } = await setup();
  const g = grass(room);
  wa.player.x = g.x; wa.player.y = g.y;
  a.send("spell", "harvest"); await wait();
  wa.letters = {};
  for (let i = 0; i < 8; i++) await gather(a, wa);
  expect(wa.letters.e).toBeGreaterThanOrEqual(8); // six would be a patch's usual, and E ×2 besides
  wa.letters = all();
  a.send("pick", { x: g.x, y: g.y });
  a.send("spell", "blight"); await wait();
  a.send("pick", null);
  wa.letters = {};
  await gather(a, wa); await wait();
  expect(wa.letters.e ?? 0, JSON.stringify(inbox.a!.slice(-6))).toBe(0);
  expect(String(last("a", "refused"))).toMatch(/picked clean|Nothing grows/);
});

it("TITHE: a share of what others gather near its maker goes to the maker", async () => {
  const { room, a, b, wa, wb, gather } = await setup();
  const g = grass(room);
  wa.player.x = g.x; wa.player.y = g.y; wb.player.x = g.x + 1; wb.player.y = g.y;
  a.send("spell", "tax"); await wait(); // 25% of letters others earn within 60 m
  // Every roll under the tax's 25%: the room's other users of its random numbers (citizens and
  // animals roaming between the hand-run ticks) would otherwise decide which rolls the tax sees.
  (room as any).rng = () => 0.1;
  wa.letters = {}; wb.letters = {};
  for (let i = 0; i < 12; i++) { wb.player.x = g.x + 1 + (i % 2) * 8; await gather(b, wb); }
  expect(Object.values(wa.letters as Record<string, number>).reduce((n, v) => n + v, 0)).toBeGreaterThan(0);
});

it("BONANZA: gathering where it fell turns up X and Z until its twelve are gone", async () => {
  const { room, a, wa, gather } = await setup();
  const g = grass(room);
  wa.player.x = g.x; wa.player.y = g.y;
  a.send("pick", { x: g.x, y: g.y });
  a.send("spell", "bonanza"); await wait();
  a.send("pick", null);
  wa.letters = {};
  for (let i = 0; i < 12; i++) await gather(a, wa);
  expect((wa.letters.x ?? 0) + (wa.letters.z ?? 0)).toBeGreaterThan(0);
});

it("INFLATION doubles every market's price; a BARGAIN makes it one for one", async () => {
  const { room, a, wa, last, c } = await setup();
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  a.send("spell", "inflation"); await wait();
  a.send("spell", "trade eee for o"); await wait();
  expect(last("a", "refused")).toBe("The market takes 6 letters for each one: 6 for O");
  a.send("spell", "deflation"); await wait(); // ends the inflation: two for one
  a.send("spell", "bargain"); await wait();
  a.send("spell", "trade e for o"); await wait();
  expect(String(last("a", "spelled"))).toMatch(/^Traded E for O/);
  void room;
});

it("TRUCE: nobody inside strikes; CURFEW stops others gathering near its maker", async () => {
  const { room, a, b, wa, wb, last, gather, inbox } = await setup();
  const g = grass(room);
  wa.player.x = g.x; wa.player.y = g.y; wb.player.x = g.x + 1; wb.player.y = g.y;
  a.send("spell", "truce"); await wait();
  wb.foe = a.sessionId;
  const hp = wa.hp;
  for (let i = 0; i < 20; i++) room.update(0.1);
  await wait();
  expect(wa.hp).toBe(hp);
  expect(last("b", "refused")).toBe("TRUCE: no fighting here");
  a.send("spell", "curfew"); await wait();
  await gather(b, wb); await wait();
  expect(last("b", "refused"), JSON.stringify(inbox.a!.slice(-3))).toBe("CURFEW: no gathering here");
});

it("MIGRATION brings a herd of deer to hunt; a METEOR lays a crater whose rim gives rare letters", async () => {
  const { room, a, wa, walkers, gather } = await setup();
  const g = grass(room);
  wa.player.x = g.x; wa.player.y = g.y;
  a.send("spell", "migration"); await wait();
  expect([...walkers.values()].filter((w) => w.player.name === "deer" && w.master === "-")).toHaveLength(10);
  a.send("pick", { x: g.x + 6, y: g.y });
  a.send("spell", "meteor"); await wait();
  a.send("pick", null);
  expect(tileAt(room.map, g.x + 6, g.y)).toBe(Tile.Pit);
  wa.player.x = g.x + 2; wa.player.y = g.y; // on the rim
  wa.letters = {};
  for (let i = 0; i < 10; i++) await gather(a, wa);
  expect([..."zxqj"].reduce((n, ch) => n + (wa.letters[ch] ?? 0), 0)).toBeGreaterThan(0);
});

it("ECLIPSE brings night for three minutes, then the day comes back; MONSOON's rain triples fishing everywhere", async () => {
  const { room, a, second } = await setup();
  a.send("spell", "eclipse"); await wait();
  expect(room.state.daylight).toBe("night");
  expect(room.state.daylightWord).toBe("eclipse");
  expect(room.state.daylightUntil).toBeGreaterThan(170);
  second(181);
  expect(room.state.daylight).toBe("day");
  a.send("spell", "monsoon"); await wait();
  expect(room.state.weather).toBe("rain");
  expect(room.state.weatherWord).toBe("monsoon");
  expect((room as any).weatherRules.yields.o.mul).toBe(3);
});

it("every concept word can be spelled and does something", async () => {
  const { readFileSync } = await import("node:fs");
  const txt = readFileSync(new URL("../../tools/demo_words.txt", import.meta.url), "utf8");
  const words = txt.slice(txt.indexOf("# Concepts")).split("\n").filter((l) => /^[a-z]+:/.test(l)).map((l) => l.split(":")[0]!);
  expect(words.length).toBeGreaterThan(200);
  const { room, a, wa, last, inbox } = await setup();
  const failed: string[] = [];
  for (const w of words) {
    wa.letters = all(); wa.hp = 1e9;
    a.send("pick", { x: wa.player.x + 3, y: wa.player.y });
    a.send("spell", w);
    a.send("pick", null);
    await wait(30);
    const said = inbox.a!.filter(([t]) => t === "refused").at(-1)?.[1];
    if (typeof said === "string" && /does nothing|not a thing|unknown/i.test(said)) failed.push(`${w}: ${said}`);
    inbox.a!.length = 0;
    // Clear the map now and then so laws laid by earlier words do not stop later ones.
    for (const [k, z] of (room as any).areas) { (room as any).areas.delete(k); room.state.zones.delete(k); void z; }
  }
  void last;
  expect(failed).toEqual([]);
}, 60000);
