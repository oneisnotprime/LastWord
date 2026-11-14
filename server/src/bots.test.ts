import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { botSettings } from "./bots.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered"];

async function join(room: WorldRoom) {
  const c: any = await colyseus.connectTo(room as never);
  for (const t of MESSAGES) c.onMessage(t, () => {});
  return c;
}

const bots = (room: WorldRoom) => [...((room as any).bots as Map<string, any>).entries()];
const walkers = (room: WorldRoom) => (room as any).walkers as Map<string, any>;

it("reads bot options, clamped to the room, and ignores nonsense", () => {
  expect(botSettings({ bots: 7, difficulty: "hard" }, 99)).toEqual({ bots: 7, difficulty: "hard" });
  expect(botSettings({ bots: 500 }, 99)).toEqual({ bots: 99, difficulty: "normal" });
  expect(botSettings({ bots: 50 }, 20)).toEqual({ bots: 20, difficulty: "normal" });
  expect(botSettings({ bots: -3, difficulty: "silly" }, 99)).toEqual({ bots: 0, difficulty: "normal" });
  expect(botSettings({ bots: "9" }, 99, undefined)).toEqual({ bots: 0, difficulty: "normal" });
  expect(botSettings({}, 99, "4")).toEqual({ bots: 4, difficulty: "normal" });
  expect(botSettings({ bots: 0 }, 99, "4")).toEqual({ bots: 0, difficulty: "normal" });
});

it("bots join with the first client's options, count as people, gather, spell and equip", async () => {
  const room = (await colyseus.createRoom("world", { bots: 5 })) as unknown as WorldRoom;
  const a = await join(room);
  expect(bots(room).length).toBe(5);
  expect(room.counts.people).toBe(6);
  expect(room.maxClients).toBe(95);
  const names = [...room.state.players.values()].map((p) => p.name);
  expect(names).toEqual(expect.arrayContaining(["bot1", "bot5"]));
  // The client is out of harm's way: this test is about what bots do on their own.
  const me = walkers(room).get(a.sessionId);
  me.hp = 1e9; room.rebuild(me);
  for (let i = 0; i < 3 * 60 * 10; i++) room.update(0.1); // three minutes
  const minds = bots(room).map(([, m]) => m);
  expect(minds.reduce((n, m) => n + m.gathered, 0)).toBeGreaterThan(5);
  expect(minds.reduce((n, m) => n + m.spelled, 0)).toBeGreaterThan(3);
  const armed = bots(room).filter(([id]) => walkers(room).get(id)?.gear.length);
  expect(armed.length).toBeGreaterThan(0);
});

it("a bot attacks a player who comes near", async () => {
  WorldRoom.testSeed = 18;
  const room = (await colyseus.createRoom("world", { bots: 1, difficulty: "normal" })) as unknown as WorldRoom;
  const a = await join(room);
  const botId = bots(room)[0]![0];
  const bot = walkers(room).get(botId), me = walkers(room).get(a.sessionId);
  // Only a SWORD's letters: with a random hand it may also spell a creature (a GOD) that kills
  // the player first, which ends the round and leaves the bot no foe.
  bot.letters = { s: 1, w: 1, o: 1, r: 1, d: 1 };
  Object.assign(bots(room)[0]![1], { peaceUntil: 0, nextSpell: 0 }); // past its peaceful start
  for (let i = 0; i < 10; i++) room.update(0.1); // it spells its weapon
  expect(bot.unit.weapon).toBeTruthy();
  // No game to hunt instead: the wild animals and citizens are taken off the map.
  for (const [id, w] of [...walkers(room)]) if (w.master === "-") (room as any).removeWalker(id);
  bot.foe = null;
  me.player.x = bot.player.x + 1; me.player.y = bot.player.y;
  me.hp = 1e6; room.rebuild(me);
  for (let i = 0; i < 30; i++) room.update(0.1);
  expect(room.state.phase).toBe("playing");
  expect(bot.foe).toBe(a.sessionId);
  expect(me.hp).toBeLessThan(1e6);
});

it("a hard bot puts out a fire set on it with a counter-word", async () => {
  const room = (await colyseus.createRoom("world", { bots: 1, difficulty: "hard" })) as unknown as WorldRoom;
  const a = await join(room);
  const botId = bots(room)[0]![0];
  const bot = walkers(room).get(botId), me = walkers(room).get(a.sessionId);
  me.player.x = bot.player.x + 1; me.player.y = bot.player.y;
  me.letters = { f: 1, i: 1, r: 1, e: 1 };
  bot.letters = { r: 1, a: 1, i: 1, n: 1 };
  Object.assign(bots(room)[0]![1], { nextSpell: 0 });
  bot.hp = 1e6; room.rebuild(bot);
  a.send("pick", { x: bot.player.x, y: bot.player.y });
  a.send("spell", "fire");
  await wait();
  expect([...room.state.zones.values()].map((z) => z.word)).toContain("fire");
  for (let i = 0; i < 10; i++) room.update(0.1);
  expect([...room.state.zones.values()].map((z) => z.word)).not.toContain("fire");
  expect(bot.letters.n ?? 0).toBe(0); // it spelled RAIN
});

it("a round of ten bots and no humans runs to a winner", async () => {
  WorldRoom.testSeed = 12345;
  const room = (await colyseus.createRoom("world", { bots: 10, difficulty: "hard" })) as unknown as WorldRoom;
  let seconds = 0;
  while (room.state.phase !== "over" && seconds < 4 * 60 * 60) { room.update(0.1); seconds += 0.1; }
  console.log(`ten bots: ${room.state.winner} won after ${(seconds / 60).toFixed(1)} game minutes`);
  expect(room.state.phase).toBe("over");
  expect(room.state.winner).toMatch(/^bot\d+$/);
  await wait(1200);
});

it("tick time stays healthy with 99 bots", async () => {
  WorldRoom.testSeed = 99;
  const room = (await colyseus.createRoom("world", { bots: 99 })) as unknown as WorldRoom;
  expect(bots(room).length).toBe(99);
  room.update(0.1); // the first tick, when everyone spells at once, is counted too
  for (let i = 0; i < 600; i++) room.update(0.1);
  console.log(`99 bots: worst tick ${room.metrics.tickMsMax.toFixed(1)} ms, average ${(room.metrics.tickMsTotal / room.metrics.ticks).toFixed(2)} ms`);
  expect(room.metrics.tickMsMax).toBeLessThan(100);
});
