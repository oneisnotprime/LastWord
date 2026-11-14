import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { dealKits, KIT_SECONDS, STARTING_HAND, sealedLetters } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; WorldRoom.kits = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.kits = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const TYPES = ["letters", "notice", "loadout", "refused", "spelled", "got", "kits", "kit", "legend", "offers", "gathering", "gathered", "hits", "sensed", "described", "dead", "won", "roundover"];

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

it("a person joins to three different kits and cannot spell or walk until they pick", async () => {
  const { clients, me, of } = await world();
  const offer = of(0, "kits")[0];
  expect(offer.cards).toHaveLength(3);
  expect(new Set(offer.cards.map((c: any) => c.job.word)).size).toBe(3);
  expect(new Set(offer.cards.map((c: any) => c.building.word)).size).toBe(3);
  expect(new Set(offer.cards.map((c: any) => c.legend.word)).size).toBe(3);
  expect(offer.seconds).toBe(KIT_SECONDS);
  for (const c of offer.cards) {
    expect(c.letters).toHaveLength(STARTING_HAND);
    expect(c.job.lines.length).toBeGreaterThan(0);
    expect(c.legend.unlock).toMatch(/\w/);
  }
  const at = { ...me().player };
  clients[0].send("move", { x: at.x + 5, y: at.y });
  clients[0].send("spell", "dog");
  await wait();
  expect(of(0, "refused").at(-1)).toMatch(/kit first/);
  expect(me().target).toBeNull();
});

it("picking a kit gives its job, hand and building, and seals its legendary", async () => {
  const { r, clients, me, of } = await world();
  const card = of(0, "kits")[0].cards[1];
  clients[0].send("kit", 1);
  await wait();
  const w = me();
  expect(w.picking).toBeUndefined();
  expect(w.kit.job.word).toBe(card.job.word);
  const hand = Object.entries(w.letters).flatMap(([ch, n]: [string, any]) => Array(n).fill(ch)).sort().join("");
  expect(hand).toBe(card.letters);
  // The building stands at their spawn, theirs.
  const mine = [...r.state.things.values()].filter((t: any) => t.owner === clients[0].sessionId).map((t: any) => t.phrase);
  expect(mine.join(" ").toLowerCase()).toContain(card.building.word);
  const kit = of(0, "kit").at(-1);
  expect(kit.job).toBe(card.job.word);
  expect(kit.legend.word).toBe(card.legend.word);
  expect(kit.legend.state).toBe("sealed");
});

it("nobody who leaves the kits alone is kept waiting: the best is picked when time runs out", async () => {
  const { room, me } = await world();
  for (let i = 0; i < KIT_SECONDS + 2; i++) room.update(1);
  await wait();
  expect(me().picking).toBeUndefined();
  expect(me().kit).toBeTruthy();
});

it("a job acts through shared systems: a scout sees further, a farmer forages better, a merchant pays less", async () => {
  const { r, clients, me } = await world();
  const id = clients[0].sessionId, w = me();
  const wear = (job: string) => {
    w.kit = undefined;
    w.picking = { kits: [{ job, building: "well", legend: "titan", hand: { d: 1, o: 1, g: 1, e: 5 } }], until: Infinity };
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

it("a legendary unseals when its condition is met, is announced to everyone, and is spelled free once", async () => {
  const { r, room, clients, me, of } = await world(2);
  clients[0].send("kit", 0); clients[1].send("kit", 0); await wait();
  const w = me();
  // Make the first kit's legendary one unsealed by paying its letters.
  const dragon = r.kitData.legendaries.find((l: any) => l.word === "phoenix") ?? r.kitData.legendaries.find((l: any) => l.unlock.kind === "letters");
  w.kit.legend = dragon; w.kit.state = "sealed"; w.kit.shown = "";
  const pay = sealedLetters(dragon.word);
  for (const ch of pay) w.letters[ch] = (w.letters[ch] ?? 0) + 1;
  room.update(1.1); await wait();
  expect(of(0, "kit").at(-1).legend.have).toBe(pay.length);
  clients[0].send("unseal"); await wait();
  expect(w.kit.state).toBe("open");
  expect(of(1, "legend").at(-1)).toMatchObject({ word: dragon.word, spelled: false });
  // Free: no letters of its own needed.
  for (const ch of dragon.word) w.letters[ch] = 0;
  clients[0].send("spell", dragon.word); await wait();
  expect(of(0, "spelled").at(-1)).toMatch(new RegExp(dragon.word.toUpperCase()));
  expect(w.kit.state).toBe("used");
  expect(of(1, "legend").at(-1)).toMatchObject({ word: dragon.word, spelled: true });
  // Only once.
  clients[0].send("spell", dragon.word); await wait();
  expect(of(0, "refused").at(-1)).toMatch(/You need/);
});

it("a legendary with a time condition unseals on the round clock", async () => {
  const { r, room, clients, me, of } = await world();
  clients[0].send("kit", 0); await wait();
  const w = me();
  w.kit.legend = { word: "titan", unlock: { kind: "minutes", need: 1 }, counter: "chain" }; w.kit.state = "sealed";
  for (let i = 0; i < 62; i++) room.update(1);
  await wait();
  expect(w.kit.state).toBe("open");
  expect(of(0, "legend").at(-1).word).toBe("titan");
  void r;
});

it("bots pick their kits at once", async () => {
  const { r } = await world(1, { bots: 3 });
  const bots = [...r.walkers.entries()].filter(([id]: [string, any]) => id.startsWith("bot"));
  expect(bots.length).toBe(3);
  for (const [, b] of bots) { expect(b.kit).toBeTruthy(); expect(b.picking).toBeUndefined(); }
});

it("bots pick kits by difficulty, unseal and spell their legendary, and counter an enemy's", async () => {
  const { room, r } = await world(0, { bots: 2, difficulty: "hard" });
  const ids = [...r.bots.keys()] as string[];
  const [a, b] = ids.map((id) => r.walkers.get(id));
  for (const w of [a, b]) expect(w.kit).toBeTruthy();
  // Hard bots take the best of three (shared kitScore, a legendary they unseal by playing counting more).
  const kits = dealKits(r.kitData, r.dict, () => 0.3);
  const best = r.botKit(kits, "hard");
  for (let i = 0; i < 3; i++) expect(r.botKit(kits, "hard")).toBe(best);
  // A's legendary open: it spells it at once.
  a.kit.state = "open";
  r.bots.get(ids[0]).nextSpell = 0;
  r.bots.get(ids[0]).peaceUntil = 0;
  r.thinkBot(ids[0], a, r.bots.get(ids[0]));
  expect(r.bots.get(ids[0]).used.legendary, JSON.stringify(r.bots.get(ids[0]).used)).toBe(1);
  expect(a.kit.state).toBe("used");
  // B, beside A's legendary with the letters of its counter-word, spells the counter.
  const legend = a.kit.legend;
  const creature = [...r.walkers.values()].find((c: any) => c.master === ids[0] && c.body.noun === legend.word);
  const area = [...r.areas.values()].find((z: any) => z.word === legend.word);
  expect(creature || area).toBeTruthy();
  const at = creature ? creature.player : area;
  b.player.x = at.x + 2; b.player.y = at.y;
  b.letters = Object.fromEntries([...legend.counter].map((ch: string) => [ch, 3]));
  const mind = r.bots.get(ids[1]);
  Object.assign(mind, { nextSpell: 0, peaceUntil: 1e9 });
  expect(r.botCounter(ids[1], b, mind, (await import("./bots.js")).held(b.letters), [])).toBe("counter");
  void room;
});
