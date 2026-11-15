import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { dealKits, KIT_SECONDS, STARTING_HAND } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; WorldRoom.kits = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.kits = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
/** Picks the same choice at each of the three steps: job, building, letters. */
const pickAll = (c: any, index: number) => { for (let step = 0; step < 3; step++) c.send("kit", { step, index }); };
const TYPES = ["letters", "notice", "loadout", "refused", "spelled", "got", "kits", "kit", "offers", "gathering", "gathered", "hits", "sensed", "described", "dead", "won", "roundover"];

async function world(people = 1, options: object = {}) {
  WorldRoom.testSeed = 91;
  const room = (await colyseus.createRoom("world", options)) as unknown as WorldRoom;
  const r = room as any;
  const clients: any[] = [], inbox: [string, any][][] = [];
  for (let i = 0; i < people; i++) {
    const c: any = await colyseus.connectTo(room as never);
    const box: [string, any][] = [];
    for (const t of TYPES) c.onMessage(t, (m: any) => box.push([t, m]));
    clients.push(c); inbox.push(box);
    c.send("ready");
  }
  await wait();
  const me = (i = 0) => r.walkers.get(clients[i].sessionId);
  const of = (i: number, t: string) => inbox[i]!.filter(([k]) => k === t).map(([, m]) => m);
  return { room, r, clients, me, of };
}

it("a person picks a job, a building and letters in turn, and cannot spell, walk or be hurt until done", async () => {
  const { clients, me, of } = await world();
  const offer = of(0, "kits")[0];
  expect(offer.step).toBe(0);
  expect(offer.options).toHaveLength(3);
  expect(new Set(offer.options.map((o: any) => o.word)).size).toBe(3);
  expect(offer.seconds).toBe(KIT_SECONDS);
  for (const o of offer.options) expect(o.lines.length).toBeGreaterThan(0);
  expect(me().hamper.untouchable).toBe(true);
  const at = { ...me().player };
  clients[0].send("move", { x: at.x + 5, y: at.y });
  clients[0].send("spell", "dog");
  await wait();
  expect(of(0, "refused").at(-1)).toMatch(/kit first/);
  expect(me().target).toBeNull();
  // A pick for a step already past is ignored.
  clients[0].send("kit", { step: 0, index: 2 }); clients[0].send("kit", { step: 0, index: 1 });
  await wait();
  const steps = of(0, "kits");
  expect(steps.at(-1).step).toBe(1);
  expect(steps.at(-1).chosen).toEqual([offer.options[2].word]);
  clients[0].send("kit", { step: 1, index: 0 }); await wait();
  const hands = of(0, "kits").at(-1);
  expect(hands.step).toBe(2); // no legendary step: legendaries are ordinary words
  for (const o of hands.options) expect(o.letters).toHaveLength(STARTING_HAND);
  expect(me().hamper.untouchable).toBe(true);
  clients[0].send("kit", { step: 2, index: 1 }); await wait();
  expect(me().picking).toBeUndefined();
  expect(me().hamper.untouchable).toBe(false);
  expect(me().kit.job.word).toBe(offer.options[2].word);
});

it("picking a kit gives its job, hand and building", async () => {
  const { r, clients, me, of } = await world();
  const job = of(0, "kits")[0].options[1].word;
  clients[0].send("kit", { step: 0, index: 1 }); await wait();
  const building = of(0, "kits").at(-1).options[1].word;
  clients[0].send("kit", { step: 1, index: 1 }); await wait();
  const letters = of(0, "kits").at(-1).options[1].letters;
  clients[0].send("kit", { step: 2, index: 1 }); await wait();
  const w = me();
  expect(w.picking).toBeUndefined();
  expect(w.kit.job.word).toBe(job);
  const hand = Object.entries(w.letters).flatMap(([ch, n]: [string, any]) => Array(n).fill(ch)).sort().join("");
  expect(hand).toBe(letters);
  // The building stands at their spawn, theirs.
  const mine = [...r.state.things.values()].filter((t: any) => t.owner === clients[0].sessionId).map((t: any) => t.phrase);
  expect(mine.join(" ").toLowerCase()).toContain(building);
  const kit = of(0, "kit").at(-1);
  expect(kit.job).toBe(job);
  expect(kit.building).toBe(building);
  expect(kit.legend).toBeUndefined();
});

it("nobody who leaves the kits alone is kept waiting: the best is picked at each step when time runs out", async () => {
  const { room, me } = await world();
  for (let i = 0; i < 3 * (KIT_SECONDS + 1) + 2; i++) room.update(1);
  await wait();
  expect(me().picking).toBeUndefined();
  expect(me().kit).toBeTruthy();
});

it("a job acts through shared systems: a scout sees further, a farmer forages better, a merchant pays less", async () => {
  const { r, clients, me } = await world();
  const id = clients[0].sessionId, w = me();
  const wear = (job: string) => {
    w.kit = undefined;
    w.picking = { kits: [{ job, building: "well", hand: { d: 1, o: 1, g: 1, e: 5 } }], until: Infinity };
    r.chooseKit(id, w, 0);
  };
  wear("scout");
  expect(w.unit.body.stats.num("sight_range")).toBeCloseTo(60 * 1.5);
  wear("farmer");
  expect(r.helpOf(w)("forage").some((h: any) => h.by === "farmer" && h.chance > 0.15)).toBe(true);
  expect(w.unit.body.stats.num("sight_range")).toBeCloseTo(60);
  wear("merchant");
  expect(r.rulesAt(w.player, id, w).rules.some((x: any) => x.tradeRate === 0.75)).toBe(true);
});

it("bots pick their kits at once", async () => {
  const { r } = await world(1, { bots: 3 });
  const bots = [...r.walkers.entries()].filter(([id]: [string, any]) => id.startsWith("bot"));
  expect(bots.length).toBe(3);
  for (const [, b] of bots) { expect(b.kit).toBeTruthy(); expect(b.picking).toBeUndefined(); }
});

it("bots pick kits by difficulty", async () => {
  const { r } = await world(0, { bots: 2, difficulty: "hard" });
  const ids = [...r.bots.keys()] as string[];
  for (const w of ids.map((id) => r.walkers.get(id))) expect(w.kit).toBeTruthy();
  // Hard bots take the best of three (shared kitScore).
  const kits = dealKits(r.kitData, r.dict, () => 0.3);
  const best = r.botKit(kits, "hard");
  for (let i = 0; i < 3; i++) expect(r.botKit(kits, "hard")).toBe(best);
});
