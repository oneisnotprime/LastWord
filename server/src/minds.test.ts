import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { seeded, type LoadoutDetail } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
// These rooms test other systems: no markets, ruins, animals or exploring to get in the way.
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));
const ticks = (room: WorldRoom, n: number) => { for (let i = 0; i < n; i++) room.update(0.1); };

async function twoPlayers() {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const said = { a: [] as string[], b: [] as string[] };
  const loadouts: LoadoutDetail[] = [];
  for (const c of [a, b]) for (const t of ["letters", "loadout", "dead", "won", "roundover", "gathered"]) c.onMessage(t, () => {});
  for (const [c, k] of [[a, "a"], [b, "b"]] as const) for (const t of ["spelled", "refused", "notice"]) c.onMessage(t, (m: string) => said[k].push(m));
  a.onMessage("loadout", (d: LoadoutDetail) => loadouts.push(d));
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 2.5; wb.player.y = c.y + 0.5;
  wa.letters = all(); wb.letters = all();
  for (const w of [wa, wb]) { w.hp = 1e9; room.rebuild(w); } // nobody dies: this is about minds
  const mine = (id: string) => [...walkers].filter(([, w]) => w.master === id);
  const named = (name: string) => [...walkers].filter(([, w]) => w.player.name === name || w.player.name.endsWith(` ${name}`));
  return { room, a, b, wa, wb, said, walkers, mine, named, loadouts };
}

it("FEAR drives morale to 0: the broken run from their nearest enemy and do not strike; morale climbs back", async () => {
  const { room, a, b, wa, wb, said } = await twoPlayers();
  expect(wb.morale).toBe(5);
  a.send("spell", "fear"); await wait();
  // FEAR takes 4 morale and 4 courage: a drop of 4 at courage 1 is felt five times over.
  expect(wb.morale).toBe(0);
  expect(wa.morale).toBe(5); // FEAR reaches enemies only
  // Without FEAR's own fear status, morale alone breaks B.
  const calm = () => { wb.statuses = []; (room as any).statusChanged(wb); };
  calm();
  b.send("attack", a.sessionId); await wait();
  const hp = wa.hp, start = { x: wb.player.x, y: wb.player.y };
  for (let s = 0; s < 3; s++) { ticks(room, 10); calm(); }
  expect(wb.fleeing).toBe(true);
  expect(wb.hamper.flees).toEqual([]); // it is morale, not the status, that runs
  expect(wb.player.status).toBe("fleeing");
  expect(wa.hp).toBe(hp); // B never struck
  expect(Math.hypot(wb.player.x - wa.player.x, wb.player.y - wa.player.y)).toBeGreaterThan(Math.hypot(start.x - wa.player.x, start.y - wa.player.y));
  expect(said.b).toContain("You lose your nerve and run");
  // Out of FEAR's reach (40 m), morale climbs back half a point a second.
  wb.player.x = wa.player.x + 30; wb.target = null;
  for (let s = 0; s < 3; s++) { ticks(room, 10); calm(); wb.player.x = wa.player.x + 30; }
  expect(wb.morale).toBeGreaterThan(0);
  expect(wb.morale).toBeLessThan(3);
  expect(wb.fleeing).toBe(false);
  for (let s = 0; s < 10; s++) { ticks(room, 10); wb.player.x = wa.player.x + 30; }
  expect(wb.morale).toBe(5);
  await wait();
  expect(said.b).toContain("You steady yourself");
});

it("a wild WOLF attacks a player it sees; a wild SHEEP wanders and leaves them be", async () => {
  const { room, a, wa, wb, named } = await twoPlayers();
  a.send("spell", "wolf"); await wait();
  a.send("spell", "sheep"); await wait();
  const [wolfId, wolf] = named("wolf")[0]!, [sheepId, sheep] = named("sheep")[0]!;
  for (const [id, w] of [[wolfId, wolf], [sheepId, sheep]] as const) (room as any).setMaster(id, w, "-");
  expect(wolf.player.status).toBe("wild");
  wa.player.x += 40; // A out of the way: B is the only one in sight
  wolf.player.x = wb.player.x + 1; wolf.player.y = wb.player.y;
  sheep.player.x = wb.player.x - 1; sheep.player.y = wb.player.y;
  ticks(room, 12);
  expect(wolf.foe).toBe(wb.id);
  expect(sheep.foe).toBeNull();
  const hp = wb.hp;
  ticks(room, 30);
  expect(wb.hp).toBeLessThan(hp);
});

it("a KING commands fifty more; creatures beyond the limit run wild; the KING recruits wild ones, nearest first", async () => {
  const { room, a, b, wa, wb, said, mine, walkers } = await twoPlayers();
  // Without authority: twelve. Twenty wolves leave eight wild.
  b.send("spell", "ten wolves"); await wait();
  b.send("spell", "ten wolves"); await wait();
  expect(mine(wb.id).length).toBe(12);
  expect(said.b).toContain("You can command 12 creatures: 8 ran wild");
  expect(said.b).toContain("TEN WOLVES (10) are with you; 8 ran wild");
  for (const [id, w] of [...walkers]) if (w.master === "-" || w.master === wb.id) (room as any).kill(id, ""); // clear the field

  a.send("spell", "king"); await wait();
  for (let i = 0; i < 7; i++) { a.send("spell", "ten wolves"); await wait(40); }
  await wait();
  expect(mine(wa.id).length).toBe(62); // twelve, plus the KING's fifty: the king and 61 wolves
  const wild = [...walkers.values()].filter((w) => w.master === "-");
  expect(wild.length).toBe(9);
  expect(mine(wa.id).some(([, w]) => w.player.name === "king")).toBe(true);
  for (const w of wild) (room as any).kill(w.id ?? [...walkers].find(([, x]) => x === w)![0], "");
  for (const [id] of mine(wa.id).filter(([, w]) => w.player.name === "wolf").slice(0, 3)) (room as any).kill(id, "");
  // Three free places: the KING's recruit_rate (one a minute) draws the nearest wild creature in sight.
  b.send("spell", "wolf"); await wait();
  b.send("spell", "wolf"); await wait();
  const [near, far] = mine(wb.id);
  for (const [id, w] of [near!, far!]) (room as any).setMaster(id, w, "-");
  near![1].player.x = wa.player.x + 4; near![1].player.y = wa.player.y;
  far![1].player.x = wa.player.x + 10; far![1].player.y = wa.player.y;
  room.update(60);
  expect(near![1].master).toBe(wa.id);
  expect(far![1].master).toBe("-");
  await wait();
  expect(said.a).toContain("A wild WOLF joins you");
});

it("a creature with obedience below 3 (a WILD WOLF) sometimes ignores orders; an ordinary wolf always obeys", async () => {
  const { room, a, wa, wb, named, said } = await twoPlayers();
  (room as any).rng = seeded(11);
  a.send("spell", "wild wolf"); await wait();
  const [, wolf] = named("wolf")[0]!;
  expect(wolf.unit.body.stats.num("obedience")).toBe(1);
  const orders = (w: any) => {
    let obeyed = 0;
    for (let i = 0; i < 40; i++) {
      wa.foe = wb.id; ticks(room, 1);
      if (w.foe === wb.id) obeyed++;
      wa.foe = null; ticks(room, 1);
    }
    return obeyed;
  };
  const wildObeyed = orders(wolf);
  await wait();
  // Obedience 1 of 3: two orders in three are ignored.
  expect(wildObeyed).toBeGreaterThan(4);
  expect(wildObeyed).toBeLessThan(26);
  expect(said.a).toContain("Your WILD WOLF ignores your order");
  (room as any).kill(named("wolf")[0]![0], "");
  a.send("spell", "wolf"); await wait();
  expect(orders(named("wolf")[0]![1])).toBe(40);
});

it("THEFT takes a creature only past its loyalty", async () => {
  const { room, a, b, wa, said, named } = await twoPlayers();
  b.send("spell", "wolf"); await wait();
  const [wolfId, wolf] = named("wolf")[0]!;
  wolf.player.x = wa.player.x + 1; wolf.player.y = wa.player.y;
  a.send("pick", { id: wolfId });
  a.send("spell", "theft"); await wait();
  expect(said.a.at(-1)).toBe("WOLF will not leave its master (loyalty or security 3 against your stealth 0)");
  a.send("spell", "sneak"); await wait(); // stealth 5
  wolf.player.x = wa.player.x + 1; wolf.player.y = wa.player.y;
  a.send("spell", "theft"); await wait();
  expect(said.a.at(-1)).toBe("WOLF is yours");
  expect(wolf.master).toBe(wa.id);
  expect(said.b).toContain("Your WOLF was stolen");
  void room;
});

it("a ridden DRAGON (5 food a minute) with no food goes hungry, then throws its rider and turns wild", async () => {
  const { room, a, wa, said, named, loadouts } = await twoPlayers();
  a.send("spell", "dragon"); await wait();
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["dragon"]);
  room.update(60);
  await wait();
  expect(said.a).toContain("Your DRAGON is hungry");
  expect(wa.gear.length).toBe(1);
  expect(wa.stores.food).toBe(0);
  await wait();
  expect(loadouts.at(-1)!.short).toEqual(["dragon is hungry (no food)"]);
  room.update(60); // its loyalty is 2: two hungry minutes
  await wait();
  expect(said.a).toContain("Your DRAGON went wild with hunger");
  expect(wa.gear).toEqual([]);
  const [, dragon] = named("dragon")[0]!;
  expect(dragon.master).toBe("-");
  ticks(room, 12);
  expect(dragon.foe).not.toBeNull(); // aggression 8: it turns on whoever it sees
});

it("a FARM keeps a DRAGON fed; a TANK out of fuel cannot fire until COAL fuels it", async () => {
  const { room, a, wa, wb, said, loadouts } = await twoPlayers();
  a.send("spell", "farm"); await wait();
  a.send("spell", "dragon"); await wait();
  for (let i = 0; i < 3; i++) room.update(60);
  await wait();
  expect(said.a.some((m) => /hungry/.test(m))).toBe(false);
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["dragon"]);
  expect(wa.stores.food).toBeCloseTo(2 + 3 * (10 - 5 - 0.03), 1);
  await wait();
  const d = loadouts.at(-1)!;
  expect(d.stores.food.make).toBe(10);
  expect(d.stores.food.need).toBeCloseTo(5.03);
  expect(d.short).toEqual([]);

  wa.gear = []; room.rebuild(wa);
  a.send("spell", "tank"); await wait();
  expect(wa.stores.fuel).toBeCloseTo(30); // a new TANK comes with half an hour of fuel (one a minute)
  wa.stores.fuel = 0; // and burns it
  ticks(room, 12); await wait();
  expect(said.a.find((m) => m.startsWith("TANK out of fuel"))).toMatch(/^TANK out of fuel: stopped until refuelled\. [A-Z]+( or [A-Z]+)? makes fuel\.$/);
  expect(loadouts.at(-1)!.short).toEqual(["tank out of fuel: stopped"]);
  expect(wa.speed).toBe(0); // and it goes nowhere
  const { x } = wa.player;
  a.send("move", { x: x + 5, y: wa.player.y }); await wait();
  ticks(room, 10);
  expect(wa.player.x).toBe(x);
  a.send("attack", wb.id); await wait();
  const hp = wb.hp;
  ticks(room, 30);
  expect(wb.hp).toBe(hp);
  a.send("spell", "coal"); await wait(); // two fuel a minute, the tank burns one
  ticks(room, 12); await wait();
  expect(said.a).toContain("Your TANK is working again");
  expect(wa.speed).toBeGreaterThan(0);
  a.send("stop"); a.send("attack", wb.id); await wait();
  (room as any).rng = seeded(5); // a tank fires once in 6.7 seconds and can miss: give it a few shots
  ticks(room, 150);
  expect(wb.hp).toBeLessThan(hp);
});

it("the loadout shows morale, stores, command and what went short; eating and foraging fill the food store", async () => {
  const { room, a, wa, loadouts } = await twoPlayers();
  ticks(room, 12); await wait();
  const d = loadouts.at(-1)!;
  expect(d.morale).toBe(5);
  expect(d.stores.food.have).toBeCloseTo(2, 1);
  expect(d.stores.fuel).toEqual({ have: 0, need: 0, make: 0 });
  expect(d.command).toEqual({ limit: 12, have: 0 });
  a.send("spell", "bread"); await wait();
  a.send("use"); await wait();
  expect(wa.stores.food).toBeCloseTo(8, 1); // BREAD's nutrition is 6
  expect(loadouts.at(-1)!.stores.food.have).toBeCloseTo(8, 1);
});
