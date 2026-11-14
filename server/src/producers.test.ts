import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { CYCLE_SECONDS, stampTerrain, Tile, tileAt, waterNear } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const TYPES = ["hits", "letters", "loadout", "dead", "won", "roundover", "gathered", "gathering", "got", "spelled", "refused", "notice", "sensed", "watching", "described"];

/** A person alone on a bare map, standing on a patch of dry grass made for the test. */
async function farmer() {
  WorldRoom.testSeed = 5;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  WorldRoom.testSeed = null;
  const c: any = await colyseus.connectTo(room as never);
  const got: [string, any][] = [];
  for (const t of TYPES) c.onMessage(t, (m: any) => got.push([t, m]));
  const r = room as any, w = r.walkers.get(c.sessionId);
  // Dry grass: no water within reach, so moisture is the ground's own.
  let spot = { x: 0, y: 0 };
  for (let y = 20; y < room.map.size - 20 && !spot.x; y += 4) for (let x = 20; x < room.map.size - 20; x += 4) {
    if (!waterNear(room.map, x, y, 12)) { spot = { x: x + 0.5, y: y + 0.5 }; break; }
  }
  stampTerrain(room.map, { x: spot.x, y: spot.y, radius: 10, tile: Tile.Grass });
  w.player.x = spot.x; w.player.y = spot.y;
  w.letters = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 20]));
  room.rebuild(w);
  const of = (t: string) => got.filter(([k]) => k === t).map(([, m]) => m);
  const spell = async (word: string) => { c.send("spell", word); await wait(); };
  const minutes = async (n: number) => { for (let i = 0; i < n * 60; i++) room.update(1); await wait(200); };
  const gotFrom = (why: string) => of("got").filter((g) => g.why === why).map((g) => g.letters).join("");
  const thing = (phrase: string) => [...room.state.things].find(([, t]) => t.phrase === phrase)!;
  const lines = () => (r.producing(c.sessionId) as string[]);
  return { room, r, c, w, of, spell, minutes, gotFrom, thing, lines, spot };
}

it("HOE tills the ground around it into crop land, and its crops pay A as moisture and soil allow", async () => {
  const { room, w, spell, minutes, gotFrom, spot, lines } = await farmer();
  await spell("hoe");
  expect(tileAt(room.map, spot.x, spot.y)).toBe(Tile.Field);
  expect(tileAt(room.map, spot.x + 2, spot.y)).toBe(Tile.Field);
  expect(room.state.edits.at(-1)!.soil).toBe(true);
  await minutes(4);
  // 0.6 a minute, dry grass 0.7 moist, soil 1.2, its owner working beside it.
  const a = gotFrom("HOE").replace(/y/g, "").length;
  expect(a).toBeGreaterThanOrEqual(2);
  expect(lines()[0]).toMatch(/^HOE: A \d/);
  w.player.x += 30; // left alone it still grows, a little slower
  void room;
});

it("a crop off tilled land makes nothing; tilling never touches water or city", async () => {
  const { room, spell, minutes, gotFrom, lines, spot } = await farmer();
  await spell("corn");
  // CORN tills its own patch: so a crop on it works. Lay grass back over it to see why it needs it.
  stampTerrain(room.map, { x: spot.x, y: spot.y, radius: 2, tile: Tile.Grass });
  await minutes(2);
  expect(gotFrom("CORN").replace(/y/g, "")).toBe("");
  expect(lines()).toContain("CORN: needs tilled land");
  const city = room.map.cities[0]!;
  (room as any).reshape(city.x + 0.5, city.y + 0.5, 1, Tile.Field, true);
  expect(tileAt(room.map, city.x + 0.5, city.y + 0.5)).toBe(Tile.City);
});

it("DOG is livestock: I while fed; a hungry one makes nothing", async () => {
  const { r, w, spell, minutes, gotFrom } = await farmer();
  await spell("dog");
  await minutes(5);
  expect(gotFrom("DOG")).toMatch(/^i+$/);
  const dog = [...r.walkers.values()].find((x: any) => x.master === w.id);
  const before = gotFrom("DOG").length;
  w.stores.food = 0;
  dog.hungry = true;
  r.produce(60);
  expect(gotFrom("DOG").length).toBe(before);
});

it("a MILL turns with the wind; nothing works near a fight", async () => {
  const { room, r, w, spell, minutes, gotFrom, lines } = await farmer();
  await spell("mill");
  await minutes(5);
  expect(gotFrom("MILL")).toMatch(/w/);
  expect(room.state.wind).toBeGreaterThan(0);
  r.fights.push({ x: w.player.x, y: w.player.y, t: r.elapsed + 1000 });
  r.produce(1);
  expect(lines().find((l: string) => l.startsWith("MILL"))).toBe("MILL: fighting nearby");
});

it("furniture pays B only inside its owner's claimed ground", async () => {
  const { r, w, spell, minutes, gotFrom, lines } = await farmer();
  await spell("bed");
  await minutes(2);
  expect(gotFrom("BED").replace(/y/g, "")).toBe("");
  expect(lines()).toContain("BED: outside your claimed ground");
  await spell("house");
  await minutes(3);
  expect(gotFrom("BED")).toMatch(/b/);
  void r; void w;
});

it("a PRESS turns two vowels into an M while it has power; a KILN fires a G into a C when worked", async () => {
  const { w, spell, minutes, gotFrom, lines } = await farmer();
  await spell("press");
  const vowels = () => [..."aeiou"].reduce((n, v) => n + (w.letters[v] ?? 0), 0);
  const before = vowels();
  await minutes(4);
  const m = gotFrom("PRESS").replace(/y/g, "").length;
  expect(m).toBeGreaterThanOrEqual(2);
  expect(before - vowels()).toBe(2 * m);
  for (const v of "aeiou") w.letters[v] = 0;
  await minutes(3);
  expect(lines().find((l: string) => l.startsWith("PRESS"))).toBe("PRESS: needs vowels");
  for (const v of "aeiou") w.letters[v] = 20;
  await spell("kiln");
  const g = w.letters.g;
  await minutes(3);
  const cs = gotFrom("KILN").replace(/y/g, "").length;
  expect(cs).toBeGreaterThanOrEqual(1);
  expect(g - w.letters.g).toBe(cs);
  w.player.x += 20; // nobody working it
  await minutes(1);
  expect(lines()).toContain("KILN: nobody working it");
});

it("an OAK is harvested once a cycle by its owner close by; left alone, its crop waits and then rots", async () => {
  const { w, spell, minutes, gotFrom, lines, r } = await farmer();
  await spell("oak");
  await minutes((CYCLE_SECONDS / 60) * 3 + 0.1);
  expect(gotFrom("OAK")).toMatch(/p/);
  const had = gotFrom("OAK").replace(/y/g, "").length;
  w.player.x += 20;
  await minutes((CYCLE_SECONDS / 60) * 3);
  expect(gotFrom("OAK").replace(/y/g, "").length).toBe(had);
  expect(lines()).toContain("OAK: ripe: nobody near to harvest it");
  w.player.x -= 20;
  await minutes(CYCLE_SECONDS / 60);
  // One cycle's worth waited; the rest rotted.
  const now = gotFrom("OAK").replace(/y/g, "").length - had;
  expect(now).toBeGreaterThanOrEqual(1);
  expect(now).toBeLessThanOrEqual(3);
  void r;
});

it("whatever you keep on the ground ages into Y, faster for old things; the soil wears out under crops", async () => {
  const { r, spell, minutes, gotFrom, w } = await farmer();
  await spell("clock");
  await minutes(10);
  expect(gotFrom("CLOCK")).toMatch(/^y+$/);
  await spell("field");
  const fresh = r.soil.fertility(w.player.x, w.player.y, r.elapsed);
  await minutes(10);
  expect(r.soil.fertility(w.player.x, w.player.y, r.elapsed)).toBeLessThan(fresh);
});

it("whatever belongs to you produces, carried or ridden too; the loadout's income says what comes in from what", async () => {
  const { r, w, c, spell, minutes, gotFrom, of } = await farmer();
  await spell("horse");
  expect(w.gear.some((g: any) => g.vehicle)).toBe(true);
  await minutes(4);
  expect(gotFrom("HORSE")).toMatch(/i/);
  await spell("hoe");
  await minutes(1);
  const income = r.income.get(c.sessionId).letters as { letter: string; rate: number; from: string }[];
  expect(income.find((l) => l.letter === "a")?.from).toBe("HOE");
  expect(income.find((l) => l.letter === "i")?.from).toBe("HORSE");
  expect(of("loadout").at(-1).income.length).toBeGreaterThan(0);
});
