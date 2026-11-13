import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { parsePhrase, resolve } from "@lastword/shared";
import appConfig from "./app.config.js";
import { loadDictionary } from "./data.js";
import type { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });

const dict = loadDictionary();
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));

async function twoPlayers() {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const said: unknown[] = [];
  for (const c of [a, b]) for (const t of ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered"]) c.onMessage(t, () => {});
  a.onMessage("spelled", (m: unknown) => said.push(m));
  a.onMessage("refused", (m: unknown) => said.push(m));
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 1.5; wb.player.y = c.y + 0.5;
  wa.letters = all(); wb.letters = all();
  for (const w of [wa, wb]) { w.hp = 1e9; room.rebuild(w); }
  const mine = () => [...walkers.values()].filter((w) => w.master === a.sessionId);
  return { room, a, b, wa, wb, said, walkers, mine };
}

it("QUICKLY RUN lasts half as long as RUN and is faster while it lasts", async () => {
  const { a, wa, said } = await twoPlayers();
  a.send("spell", "run"); await wait();
  expect(said.at(-1)).toBe("RUN for 30 seconds");
  const run = wa.speed;
  expect(run).toBe(10);
  a.send("spell", "quickly run"); await wait();
  expect(said.at(-1)).toBe("QUICKLY RUN for 15 seconds");
  expect(wa.buffs.map((b: any) => b.word)).toEqual(["quickly run"]); // it replaces the plain RUN
  expect(wa.speed).toBeCloseTo(5 * 2 ** 1.5);
  expect(wa.speed).toBeGreaterThan(run);
  expect(wa.player.gear).toBe("QUICKLY RUN");
  const letters = wa.letters.q;
  a.send("spell", "forever fly"); await wait();
  expect(said.at(-1)).toBe("FOREVER FLY forever");
  expect(wa.letters.q).toBe(letters);
  expect(wa.flying).toBe(true);
});

it("an adverb alone, before a noun or doubled up is refused, and costs nothing", async () => {
  const { a, wa, said } = await twoPlayers();
  a.send("spell", "quickly"); await wait();
  expect(said.at(-1)).toBe("QUICKLY says how you do something: follow it with a verb, as in QUICKLY RUN");
  a.send("spell", "quickly sword"); await wait();
  expect(said.at(-1)).toBe("QUICKLY goes with a verb, not with SWORD");
  a.send("spell", "quickly slowly run"); await wait();
  expect(said.at(-1)).toBe("RUN takes 1 adverb, not 2");
  a.send("spell", "big run"); await wait();
  expect(said.at(-1)).toBe("RUN is something you do; it takes an adverb, not BIG");
  expect(wa.letters).toEqual(all());
});

it("CATS gives three cats that follow you and costs one more S than CAT", async () => {
  const { room, a, wa, said, mine } = await twoPlayers();
  a.send("spell", "cat"); await wait();
  expect(said.at(-1)).toBe("CAT is with you");
  expect(wa.letters.s).toBe(99);
  a.send("spell", "cats"); await wait();
  expect(said.at(-1)).toBe("CATS (3) are with you");
  expect(wa.letters.s).toBe(98);
  expect(wa.letters.c).toBe(97);
  expect(mine().map((w) => w.player.name)).toEqual(["cat", "cat", "cat", "cat"]);
  expect(mine().every((w) => w.player.count === 1)).toBe(true);
  a.send("move", { x: wa.player.x, y: wa.player.y + 4 }); await wait();
  for (let i = 0; i < 40; i++) room.update(0.1);
  for (const cat of mine()) expect(Math.hypot(cat.player.x - wa.player.x, cat.player.y - wa.player.y)).toBeLessThanOrEqual(2.5);
});

it("TEN WOLVES gives ten wolves; a WOLF comes as its pack", async () => {
  const { a, said, mine } = await twoPlayers();
  a.send("spell", "ten wolves"); await wait();
  expect(said.at(-1)).toBe("TEN WOLVES (10) are with you");
  expect(mine().length).toBe(10);
  expect(mine().every((w) => w.player.name === "wolf")).toBe(true);
  a.send("spell", "wolf"); await wait();
  expect(mine().length).toBe(14);
});

it("THOUSAND ANTS is one swarm of a thousand, with a thousand ants' integrity and bite", async () => {
  const { room, a, said, mine } = await twoPlayers();
  a.send("spell", "thousand ants"); await wait();
  expect(said.at(-1)).toBe("THOUSAND ANTS (1000) are with you");
  expect(mine().length).toBe(1);
  const [swarm] = mine();
  expect(swarm.player.name).toBe("ant");
  expect(swarm.player.count).toBe(1000);
  const ant = resolve(dict, "ant");
  expect(swarm.unit.body.stats.num("integrity")).toBeCloseTo(ant.num("integrity") * 1000);
  expect(swarm.unit.body.stats.num("mass")).toBeCloseTo(ant.num("mass") * 1000);
  expect(swarm.unit.attack.num("dmg_acid")).toBeCloseTo(ant.num("dmg_acid") * 1000);
  expect(swarm.hp).toBeCloseTo(1000);
  expect(room.state.players.get(swarm.id)!.count).toBe(1000);

  // Many things on the ground are one stack: twenty arrows lie as one thing with a count.
  a.send("spell", "hundred apple"); await wait();
  const apples = [...room.state.things.values()].filter((t) => t.phrase === "apple");
  expect(apples.length).toBe(1);
  expect(apples[0]!.count).toBe(100);
});

it("MILLION ANTS and a MILLION LAKES neither crash nor stall the tick", async () => {
  const { room, a, b, wa, wb, said, mine } = await twoPlayers();
  let started = performance.now();
  a.send("spell", "million ants"); await wait();
  expect(said.at(-1)).toBe("MILLION ANTS (1000000) are with you");
  const [swarm] = mine();
  expect(swarm.player.count).toBe(1e6);
  expect(swarm.unit.body.stats.num("integrity")).toBeCloseTo(1e6);
  // The swarm goes for B.
  a.send("attack", b.sessionId); await wait();
  room.metrics.tickMsMax = 0;
  for (let i = 0; i < 50; i++) room.update(0.1);
  expect(wb.hp).toBeLessThan(1e9);
  expect(room.metrics.tickMsMax).toBeLessThan(50);
  a.send("attack", null); await wait();
  // A million lakes is one lake a thousand times as wide, laid over the whole map at once.
  wa.player.x += 10;
  started = performance.now();
  a.send("spell", "million lakes");
  for (let i = 0; i < 100 && !String(said.at(-1)).includes("LAKES"); i++) await wait(10);
  console.log(`MILLION LAKES answered in ${Math.round(performance.now() - started)} ms`);
  expect(String(said.at(-1))).toMatch(/^MILLION LAKES \(1000000\) made/);
  room.metrics.tickMsMax = 0;
  for (let i = 0; i < 20; i++) room.update(0.1);
  expect(room.metrics.tickMsMax).toBeLessThan(100);
  expect(performance.now() - started).toBeLessThan(5000);
  expect(wa).toBeDefined();
});

it("casts every verb in the dictionary without error, and counts how many do something", async () => {
  const verbs = [...dict.words].filter(([, d]) => d.role === "verb").map(([w]) => w);
  expect(verbs.length).toBeGreaterThan(250);
  const { room, a, wa, wb, said } = await twoPlayers();
  const c = room.map.cities[0]!;
  const idle: string[] = [], other: string[] = [];
  for (const verb of verbs) {
    // Something to act on: a dog of B's for verbs that touch a creature, an unguarded chair of B's for ones that take things.
    const s = parsePhrase(dict, verb).stats;
    let target: string;
    if (s.flag("transfers_ownership")) {
      target = room.addThing({ spelled: { noun: "chair" }, phrase: "chair", vehicle: false, integrity: null }, wb.id, wa.player.x + 0.5, wa.player.y);
    } else {
      target = room.addCreature({ spelled: { noun: "dog" }, phrase: "dog", vehicle: false, integrity: null }, wb.id, wa.player.x + 0.5, wa.player.y);
    }
    const before = said.length;
    a.send("pick", { id: target });
    a.send("spell", verb);
    for (let i = 0; i < 50 && said.length === before; i++) await wait(10);
    const m = String(said.at(-1));
    if (/does nothing yet/.test(m)) idle.push(verb);
    else if (said.length === before || /You need|Select|Too far|guarded|sees you|not /.test(m)) other.push(`${verb}: ${m}`);
    room.update(0.1);
    // Each verb is tried on its own.
    wa.letters = all(); wa.buffs = []; wa.statuses = []; (room as any).statusChanged(wa); room.rebuild(wa);
    wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5; wa.target = null; wa.foe = null;
    if (room.state.players.has(target)) (room as any).kill(target, "");
    if (room.state.things.has(target)) room.removeThing(target);
  }
  console.log(`verbs: ${verbs.length}; do something: ${verbs.length - idle.length - other.length}; do nothing yet (${idle.length}): ${idle.join(" ")}`);
  expect(other).toEqual([]);
  expect(said.length).toBe(verbs.length);
  expect(idle.length).toBeLessThan(verbs.length * 0.05);
}, 60_000);
