import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Expansion batch 2: siege and arms (door guards, breaches, engines), mythic beasts and prehistoric giants (hatching, growing up, counters).
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));

/** A builds a HOUSE where it stands; B stands six tiles south, outside. */
async function setup() {
  WorldRoom.testSeed = 31;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const R = room as any;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const walkers = R.walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 0.5; wb.player.y = c.y + 6.5;
  a.send("spell", "house"); await wait();
  const [hid] = [...R.rooms.keys()] as string[];
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const thing = (noun: string) => [...R.grounded.entries()].find(([, g]: [string, any]) => g.spelled.noun === noun) as [string, any] | undefined;
  const mine = (id: string) => [...walkers.values()].filter((w: any) => w.master === id);
  return { room, R, a, b, wa, wb, hid: hid!, second, thing, mine, walkers };
}

it("a PORTCULLIS hung on a HOUSE's door: the door gains its integrity, and a RAM no longer opens it at a touch; a PETARD does", async () => {
  const { room, R, a, b, wa, wb, hid, second } = await setup();
  const door = R.rooms.get(hid);
  const before = door.max;
  a.send("spell", "portcullis"); await wait();
  expect(door.max).toBeGreaterThan(before + 5000);
  expect(door.guards.size).toBe(1);
  // B walks into the door carrying a RAM: bolted against it, the wall stops B.
  b.send("spell", "ram"); await wait();
  expect(wb.gear.some((g: any) => g.spelled.noun === "ram")).toBe(true);
  wa.player.x += 8; // A steps out of the way
  wb.target = { x: R.rooms.get(hid).x, y: R.rooms.get(hid).y };
  second(6);
  expect(door.broken).toBeFalsy();
  expect(wb.inside).toBeUndefined();
  // A PETARD counters the PORTCULLIS: the door breaks at a touch, and the guard with it.
  wb.gear = wb.gear.filter((g: any) => g.spelled.noun !== "ram"); room.rebuild(wb); // the RAM put down: both hands free
  b.send("spell", "petard"); await wait();
  expect(wb.gear.some((g: any) => g.spelled.noun === "petard")).toBe(true);
  wb.target = { x: R.rooms.get(hid).x, y: R.rooms.get(hid).y };
  second(6);
  expect(door.broken).toBe(true);
  expect(door.guards.size).toBe(0);
  expect(door.max).toBe(before);
});

it("a BREACH aimed at an enemy's building breaks its door from afar; a TREBUCHET batters a door from hundreds of metres", async () => {
  const { room, R, b, wb, hid, second } = await setup();
  const door = R.rooms.get(hid);
  const t = room.state.things.get(hid)!;
  b.send("pick", { id: hid }); b.send("spell", "breach"); b.send("pick", null); await wait();
  expect(door.broken).toBe(true);
  // Mended again, then the TREBUCHET: one stone, ×12 against a building, from 20 tiles.
  door.door = door.max; door.broken = false; t.door = 100;
  wb.player.y = t.y + 20;
  b.send("spell", "trebuchet"); await wait();
  expect(wb.unit.riding?.name).toBe("trebuchet");
  wb.foe = hid;
  wb.unit.attack.set("accuracy", "ABS");
  second(20);
  expect(door.broken).toBe(true);
  expect(Math.hypot(wb.player.x - t.x, wb.player.y - t.y)).toBeGreaterThan(10); // never had to close in
});

it("an EGG hatches into a CHICK of its owner's, which grows into a HEN; a HATCHLING grows into a DINOSAUR, and a METEOR wipes dinosaurs out", async () => {
  const { R, a, wa, second, thing, mine, walkers } = await setup();
  wa.player.x += 6;
  a.send("spell", "egg"); await wait();
  expect(thing("egg")).toBeTruthy();
  const age = (s: number) => { for (const [, g] of R.grounded) if (g.born !== undefined) g.born -= s; for (const w of walkers.values()) if (w.born !== undefined) w.born -= s; };
  age(115); second(6);
  expect(thing("egg")).toBeFalsy();
  expect(mine(a.sessionId).some((w: any) => w.body.noun === "chick")).toBe(true);
  age(180); second(2);
  expect(mine(a.sessionId).some((w: any) => w.body.noun === "hen")).toBe(true);
  a.send("spell", "hatchling"); await wait();
  age(240); second(2);
  expect(mine(a.sessionId).some((w: any) => w.body.noun === "dinosaur")).toBe(true);
  a.send("spell", "extinction"); await wait();
  expect(mine(a.sessionId).some((w: any) => w.body.noun === "dinosaur")).toBe(false);
  expect(mine(a.sessionId).some((w: any) => w.body.noun === "hen")).toBe(true); // birds live on
});

it("a COCOON on the ground hatches (it could never grow up before: it cannot move); a MIRROR wipes out a COCKATRICE", async () => {
  const { a, b, wa, second, thing, mine } = await setup();
  wa.player.x += 6;
  a.send("spell", "cocoon"); await wait();
  expect(thing("cocoon")).toBeTruthy();
  second(40);
  expect(thing("cocoon")).toBeFalsy();
  expect(mine(a.sessionId).some((w: any) => w.body.noun === "tussah")).toBe(true);
  b.send("spell", "cockatrice"); await wait();
  expect(mine(b.sessionId).some((w: any) => w.body.noun === "cockatrice")).toBe(true);
  a.send("spell", "mirror"); await wait();
  expect(mine(b.sessionId).some((w: any) => w.body.noun === "cockatrice")).toBe(false);
});

it("bots know the new words by their data: siege words, door guards, and young beasts worth what they grow into", async () => {
  const { wordBook } = await import("./bots.js");
  const { loadDictionary } = await import("./data.js");
  const book = wordBook(loadDictionary());
  const siege = (book.byUse.get("siege") ?? []).map((x) => x.word);
  for (const w of ["ram", "petard", "trebuchet", "catapult", "breach", "sapper"]) expect(siege, w).toContain(w);
  expect((book.byUse.get("guard") ?? [])[0]?.word).toBe("portcullis");
  const creature = (w: string) => book.byUse.get("creature")!.find((x) => x.word === w)!.score;
  expect(creature("dragonet")).toBeGreaterThan(1000); // half a DRAGON
  expect(creature("hatchling")).toBeGreaterThan(creature("chick"));
  expect(book.byUse.get("creature")!.some((x) => x.word === "cocoon")).toBe(true); // hatches into a creature
});
