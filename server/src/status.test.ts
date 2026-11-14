import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
// These rooms test other systems: no markets, ruins, animals or exploring to get in the way.
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));
const ticks = (room: WorldRoom, n: number, step = 0.1) => { for (let i = 0; i < n; i++) room.update(step); };

/** Two people a tile apart in the first city, with every letter and plenty of health. */
async function twoPlayers(apart = 1) {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const said = { a: [] as unknown[], b: [] as unknown[] };
  for (const [who, c] of [["a", a], ["b", b]] as const) {
    for (const t of ["letters", "notice", "loadout", "dead", "won", "roundover"]) c.onMessage(t, () => {});
    for (const t of ["spelled", "refused"]) c.onMessage(t, (m: unknown) => said[who].push(m));
  }
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 0.5 + apart; wb.player.y = c.y + 0.5;
  wa.letters = all(); wb.letters = all();
  for (const w of [wa, wb]) { w.hp = 1e6; room.rebuild(w); }
  const creature = (name: string) => [...walkers].find(([, w]) => w.player.name === name)!;
  const has = (w: any, status: string) => w.statuses.some((s: any) => s.status === status);
  return { room, a, b, wa, wb, said, walkers, creature, has };
}

it("FEAR makes those it frightens run from its maker and strike nobody", async () => {
  const { room, a, wa, wb, has } = await twoPlayers(2);
  wb.foe = a.sessionId; // B was attacking A
  const hp = wa.hp;
  a.send("spell", "fear"); await wait();
  ticks(room, 20);
  expect(has(wb, "fear")).toBe(true);
  expect(wb.player.status).toContain("fear");
  expect(wb.foe).toBeNull();
  expect(wa.hp).toBe(hp);
  expect(Math.hypot(wb.player.x - wa.player.x, wb.player.y - wa.player.y)).toBeGreaterThan(4);
  expect(has(wa, "fear")).toBe(false); // FEAR targets enemies only
});

it("a stunned or rooted walker cannot move, and a NET roots whoever it hits", async () => {
  const { room, a, b, wa, wb, has, said } = await twoPlayers();
  // AMBUSH stuns for five seconds.
  wa.picked = b.sessionId;
  a.send("spell", "ambush"); await wait();
  expect(has(wb, "stun")).toBe(true);
  const at = { x: wb.player.x, y: wb.player.y };
  b.send("move", { x: at.x, y: at.y + 3 }); await wait();
  ticks(room, 20);
  expect(wb.player.y).toBeCloseTo(at.y);
  wb.statuses = []; (room as any).statusChanged(wb);

  // A NET does no damage but roots for six seconds.
  a.send("spell", "net"); await wait();
  expect(said.a.at(-1)).toBe("NET equipped");
  a.send("attack", b.sessionId); await wait();
  for (let i = 0; i < 100 && !has(wb, "root"); i++) ticks(room, 1); // a throw can miss: keep throwing until one lands
  expect(has(wb, "root")).toBe(true);
  a.send("attack", null); await wait();
  at.y = wb.player.y; // B set off for its earlier goal once the stun ended, until the net caught it
  b.send("move", { x: at.x, y: at.y + 3 }); await wait();
  ticks(room, 20);
  expect(wb.player.y).toBeCloseTo(at.y);
  ticks(room, 70); // the root wears off and B walks on
  b.send("move", { x: at.x, y: at.y + 3 }); await wait();
  ticks(room, 20);
  expect(has(wb, "root")).toBe(false);
  expect(wb.player.y).toBeGreaterThan(at.y + 1);
});

it("poison from a SNAKE bite keeps hurting after the bite, and HEAL ends it", async () => {
  const { room, a, b, wa, wb, has, creature } = await twoPlayers();
  a.send("spell", "snake"); await wait();
  const [, snake] = creature("snake");
  snake.player.x = wb.player.x; snake.player.y = wb.player.y;
  // A snake is not sentient: it takes no orders, but it defends its master. B attacks A.
  b.send("attack", a.sessionId); await wait();
  for (let i = 0; i < 40 && !has(wb, "poison"); i++) room.update(0.1);
  expect(has(wb, "poison")).toBe(true);
  wb.foe = null; snake.foe = null; snake.player.x += 30; // no more bites
  const hp = wb.hp;
  ticks(room, 30);
  expect(hp - wb.hp).toBeGreaterThanOrEqual(10); // five a second
  b.send("spell", "heal"); await wait();
  expect(has(wb, "poison")).toBe(false);
  expect(wb.player.status).toBe("");
  const healed = wb.hp;
  ticks(room, 20);
  expect(wb.hp).toBe(healed);
});

it("an immune_* flag blocks its status: WAKE keeps a SLEEPING SWORD from sending you to sleep", async () => {
  const { room, a, b, wb, has, said } = await twoPlayers();
  a.send("spell", "sleeping sword"); await wait();
  expect(said.a.at(-1)).toBe("SLEEPING SWORD equipped");
  b.send("spell", "wake"); await wait();
  a.send("attack", b.sessionId); await wait();
  ticks(room, 30);
  expect(wb.hp).toBeLessThan(1e6);
  expect(has(wb, "sleep")).toBe(false);
  // Without it, B falls asleep; and the next blow wakes them.
  wb.buffs = []; room.rebuild(wb);
  for (let i = 0; i < 30 && !has(wb, "sleep"); i++) room.update(0.1);
  expect(has(wb, "sleep")).toBe(true);
  b.send("spell", "chair"); await wait();
  expect(said.b.at(-1)).toBe("You cannot spell while you are asleep");
});

it("SILENCE stops everyone inside it spelling", async () => {
  const { room, a, b, wb, said, has } = await twoPlayers();
  a.send("pick", { x: wb.player.x, y: wb.player.y });
  a.send("spell", "silence"); await wait();
  ticks(room, 2);
  expect(has(wb, "silence")).toBe(true);
  b.send("spell", "chair"); await wait();
  expect(said.b.at(-1)).toBe("You cannot spell while you are silenced");
  ticks(room, 1, 6 * 60); // SILENCE lasts five minutes
  ticks(room, 30);
  b.send("spell", "chair"); await wait();
  expect(said.b.at(-1)).toBe("CHAIR made");
});

it("WAR turns creatures inside it on whoever is nearest and not its maker's, even their own master", async () => {
  const { room, a, b, wa, wb, creature } = await twoPlayers();
  b.send("spell", "wolf"); await wait();
  wb.stores.food = 100; // a wolf left hungry through a thirty-minute war would turn wild
  const [wolfId, wolf] = creature("wolf");
  wolf.player.x = wa.player.x; wolf.player.y = wa.player.y; // right beside A, the war's maker
  a.send("spell", "war"); await wait();
  ticks(room, 2);
  expect(wolf.foe).toBe(b.sessionId);
  const hp = wb.hp;
  ticks(room, 30);
  expect(wb.hp).toBeLessThan(hp);
  // Once the war is over it is B's again.
  ticks(room, 1, 31 * 60);
  ticks(room, 2);
  expect(wolf.foe).toBeNull();
  expect(wolfId).toMatch(/^c/);
});

it("DISEASE spreads person to person: a carrier takes it with them and passes it on", async () => {
  const { room, a, wa, wb } = await twoPlayers(4.5);
  // Two diseases at once take 6 morale and break a body; this test is about contagion, so both stand firm.
  for (const w of [wa, wb]) { w.buffs.push({ word: "courage", set: { immune_fear: true }, ops: [], until: Infinity }); room.rebuild(w); }
  a.send("pick", { x: wb.player.x, y: wb.player.y });
  a.send("spell", "disease"); await wait();
  const carried = (id: string) => [...(room as any).areas.values()].some((z: any) => z.word === "disease" && z.follows === id);
  for (let i = 0; i < 120 && !carried(wb.id); i++) room.update(10); // half a chance a minute
  expect(carried(wb.id)).toBe(true);
  // B walks off and carries it; A, outside the first one, catches it from B.
  wb.player.x = wa.player.x + 0.5; wb.player.y = wa.player.y;
  wa.player.x -= 8; wb.player.x -= 8;
  for (let i = 0; i < 120 && !carried(a.sessionId); i++) room.update(10);
  expect(carried(a.sessionId)).toBe(true);
  expect([...room.state.zones.values()].filter((z) => z.word === "disease").length).toBeGreaterThanOrEqual(3);
});
