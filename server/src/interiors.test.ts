import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Walk-in buildings (shared interior.ts): hiding, storage, doors, allies, and bots using them.
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
  const inbox: Record<string, [string, unknown][]> = { a: [], b: [] };
  for (const t of ["notice", "refused", "spelled", "letters", "loadout", "got"]) {
    a.onMessage(t, (m: unknown) => inbox.a!.push([t, m]));
    b.onMessage(t, (m: unknown) => inbox.b!.push([t, m]));
  }
  const walkers = R.walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 0.5; wb.player.y = c.y + 6.5;
  a.send("spell", "house"); await wait();
  const [hid] = [...R.rooms.keys()] as string[];
  const house = room.state.things.get(hid!)!;
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const last = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).at(-1)?.[1];
  return { room, R, a, b, wa, wb, hid: hid!, house, second, last, walkers };
}

it("a HOUSE is a room with a door; whoever is inside is hidden from outside and cannot be struck", async () => {
  const { room, R, a, b, wa, wb, hid, house, second } = await setup();
  expect(house.room).toBeCloseTo(1.5);
  expect(house.door).toBe(100);
  expect(wa.inside).toBe(hid);
  second(1); await wait();
  expect(b.state.players.has(a.sessionId)).toBe(false); // hidden indoors
  expect(a.state.players.has(b.sessionId)).toBe(true); // those inside see out
  expect(R.shelterOf(a.sessionId, wa)).toBe(1); // nothing from the sky lands indoors
  wb.foe = a.sessionId;
  second(1);
  expect(wb.foe).toBeNull(); // nobody strikes across a wall
  // Out of the door: seen again.
  wa.target = { x: house.x, y: house.y + 4 };
  second(3); await wait();
  expect(wa.inside).toBeUndefined();
  expect(b.state.players.has(a.sessionId)).toBe(true);
  void room;
});

it("an enemy is stopped at the wall until the door is broken; blows from outside land on the door first", async () => {
  const { R, a, b, wa, wb, hid, house, second, last } = await setup();
  wb.target = { x: house.x, y: house.y };
  second(4); await wait();
  expect(wb.inside).toBeUndefined();
  expect(Math.hypot(wb.player.x - house.x, wb.player.y - house.y)).toBeGreaterThanOrEqual(house.room);
  expect(String(last("b", "refused"))).toMatch(/HOUSE: door shut/);
  b.send("spell", "axe"); await wait();
  b.send("attack", hid); await wait();
  for (let s = 0; s < 120 && house.door > 0; s++) second(1);
  expect(house.door).toBe(0);
  expect(house.hp).toBe(100); // the door took every blow
  expect(R.rooms.get(hid).door).toBe(0);
  wb.foe = null;
  wb.target = { x: house.x, y: house.y };
  second(4); await wait();
  expect(wb.inside).toBe(hid); // a broken door lets anyone in
  expect(b.state.players.has(a.sessionId)).toBe(true); // and inside they see who hid there
  void a; void wa;
});

it("things put down inside are hidden from outsiders and safe from THEFT through the walls", async () => {
  const { room, R, a, b, wa, wb, hid, house, second, last } = await setup();
  a.send("spell", "crown"); await wait(); // carried
  wa.player.x = house.x; wa.player.y = house.y + 0.9;
  a.send("drop"); await wait();
  const [tid] = [...R.grounded.entries()].find(([, g]: [string, any]) => g.phrase === "crown")!;
  expect(R.roomOfThing.get(tid)).toBe(hid);
  wb.player.x = house.x; wb.player.y = house.y + 1.6; // just outside the south wall
  second(1); await wait();
  expect(b.state.things.has(tid)).toBe(false);
  expect(b.state.things.has(hid)).toBe(true); // the building itself is seen, closed
  wb.picked = tid;
  b.send("spell", "theft"); await wait();
  expect(String(last("b", "refused"))).toMatch(/inside HOUSE: break the door/);
  expect(room.state.things.get(tid)!.owner).toBe(a.sessionId);
  void wa;
});

it("the owner's allies walk in freely and see inside; a KEY breaks an enemy's door at a touch", async () => {
  const { room, R, a, b, wa, wb, hid, house, second } = await setup();
  await colyseus.connectTo(room as never); // a third person: a pact of everyone left ends at once
  R.pacts.set("p", { id: "p", word: "treaty", members: new Set([a.sessionId, b.sessionId]), until: Infinity, penalty: [] });
  second(1); await wait();
  expect(b.state.players.has(a.sessionId)).toBe(true); // its own side sees into it
  wb.target = { x: house.x, y: house.y + 0.5 };
  second(4);
  expect(wb.inside).toBe(hid);
  expect(R.rooms.get(hid).door).toBeGreaterThan(0);
  // No longer allies: out it goes, and back in only with a KEY.
  R.pacts.clear();
  wb.target = { x: house.x, y: house.y + 4 }; second(3);
  expect(wb.inside).toBeUndefined();
  b.send("spell", "key"); await wait();
  wb.target = { x: house.x, y: house.y }; second(4);
  expect(wb.inside).toBe(hid);
  expect(house.door).toBe(0);
  void wa;
});

it("a door mends while its owner's side is inside and no enemy is", async () => {
  const { R, hid, house, second } = await setup();
  const r = R.rooms.get(hid);
  r.door = r.max / 2; house.door = 50;
  second(5);
  expect(house.door).toBeGreaterThan(55);
});

it("a bot whose quarry goes indoors raids: it goes for the door; one hurt hides in its own building", async () => {
  const { room, R, a, wa, wb, hid, house, second, walkers } = await setup();
  wb.player.x += 150; // the other person out of the way
  room.addBots(1, "hard");
  const [bid] = [...R.bots.keys()] as string[];
  const bot = walkers.get(bid!), mind = R.bots.get(bid);
  Object.assign(mind, { peaceUntil: 0, nextSpell: Infinity });
  bot.hp = 1e9; bot.player.x = house.x + 3; bot.player.y = house.y + 3;
  R.equip(bot, { spelled: { noun: "axe", adjectives: [] }, phrase: "axe", vehicle: false, integrity: null });
  bot.foe = a.sessionId;
  room.update(0.1);
  expect(bot.foe).toBe(hid);
  expect(mind.used.raid).toBeGreaterThan(0);
  for (let s = 0; s < 120 && house.door > 0; s++) second(1);
  expect(house.door).toBe(0);
  expect(mind.used["break in"]).toBe(1);
  second(5);
  expect(bot.inside).toBe(hid); // in it goes after whoever hid there
  // A hurt bot runs into a building of its own.
  bot.player.x = house.x + 20; wa.player.x = house.x + 24; wa.player.y = bot.player.y;
  R.removeThing(hid);
  wa.foe = null;
  bot.foe = null; bot.target = null; mind.goal = undefined;
  const own = R.addThing({ spelled: { noun: "house", adjectives: [] }, phrase: "house", vehicle: false, integrity: null }, bid, house.x, house.y);
  R.botFlee(bid, bot, mind, [{ id: a.sessionId, d: 4 }], new Uint8Array(26), false);
  expect(bot.target).toEqual({ x: room.state.things.get(own)!.x, y: room.state.things.get(own)!.y });
  expect(mind.used.hide).toBe(1);
});

it("a bot puts a valuable it carries away inside its own building", async () => {
  const { room, R, house, second, walkers, hid } = await setup();
  room.addBots(1, "hard");
  const [bid] = [...R.bots.keys()] as string[];
  const bot = walkers.get(bid!), mind = R.bots.get(bid);
  R.giveThing(hid, bid);
  bot.player.x = house.x; bot.player.y = house.y;
  bot.inside = hid;
  expect(R.equip(bot, { spelled: { noun: "diamond", adjectives: [] }, phrase: "diamond", vehicle: false, integrity: null })).toBeNull();
  R.botStore(bid, bot, mind);
  expect(mind.used.store).toBe(1);
  const [tid] = [...R.grounded.entries()].find(([, g]: [string, any]) => g.phrase === "diamond")!;
  expect(R.roomOfThing.get(tid)).toBe(hid);
  void second;
});

it("gathering inside a room forages the room's own pool (shared INTERIOR), not the ground under it", async () => {
  const { R, a, wa, hid, second, last } = await setup();
  expect(wa.inside).toBe(hid);
  const got: string[] = [];
  a.onMessage("gathered", (m: string) => got.push(m));
  const dice = R.rng;
  R.rng = () => 0; // every roll finds something, and the pool's first letter
  a.send("gather"); await wait();
  second(3); await wait();
  R.rng = dice;
  expect(got).toEqual(["e"]);
  expect((last("a", "got") as { detail?: string }).detail).toMatch(/^INDOORS 45%/); // the popup names the room's odds
  expect(R.deposits.gather(wa.player.x, wa.player.y, R.elapsed, () => 0.5, 1, () => [], true).roll?.place).toBe("indoors");
});
