import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { nearestWalkable, parsePhrase, statusSeconds } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Playtest batch 2 (the live build): ghosts that locked the living down, stun-locks, the storm and
// armour, grand words, racks, clutter and bugs. Each fix is a rule; these check them in a room.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = (n = 9) => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, n]));

async function setup(people = 2) {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const R = room as any;
  const clients: any[] = [];
  for (let i = 0; i < people; i++) clients.push(await colyseus.connectTo(room as never));
  const got = clients.map(() => [] as [string, any][]);
  clients.forEach((c, i) => {
    for (const t of ["letters", "loadout", "dead", "spelled", "refused", "notice", "watching", "ghost", "got"]) c.onMessage(t, (m: any) => got[i]!.push([t, m]));
  });
  const walkers = R.walkers as Map<string, any>;
  const ws = clients.map((c) => walkers.get(c.sessionId));
  const c = room.map.cities[0]!;
  ws.forEach((w, i) => { w.letters = all(); w.player.x = c.x + 0.5 + i * 2; w.player.y = c.y + 0.5; });
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const said = (i: number, type: string) => got[i]!.filter(([t]) => t === type).map(([, m]) => String(typeof m === "string" ? m : JSON.stringify(m)));
  return { room, R, clients, ws, got, second, said, walkers };
}

it("a ghost's LULLABY puts nobody to sleep, stays where it fell, gives way to its next haunting, and never reaches indoors", async () => {
  const { R, clients: [a, b, c], ws: [wa, , wc], said } = await setup(3);
  R.kill(b.sessionId, a.sessionId); await wait();
  const ghost = R.ghosts.get(b.sessionId);
  ghost.next = 0;
  ghost.proxy.player.x = wa.player.x + 1; ghost.proxy.player.y = wa.player.y;
  b.send("pick", { id: a.sessionId }); b.send("spell", "lullaby"); await wait();
  expect(said(1, "spelled").at(-1)).toMatch(/Ghost: LULLABY/);
  const first = [...R.areas].filter(([, x]: [string, any]) => x.owner === b.sessionId);
  expect(first.length).toBe(1);
  expect(first[0]![1].ghost).toBe(true);
  expect(first[0]![1].follows).toBeNull();
  for (let i = 0; i < 30; i++) R.update(0.1);
  expect(wa.statuses.some((s: any) => s.status === "sleep")).toBe(false);
  // Indoors and hidden: the ghost's areas do not reach them.
  wc.player.x = first[0]![1].x; wc.player.y = first[0]![1].y; wc.inside = "somehouse";
  expect(R.reaches(first[0]![1], c.sessionId, wc)).toBe(false);
  wc.inside = undefined;
  expect(R.reaches(first[0]![1], c.sessionId, wc)).toBe(true);
  // A ghost haunts one place at a time.
  ghost.next = 0;
  b.send("pick", { id: a.sessionId }); b.send("spell", "fatigue"); await wait();
  const now = [...R.areas.values()].filter((x: any) => x.owner === b.sessionId);
  expect(now.map((x: any) => x.word)).toEqual(["fatigue"]);
});

it("a ghost's word on someone says whose ghost it is in their loadout, for the 'what is stopping me' line", async () => {
  const { R, clients: [a, b], ws: [wa], got } = await setup(3);
  R.kill(b.sessionId, a.sessionId); await wait();
  const ghost = R.ghosts.get(b.sessionId);
  ghost.next = 0;
  ghost.proxy.player.x = wa.player.x + 1; ghost.proxy.player.y = wa.player.y;
  b.send("pick", { id: a.sessionId }); b.send("spell", "boo"); await wait();
  R.tell(wa); R.update(0.1); await wait();
  const last = got[0]!.filter(([t]) => t === "loadout").at(-1)?.[1];
  expect(last.statuses.find((s: any) => s.status === "fear")?.by).toMatch(/'s ghost$/);
});

it("a worn HELMET keeps off stuns; without one a stun cannot be refreshed while it is on and leaves a resistance", async () => {
  const { R, clients: [a, b], ws: [wa, wb] } = await setup(2);
  a.send("spell", "helmet"); await wait();
  expect(wa.unit.body.stats.flag("immune_stun")).toBe(true);
  R.hurtWith(wa, [["stun", 3]], b.sessionId, b.sessionId, true);
  expect(wa.statuses.some((s: any) => s.status === "stun")).toBe(false);
  R.hurtWith(wb, [["stun", 1]], a.sessionId, a.sessionId, true);
  const left = wb.statuses.find((s: any) => s.status === "stun")!.left;
  R.hurtWith(wb, [["stun", 5]], a.sessionId, a.sessionId, true);
  expect(wb.statuses.find((s: any) => s.status === "stun")!.left).toBe(left);
  for (let i = 0; i < Math.ceil(left * 10) + 2; i++) R.update(0.1);
  expect(wb.statuses.some((s: any) => s.status === "stun")).toBe(false);
  R.hurtWith(wb, [["stun", 1]], a.sessionId, a.sessionId, true);
  expect(wb.statuses.some((s: any) => s.status === "stun")).toBe(false); // resisting
  expect(statusSeconds("stun", 1)).toBeGreaterThan(1);
});

it("a wide STORM strikes as often as its word says, however many stand in it (not a cell for each of them)", async () => {
  const { R, room, ws } = await setup(6);
  const s = parsePhrase(R.dict, "storm").stats;
  const area = R.fieldArea("storm", s, R.dict.word("storm"), "nobody", ws[0].player, null);
  area.armed = 0;
  const key = R.addArea(area, true);
  let cells = 0;
  const cellAt = R.cellAt.bind(room);
  R.cellAt = (...args: unknown[]) => { cells++; return cellAt(...args); };
  for (let i = 0; i < 1200; i++) R.update(0.1); // two minutes
  // 0.05 strikes a second: about six in two minutes, where six people used to draw sixty.
  expect(cells).toBeGreaterThan(2);
  expect(cells).toBeLessThan(12);
  void key;
});

it("the death recap's headline names what did the most harm, as its first line does", async () => {
  const { R, clients: [a, b], ws: [, wb] } = await setup(2);
  wb.harm = [
    { who: "", what: "WOLF", kind: "pierce", amount: 144, t: R.elapsed - 2 },
    { who: "", what: "CITIZEN", kind: "pierce", amount: 15, t: R.elapsed - 0.1 },
  ];
  const r = R.recap(wb, a.sessionId);
  expect(r.what).toBe("WOLF");
  expect(r.top[0].what).toBe("WOLF");
  void b;
});

it("a body killed far away feeds nobody: no meat and no stores across the map", async () => {
  const { R, clients: [a], ws: [wa] } = await setup(1);
  const far = R.addCreature({ spelled: { noun: "cow" }, phrase: "cow", vehicle: false, integrity: null }, "-", wa.player.x + 40, wa.player.y);
  const near = R.addCreature({ spelled: { noun: "cow" }, phrase: "cow", vehicle: false, integrity: null }, "-", wa.player.x + 1, wa.player.y);
  const before = wa.stores.food;
  R.kill(far, a.sessionId);
  expect(wa.stores.food).toBe(before);
  R.kill(near, a.sessionId);
  expect(wa.stores.food).toBeGreaterThan(before);
});

it("a grand word costs earned letters besides its own: a TITAN wants a K and a Z", async () => {
  const { clients: [a], ws: [wa], said } = await setup(1);
  wa.letters = { t: 2, i: 1, a: 1, n: 1 };
  a.send("spell", "titan"); await wait();
  expect(said(0, "refused").at(-1)).toMatch(/No K Z|You need K Z/);
  wa.letters = { t: 2, i: 1, a: 1, n: 1, k: 1, z: 1 };
  a.send("spell", "titan"); await wait();
  expect(Object.values(wa.letters).every((n) => n === 0)).toBe(true);
});

it("on your own claim you can trade at home: a letter dearer than a market, and no T", async () => {
  const { R, room, clients: [a], ws: [wa], said } = await setup(1);
  // Away from any market, on ground one can stand on.
  const markets = [...R.markets.keys()].map((id: string) => room.state.things.get(id)!);
  let spot = { x: 0, y: 0 };
  for (let y = 10; y < room.map.size - 10 && !spot.x; y += 7) for (let x = 10; x < room.map.size - 10; x += 7) {
    const p = nearestWalkable(room.map, { x, y });
    if (markets.every((m: any) => Math.hypot(m.x - p.x, m.y - p.y) > 20)) { spot = p; break; }
  }
  wa.player.x = spot.x; wa.player.y = spot.y;
  a.send("spell", "trade eeee for o"); await wait();
  expect(said(0, "refused").at(-1)).toMatch(/MARKET/);
  a.send("spell", "home"); await wait();
  expect(said(0, "refused").join(" | ")).not.toMatch(/HOME/);
  const claim = [...R.areas.values()].find((x: any) => x.claim && x.owner === a.sessionId);
  expect(claim, JSON.stringify([wa.player.x, wa.player.y, claim?.x, claim?.y, claim?.radius])).toBeTruthy();
  expect(R.homeClaim(a.sessionId, wa), JSON.stringify([wa.player.x, wa.player.y, claim.x, claim.y, claim.radius, claim.follows])).toBeTruthy();
  wa.letters = { e: 9 };
  a.send("spell", "trade eeee for o"); await wait();
  expect(said(0, "refused").at(-1)).toMatch(/5/); // the market's 4 and one more
  a.send("spell", "trade eeeee for o"); await wait();
  expect(wa.letters.o).toBe(1);
  expect(wa.letters.t ?? 0).toBe(0);
});

it("wild animals leave a newcomer be (a RAPTOR at the spawn left a ghost at 0:13)", async () => {
  const { R, clients: [a], ws: [wa] } = await setup(1);
  wa.arrived = R.elapsed;
  const wolf = R.addCreature({ spelled: { noun: "wolf" }, phrase: "wolf", vehicle: false, integrity: null }, "-", wa.player.x + 2, wa.player.y);
  const w = R.walkers.get(wolf);
  R.roam(wolf, w);
  expect(w.foe).not.toBe(a.sessionId);
  wa.arrived = R.elapsed - 60;
  R.roam(wolf, w);
  expect(w.foe).toBe(a.sessionId);
});
