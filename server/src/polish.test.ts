import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { salePrice, SAIL_COST, Tile, tileAt, walkable } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Polish batch 1: vessels summoned on the water, jamming blinds cameras, selling at markets,
// stand-ins (WORD, BOOK), and a DICTIONARY that spellchecks and reads its holder's enemies.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "described", "sensed", "got", "threats", "hits"];
const all = (n = 99) => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, n]));

/** Two people side by side in a city, with every letter. */
async function setup() {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, unknown][]> = { a: [], b: [] };
  for (const t of MESSAGES) { a.onMessage(t, (m: unknown) => inbox.a!.push([t, m])); b.onMessage(t, (m: unknown) => inbox.b!.push([t, m])); }
  const R = room as any;
  const walkers = R.walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 1.5; wb.player.y = c.y + 0.5;
  const said = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m);
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const things = (noun: string) => [...R.grounded.entries()].filter(([, g]: [string, any]) => g.spelled.noun === noun) as [string, any][];
  const on = async (who: any, target: string, word: string) => { who.send("pick", { id: target }); who.send("spell", word); who.send("pick", null); await wait(); };
  return { room, R, a, b, wa, wb, walkers, said, second, things, on };
}

/** A walkable tile at least `far` tiles from any water, and one beside water. */
function spots(room: WorldRoom, far: number): { dry: { x: number; y: number }; shore: { x: number; y: number } } {
  const m = room.map;
  const wet = (x: number, y: number) => { const t = tileAt(m, x, y); return t === Tile.Water || t === Tile.DeepWater; };
  let dry: { x: number; y: number } | null = null, shore: { x: number; y: number } | null = null;
  for (let y = far; y < m.size - far && !(dry && shore); y += 3) for (let x = far; x < m.size - far && !(dry && shore); x += 3) {
    if (!walkable(m, x + 0.5, y + 0.5)) continue;
    let near = Infinity;
    for (let dy = -far; dy <= far; dy++) for (let dx = -far; dx <= far; dx++) if (wet(x + dx, y + dy)) near = Math.min(near, Math.hypot(dx, dy));
    if (!dry && near > far) dry = { x: x + 0.5, y: y + 0.5 };
    if (!shore && near <= 2) shore = { x: x + 0.5, y: y + 0.5 };
  }
  if (!dry || !shore) throw new Error("no spots");
  return { dry, shore };
}

it("FLEET's frigates lie on the nearest water, or are not summoned at all far from it", async () => {
  const { room, R, a, wa, things, said } = await setup();
  
  // Dry ground for 45 tiles around the city: no water within reach of the FLEET's area.
  const m = room.map, c = m.cities[0]!;
  for (let y = Math.max(0, c.y - 45); y < Math.min(m.size, c.y + 46); y++) for (let x = Math.max(0, c.x - 45); x < Math.min(m.size, c.x + 46); x++) {
    const t = m.tiles[y * m.size + x];
    if (t === Tile.Water || t === Tile.DeepWater) m.tiles[y * m.size + x] = Tile.Grass;
  }
  const dry = { x: c.x + 0.5, y: c.y + 0.5 };
  wa.player.x = dry.x; wa.player.y = dry.y;
  a.send("spell", "fleet"); await wait();
  expect(things("frigate").length).toBe(0);
  expect(String(said("a", "spelled").at(-1))).toMatch(/no water near: no FRIGATES/);
  for (const k of [...R.areas.keys()]) R.areas.delete(k);
  const { shore } = spots(room, 4);
  wa.player.x = shore.x; wa.player.y = shore.y;
  a.send("spell", "fleet"); await wait();
  const frigates = things("frigate");
  expect(frigates.length).toBe(2);
  for (const [tid, g] of frigates) {
    const t = room.state.things.get(tid)!;
    expect(walkable(room.map, t.x, t.y, SAIL_COST)).toBe(true); // afloat
    expect(walkable(room.map, t.x, t.y)).toBe(false); // not on dry land
    expect(g.vehicle).toBe(true);
    expect(t.owner).toBe(a.sessionId);
  }
});

it("jamming blinds the jammed side's cameras where the jam reaches them, not only their own minimap", async () => {
  const { R, a, b, wa, wb, second } = await setup();
  b.send("spell", "camera"); await wait();
  wb.stores.power = 100;
  second(2);
  expect(wb.eyes?.length ?? 0).toBe(1);
  // B walks far off; A jams the ground around B's camera.
  wb.player.x += 60;
  wa.picked = null;
  a.send("spell", "jammer"); await wait();
  second(2);
  expect(R.jammed(b.sessionId, wb)).toBe(false); // the jam does not reach B
  expect(wb.eyes?.length ?? 0).toBe(0); // but the camera inside it sees nothing
});

it("sells a thing carried at a market for its value: a CROWN for letters of your choice and a T", async () => {
  const { R, a, wa, said } = await setup();
  a.send("spell", "crown"); await wait();
  const index = wa.gear.findIndex((g: any) => g.spelled.noun === "crown");
  expect(index).toBeGreaterThanOrEqual(0);
  const info = R.marketInfo(a.sessionId, wa);
  const price = salePrice(5000, 1, info.ratio);
  expect(price).toBeGreaterThan(0);
  expect(info.sells.find((x: any) => x.index === index)?.price).toBe(price);
  const before = wa.letters.o;
  a.send("sell", { index, get: "o" }); await wait();
  expect(String(said("a", "spelled").at(-1))).toMatch(/^Sold CROWN for O+/);
  expect(wa.letters.o).toBe(before + price);
  expect(wa.gear.some((g: any) => g.spelled.noun === "crown")).toBe(false);
  // A thing of no worth, or a letter markets refuse: no sale.
  a.send("spell", "sword"); await wait();
  a.send("sell", { index: wa.gear.findIndex((g: any) => g.spelled.noun === "sword"), get: "o" }); await wait();
  expect(String(said("a", "refused").at(-1))).toMatch(/will not buy SWORD/);
});

it("WORD stands for any four-letter word and BOOK for any document, for their own letters", async () => {
  const { a, wa, walkers, said, things } = await setup();
  wa.letters = { w: 1, o: 1, r: 1, d: 1 };
  a.send("spell", "word wolf"); await wait();
  expect(String(said("a", "spelled").at(-1))).toMatch(/^WORD stands for WOLF/);
  expect([...walkers.values()].some((w) => w.master === a.sessionId && w.body.noun === "wolf")).toBe(true);
  expect(wa.letters.w + wa.letters.o + wa.letters.r + wa.letters.d).toBe(0);
  wa.letters = { b: 1, o: 2, k: 1 };
  a.send("spell", "book map"); await wait();
  expect(String(said("a", "spelled").at(-1))).toMatch(/^BOOK stands for MAP/);
  expect((wa.senses ?? []).length + things("map").length).toBeGreaterThan(0);
  wa.letters = { w: 1, o: 1, r: 1, d: 1 };
  a.send("spell", "word sword"); await wait(); // five letters: WORD does not stand for it
  expect(said("a", "refused").length).toBeGreaterThan(0);
});

it("a DICTIONARY spellchecks its holder's things against a TYPO, and exposes enemies near it", async () => {
  const { room, a, b, wb, second, things, on, said } = await setup();
  a.send("spell", "chair"); await wait();
  const [cid] = things("chair")[0]!;
  a.send("spell", "dictionary"); await wait();
  const [did] = things("dictionary")[0]!; // laid beside its speller
  await on(b, cid, "typo");
  expect(things("chair").length).toBe(1);
  expect(String(said("b", "spelled").at(-1))).toMatch(/spellchecked by DICTIONARY/);
  second(2);
  expect(wb.statuses.some((s: any) => s.status === "expose")).toBe(true);
  // Without it, the typo lands.
  (room as any).removeThing(did);
  await on(b, cid, "typo");
  expect(things("chair").length).toBe(0);
});
