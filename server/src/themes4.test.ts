import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
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
  const said = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m);
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const mine = (owner: string, name: string) => [...walkers].find(([, w]) => w.master === owner && w.player.name === name);
  const thing = (phrase: string) => [...(room as any).grounded.entries()].find(([, g]: [string, any]) => g.phrase === phrase) as [string, any] | undefined;
  return { room, a, b, wa, wb, walkers, said, second, mine, thing };
}

it("money: a GIFT pays B; DEBT makes B pay A over time; FORECLOSURE then takes B's thing", async () => {
  const { a, b, wa, wb, said, second, thing, room } = await setup();
  const before = count(wb.letters);
  a.send("pick", { id: b.sessionId }); a.send("spell", "gift"); a.send("pick", null); await wait();
  expect(said("a", "spelled").at(-1)).toMatch(/GIFT on .*paid 5 letters/);
  expect(count(wb.letters)).toBe(before + 5);
  // A debt on B: a letter every 10 s goes to A.
  a.send("pick", { id: b.sessionId }); a.send("spell", "debt"); a.send("pick", null); await wait();
  expect(wb.statuses.some((s: any) => s.status === "debt")).toBe(true);
  const owed = count(wa.letters);
  second(31);
  expect(count(wa.letters)).toBeGreaterThanOrEqual(owed + 3);
  // B's VAULT has security 10, but none against the one B owes.
  b.send("spell", "vault"); await wait();
  const [vid] = thing("vault")!;
  a.send("pick", { id: vid }); a.send("spell", "foreclosure"); a.send("pick", null); await wait();
  expect(said("a", "spelled").at(-1)).toMatch(/VAULT is yours/);
  expect(room.state.things.get(vid)!.owner).toBe(a.sessionId);
  // BANKRUPTCY ends B's debt.
  b.send("spell", "bankruptcy"); await wait();
  expect(wb.statuses.some((s: any) => s.status === "debt")).toBe(false);
});

it("money: a BRIBE buys B's dog for its price; a BANK earns interest as T", async () => {
  const { a, b, wa, wb, mine, second, said } = await setup();
  b.send("spell", "cat"); await wait();
  const [catId, cat] = mine(b.sessionId, "cat")!;
  const before = count(wa.letters);
  a.send("pick", { id: catId }); a.send("spell", "bribe"); a.send("pick", null); await wait();
  expect(said("a", "spelled").at(-1), String(said("a", "refused").at(-1))).toMatch(/CAT is yours/);
  expect(cat.master).toBe(a.sessionId);
  expect(count(wa.letters)).toBe(before - "bribe".length - 8);
  // Interest: a BANK keeps A's letters safe and pays T on them.
  a.send("spell", "bank"); await wait();
  const t = wa.letters.t;
  second(61);
  expect(wa.letters.t).toBeGreaterThan(t);
  void wb;
});

it("crime: a LANDMINE is hidden from B and springs on B; DISARM breaks another", async () => {
  const { room, a, b, wa, wb, thing, said, second } = await setup();
  a.send("spell", "landmine"); await wait();
  const [mid, mineGear] = thing("landmine")!;
  expect(mineGear).toBeTruthy();
  (room as any).refreshViews();
  expect(wa.seenThings.has(mid)).toBe(true);
  expect(wb.seenThings.has(mid)).toBe(false); // hidden from B
  // B walks onto it.
  const t = room.state.things.get(mid)!;
  wb.player.x = t.x; wb.player.y = t.y; wb.hp = 1000; room.rebuild(wb);
  second(1); await wait();
  expect(room.state.things.has(mid)).toBe(false);
  expect(said("b", "notice").some((m) => /sprang on you/.test(String(m)))).toBe(true);
  // Another mine, and B DISARMs it.
  for (const w of [wa, wb]) { w.statuses.length = 0; (room as any).statusChanged(w); } // A stood in the blast too
  wb.player.x = wa.player.x + 3; wb.player.y = wa.player.y;
  a.send("spell", "landmine"); await wait();
  expect(thing("landmine"), String(said("a", "refused").at(-1)) + String(said("a", "spelled").at(-1))).toBeTruthy();
  const [m2] = thing("landmine")!;
  b.send("spell", "disarm"); await wait();
  expect(room.state.things.has(m2), String(said("b", "refused").at(-1)) + String(said("b", "spelled").at(-1))).toBe(false);
});

it("information: ESPIONAGE reads B's letters; WANTED shows B on A's arrows far away; a HOAX puts decoys on B's", async () => {
  const { room, a, b, wb, said, second } = await setup();
  a.send("pick", { id: b.sessionId }); a.send("spell", "espionage"); a.send("pick", null); await wait();
  expect(said("a", "notice").some((m) => /holds letters A×/.test(String(m)))).toBe(true);
  a.send("pick", { id: b.sessionId }); a.send("spell", "wanted"); a.send("pick", null); await wait();
  expect(wb.statuses.some((s: any) => s.status === "expose")).toBe(true);
  wb.player.x += 100; // far out of sight
  second(1); await wait();
  const arrows = said("a", "threats").at(-1) as any[];
  expect(arrows.some((t) => t.id === b.sessionId)).toBe(true);
  // A HOAX: made-up people closing in on B.
  a.send("spell", "hoax"); await wait();
  expect(said("a", "spelled").at(-1), String(said("a", "refused").at(-1))).toMatch(/HOAX/i);
  second(1); await wait();
  const fake = said("b", "threats").at(-1) as any[];
  expect(fake.some((t) => String(t.id).startsWith("decoy:"))).toBe(true);
  void room;
});

it("information: a JAMMER blacks out B's minimap", async () => {
  const { a, b, said, second } = await setup();
  b.send("spell", "map"); await wait();
  second(2); await wait();
  expect((said("b", "sensed").at(-1) as any)?.jammed).toBeFalsy();
  a.send("spell", "jammer"); await wait();
  second(2); await wait();
  expect((said("b", "sensed").at(-1) as any)?.jammed).toBe(true);
});

it("religion: a MIRACLE needs faith; a SHRINE gathers it; a death by an ALTAR is an offering; a CURSE halves letters earned", async () => {
  const { room, a, b, wa, wb, second, said } = await setup();
  a.send("spell", "miracle"); await wait();
  expect(String(said("a", "refused").at(-1) ?? said("a", "notice").at(-1))).toMatch(/takes 40 faith/);
  a.send("spell", "altar"); await wait();
  // A creature killed by the altar: faith for its owner.
  const id = (room as any).addCreature({ spelled: { noun: "cow" }, phrase: "cow", vehicle: false, integrity: null }, "-", wa.player.x + 1, wa.player.y + 1);
  (room as any).kill(id, a.sessionId);
  expect(wa.stores.faith).toBeGreaterThan(10);
  wa.stores.faith = 40;
  a.send("spell", "miracle"); await wait();
  expect(wa.stores.faith).toBeLessThan(1);
  // A SHRINE fills the store a minute at a time.
  a.send("spell", "shrine"); await wait();
  second(31);
  expect(wa.stores.faith).toBeGreaterThan(0.5);
  // A CURSE on B: B earns half.
  wa.stores.faith = 50;
  a.send("pick", { id: b.sessionId }); a.send("spell", "curse"); a.send("pick", null); await wait();
  expect(wb.statuses.some((s: any) => s.status === "curse")).toBe(true);
  let got = 0;
  for (let i = 0; i < 40; i++) got += (room as any).earn(b.sessionId, "eeeeeeeeee", wb.player, "test").length;
  expect(got).toBeLessThan(300);
});

it("weather: a BLIZZARD lays snow in patches near people, over plains only", async () => {
  const { room, a, wa } = await setup();
  const r = room as any;
  // Put A in open grassland, everyone else far away.
  const size = room.map.size;
  let open: { x: number; y: number } | null = null;
  for (let y = 40; y < size - 40 && !open; y += 5) for (let x = 40; x < size - 40 && !open; x += 5) if (room.map.tiles[y * size + x] === 3) open = { x: x + 0.5, y: y + 0.5 };
  expect(open).toBeTruthy();
  for (const [, w] of r.walkers) if (w !== wa) { w.player.x = 1; w.player.y = 1; }
  wa.player.x = open!.x; wa.player.y = open!.y;
  a.send("spell", "blizzard"); await wait();
  const edits = room.state.edits.length;
  for (let i = 0; i < 20; i++) r.weatherPatches(10);
  expect(room.state.edits.length).toBeGreaterThan(edits);
  expect(room.state.edits.at(-1)!.tile).toBe(10); // snow
  expect(room.state.edits.at(-1)!.only).toBeGreaterThan(0);
});
