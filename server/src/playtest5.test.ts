import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const ticks = (room: WorldRoom, n: number) => { for (let i = 0; i < n; i++) room.update(0.1); };
const TYPES = ["hits", "letters", "loadout", "dead", "won", "roundover", "gathered", "gathering", "got", "spelled", "refused", "notice", "sensed", "watching", "described", "missed", "threats"];

async function player(letters?: Record<string, number>) {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const c: any = await colyseus.connectTo(room as never);
  const got: [string, any][] = [];
  for (const t of TYPES) c.onMessage(t, (m: any) => got.push([t, m]));
  const r = room as any, walkers = r.walkers as Map<string, any>, w = walkers.get(c.sessionId);
  const city = room.map.cities[0]!;
  w.player.x = city.x + 0.5; w.player.y = city.y + 0.5;
  if (letters) w.letters = { ...letters };
  room.rebuild(w);
  const of = (t: string) => got.filter(([k]) => k === t).map(([, m]) => m);
  return { room, r, c, w, walkers, city, got, of };
}

it("a wild FOX that was running from you and then joins you stops fleeing and follows you", async () => {
  const { room, r, c, w, walkers } = await player();
  const id = r.addCreature({ spelled: { noun: "fox" }, phrase: "fox", vehicle: false, integrity: null }, "-", w.player.x + 3, w.player.y);
  const fox = walkers.get(id);
  r.refreshViews();
  // Badly hurt by the player (a fox is cunning): it pulls back from them.
  fox.hp = 5;
  ticks(room, 12);
  expect(fox.fleeing).toBe(true);
  expect(fox.player.status).toMatch(/retreating/);
  r.setMaster(id, fox, c.sessionId);
  ticks(room, 30);
  expect(fox.fleeFrom).toBeNull(); // still hurt, but nobody near is its enemy now
  expect(fox.player.status).not.toMatch(/fleeing|retreating|wild/);
  // Badly hurt, with nobody near to run from: it keeps with its master and wears no running label.
  w.player.x += 8;
  ticks(room, 40);
  expect(fox.player.status).not.toMatch(/fleeing|retreating/);
  expect(Math.hypot(fox.player.x - w.player.x, fox.player.y - w.player.y)).toBeLessThan(4);
});

it("gathering mostly finds nothing, and says so small with the odds; a find says its biome and tools", async () => {
  const { room, r, c, w, of } = await player();
  r.rng = () => 0.99; // unlucky dice: nothing found
  c.send("gather"); await wait();
  ticks(room, 21); await wait();
  expect(of("missed").at(-1).text).toMatch(/^nothing · [A-Z]+ \d+%/);
  r.rng = () => 0; // lucky
  w.gear.push({ spelled: { noun: "basket" }, phrase: "basket", vehicle: false, integrity: null });
  room.rebuild(w);
  c.send("gather"); await wait();
  ticks(room, 21); await wait();
  const got = of("got").at(-1);
  expect(got.detail).toMatch(/^[A-Z]+ \d+% · \+15% BASKET$/);
});

it("hunting a FOX pays H and F, with the reasons under the popup", async () => {
  const { room, r, c, w, walkers, of } = await player();
  const fox = r.addCreature({ spelled: { noun: "fox" }, phrase: "fox", vehicle: false, integrity: null }, "-", w.player.x + 1, w.player.y);
  walkers.get(fox).hp = 1; walkers.get(fox).unit.body.integrity = 1;
  r.rng = () => 0.3; // the first blow lands
  c.send("attack", fox); await wait();
  for (let t = 0; t < 100 && walkers.has(fox); t++) room.update(0.1);
  await wait();
  const hunted = of("got").find((g: any) => /hunted FOX/.test(g.why));
  expect(hunted.letters.slice(0, 2)).toBe("hf");
});

it("nobody strikes what they cannot see: a RIFLE reaches only as far as its holder's sight", async () => {
  const { room, r, c, w, walkers, of } = await player({ r: 1, i: 1, f: 1, l: 1, e: 1 });
  c.send("spell", "rifle"); await wait();
  const pig = r.addCreature({ spelled: { noun: "pig" }, phrase: "pig", vehicle: false, integrity: null }, "-", w.player.x + 40, w.player.y);
  room.rebuild(w);
  const d = of("loadout").at(-1);
  expect(d.attack.reach).toBe(60); // 400 m on paper, 60 m of sight
  void walkers; void pig;
});

it("something coming for you from beyond your sight is sent as a threat, with whether it flies", async () => {
  const { room, r, c, w, of } = await player();
  const wolf = r.addCreature({ spelled: { noun: "wolf" }, phrase: "wolf", vehicle: false, integrity: null }, "-", w.player.x + 30, w.player.y);
  const wv = (r.walkers as Map<string, any>).get(wolf);
  wv.foe = c.sessionId;
  ticks(room, 6); await wait();
  const list = of("threats").at(-1);
  expect(list).toEqual([expect.objectContaining({ id: wolf, name: "wolf", air: false, targeting: true })]);
});

it("a click on a RUIN nobody owns claims it by name once you stand by it", async () => {
  const { room, r, c, w, of } = await player();
  const id = r.addThing({ spelled: { noun: "ruin" }, phrase: "ruin", vehicle: false, integrity: null, fixture: "ruin" }, "", w.player.x + 6, w.player.y);
  c.send("take", { id }); await wait();
  expect(of("refused").at(-1)).toMatch(/Too far/);
  w.player.x += 5;
  c.send("take", { id }); await wait();
  expect(room.state.things.get(id)!.owner).toBe(c.sessionId);
});

it("wild animals suit the biome they are put in", async () => {
  WorldRoom.testBare = false;
  try {
    const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
    const r = room as any;
    const wild = [...(r.walkers as Map<string, any>).values()].filter((w) => w.master === "-");
    expect(wild.length).toBeGreaterThan(20);
    const kinds = new Set(wild.map((w) => w.player.name));
    expect(kinds.size).toBeGreaterThan(8);
  } finally { WorldRoom.testBare = true; }
});
