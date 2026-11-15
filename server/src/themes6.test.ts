import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { Tile, tileAt, walkable } from "@lastword/shared";
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

/** Two people side by side in a city, with every letter. */
async function setup(tough = true) {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, unknown][]> = { a: [], b: [] };
  for (const t of MESSAGES) { a.onMessage(t, (m: unknown) => inbox.a!.push([t, m])); b.onMessage(t, (m: unknown) => inbox.b!.push([t, m])); }
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); if (tough) w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 1.5; wb.player.y = c.y + 0.5;
  const said = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m);
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const thing = (phrase: string) => [...(room as any).grounded.entries()].find(([, g]: [string, any]) => g.phrase === phrase) as [string, any] | undefined;
  const on = async (who: any, target: string, word: string) => { who.send("pick", { id: target }); who.send("spell", word); who.send("pick", null); await wait(); };
  return { room, a, b, wa, wb, walkers, said, second, thing, on };
}

it("bugs: thirty MAGGOTS grow into thirty BLOWFLIES; TERMITES eat B's wooden HOUSE but not a STONE HOUSE", async () => {
  const { a, b, wa, wb, walkers, second, thing, room } = await setup();
  a.send("spell", "maggots"); await wait();
  const mine = () => [...walkers.values()].filter((w: any) => w.master === a.sessionId);
  expect(mine().some((w: any) => w.body.noun === "maggot")).toBe(true);
  second(20);
  expect(mine().some((w: any) => w.body.noun === "maggot")).toBe(false);
  expect(mine().some((w: any) => w.body.noun === "blowfly")).toBe(true);
  // B's houses, one wooden and one stone, with A's termites beside them.
  wb.player.x += 6; b.send("spell", "house"); await wait();
  wb.player.y += 6; b.send("spell", "stone house"); await wait();
  const wood = thing("HOUSE") ?? thing("house"), stone = thing("stone house");
  expect(wood && stone).toBeTruthy();
  const tw = room.state.things.get(wood![0])!, ts = room.state.things.get(stone![0])!;
  wa.player.x = tw.x; wa.player.y = tw.y + 0.5;
  a.send("spell", "termites"); await wait();
  for (const w of mine()) if (w.body.noun === "termite") { w.player.x = tw.x; w.player.y = tw.y; w.order = null; }
  const before = tw.hp;
  second(3);
  expect(room.state.things.get(wood![0])?.hp ?? 0).toBeLessThan(before);
  const hp = ts.hp;
  for (const w of mine()) if (w.body.noun === "termite") { w.player.x = ts.x; w.player.y = ts.y; }
  wb; second(2);
  expect(room.state.things.get(stone![0])?.hp).toBe(hp);
});

it("stone and ore: HEMATITE by a CAMPFIRE stays raw; by a FORGE it smelts into IRON", async () => {
  const { a, second, thing } = await setup();
  a.send("spell", "hematite"); await wait();
  a.send("spell", "campfire"); await wait();
  second(12);
  expect(thing("hematite")).toBeTruthy();
  a.send("spell", "forge"); await wait();
  second(12);
  expect(thing("hematite")).toBeFalsy();
  expect(thing("iron")).toBeTruthy();
});
