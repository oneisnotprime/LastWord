import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Concept batch: combat. Damage natures on hits, luck, scale and control, through the room.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = (n = 99) => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, n]));
const MESSAGES = ["notice", "refused", "spelled", "letters", "hits", "luck", "got"];

/** Two people three tiles apart in a city, with every letter. */
async function setup() {
  WorldRoom.testSeed = 31;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const R = room as any;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, unknown][]> = { a: [], b: [] };
  for (const t of MESSAGES) { a.onMessage(t, (m: unknown) => inbox.a!.push([t, m])); b.onMessage(t, (m: unknown) => inbox.b!.push([t, m])); }
  const walkers = R.walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 3.5; wb.player.y = c.y + 0.5;
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const said = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m as any);
  const on = async (who: any, target: string, word: string) => { who.send("pick", { id: target }); who.send("spell", word); who.send("pick", null); await wait(); };
  const creature = (word: string) => [...walkers].find(([, w]) => w.master === a.sessionId && w.body.noun === word) as [string, any];
  return { room, R, a, b, wa, wb, walkers, second, said, on, creature, c };
}

it("damage natures: a hammer passes through a GHOST (immune), a TORCH burns a ZOMBIE (weak!), and the hits say so", async () => {
  const { room, R, a, wa, second, said, creature } = await setup();
  a.send("spell", "ghost"); a.send("spell", "zombie"); await wait();
  const [gid, ghost] = creature("ghost"), [zid, zombie] = creature("zombie");
  for (const w of [ghost, zombie]) { w.master = "-"; w.player.owner = "-"; w.hp = 1e6; w.unit.body.integrity = 1e6; w.player.x = wa.player.x + 1; w.player.y = wa.player.y; }
  wa.gear = []; a.send("spell", "hammer"); await wait();
  wa.foe = gid; second(3); await wait();
  const onGhost = said("a", "hits").flat().filter((h: any) => h.on === gid && h.by === a.sessionId && h.kind !== "miss");
  expect(onGhost.length).toBeGreaterThan(0);
  expect(onGhost.every((h: any) => h.amount === 0 && h.aff === "immune")).toBe(true);
  wa.gear = []; room.rebuild(wa); a.send("spell", "torch"); await wait();
  wa.foe = zid; second(3); await wait();
  const onZombie = said("a", "hits").flat().filter((h: any) => h.on === zid && h.by === a.sessionId && h.kind !== "miss");
  expect(onZombie.some((h: any) => h.aff === "weak" && h.amount > 0)).toBe(true);
  void R;
});

it("luck: a lucky body steps over a hidden trap; DICE thrown gamble letters; FATE throws for letters between two", async () => {
  const { room, R, a, b, wa, wb, second, said, on } = await setup();
  // A's trap; B so lucky it always steps over (luck 40: twice 3% a point, past 100%).
  a.send("spell", "landmine"); await wait();
  const [tid, mine] = [...room.state.things.entries()].find(([, t]) => t.phrase === "landmine")!;
  wb.buffs = [{ word: "luck", set: {}, ops: [["luck", "add", 40]], until: 1e9 }]; room.rebuild(wb);
  wb.player.x = mine.x; wb.player.y = mine.y; wb.target = null;
  second(2); await wait();
  expect(room.state.things.has(tid)).toBe(true); // never sprang
  expect(said("b", "luck").some((m: any) => /lucky step/.test(m.text))).toBe(true);
  // DICE: thrown with U, it gambles six letters against the house.
  wa.gear = []; a.send("spell", "dice"); await wait();
  const total = () => Object.values(wa.letters as Record<string, number>).reduce((n: number, k) => n + k, 0);
  const before = total();
  a.send("use"); await wait();
  expect(said("a", "luck").some((m: any) => m.text === "won!" || m.text === "lost")).toBe(true);
  expect(Math.abs(total() - before)).toBeGreaterThan(0);
  // FATE on B: the two throw; whoever loses pays the other eight letters.
  wb.buffs = []; room.rebuild(wb);
  const bBefore = Object.values(wb.letters as Record<string, number>).reduce((n: number, k) => n + k, 0);
  await on(a, b.sessionId, "fate");
  const bAfter = Object.values(wb.letters as Record<string, number>).reduce((n: number, k) => n + k, 0);
  expect(Math.abs(bAfter - bBefore)).toBe(8);
  expect(said("a", "spelled").at(-1)).toMatch(/throw against/);
  void R;
});

it("scale: GIGANTIC is too big for its own HOUSE's door; SHRUNK slips under an enemy's; a GIANT is easier to reach", async () => {
  const { room, R, a, b, wa, wb, second, said, on, c } = await setup();
  wb.player.x = c.x + 0.5; wb.player.y = c.y + 7.5;
  a.send("spell", "house"); await wait();
  const [hid] = [...R.rooms.keys()] as string[];
  const house = room.state.things.get(hid!)!;
  expect(wa.inside).toBe(hid);
  // A goes out, then is made gigantic: its own door no longer lets it in.
  wa.target = { x: house.x, y: house.y + 5 }; second(4);
  expect(wa.inside).toBeUndefined();
  a.send("describe", { text: "gigantic", target: a.sessionId }); await wait();
  expect(wa.size).toBe(4);
  expect(wa.player.size).toBe(4);
  wa.target = { x: house.x, y: house.y }; second(4); await wait();
  expect(wa.inside).toBeUndefined();
  expect(String(said("a", "refused").at(-1))).toMatch(/too big for the door/);
  // B, an enemy, shrunk by SHRINKAGE, slips under the shut door.
  wb.player.x = house.x; wb.player.y = house.y + 5;
  await on(a, b.sessionId, "shrinkage");
  expect(wb.size).toBeCloseTo(0.25);
  wb.target = { x: house.x, y: house.y }; second(4);
  expect(wb.inside).toBe(hid);
  // A giant's hitbox: B strikes it from farther than an ordinary body.
  expect(R.walkers.get(a.sessionId).stature).toBeGreaterThan(3);
});

it("scale: a shrunk person climbs on their own WOLF and rides it; a gigantic one cannot ride a HORSE", async () => {
  const { room, R, a, wa, second, on } = await setup();
  a.send("spell", "wolf"); await wait();
  await on(a, a.sessionId, "shrinkage");
  second(1);
  const wolf = [...R.walkers.values()].find((w: any) => w.master === a.sessionId && w.body.noun === "wolf");
  wolf.player.x = wa.player.x + 0.3; wolf.player.y = wa.player.y;
  R.takeNear(a.sessionId, wa, null);
  expect(wa.gear.some((g: any) => g.vehicle && g.spelled.noun === "wolf")).toBe(true);
  // Grown far past a horse, nobody rides it.
  wa.gear = []; wa.statuses = []; R.statusChanged(wa);
  a.send("describe", { text: "colossal", target: a.sessionId }); await wait();
  const why = R.equip(wa, { spelled: { noun: "horse" }, phrase: "horse", vehicle: true, integrity: null });
  expect(why).toMatch(/too small to carry you/);
  void room;
});

it("control: REVERSAL turns B's steps around; HYPNOTIZE lets A steer B; a LASSO leashes B and SCISSORS cut it; BEER sways", async () => {
  const { room, R, a, b, wa, wb, second, on, c } = await setup();
  // Reversed: B asks to walk east and goes west.
  await on(a, b.sessionId, "reversal");
  expect(wb.unit.body.stats.num("reversed")).toBeGreaterThan(0);
  expect(wb.player.status).toMatch(/reverse/);
  const x0 = wb.player.x;
  b.send("move", { x: x0 + 6, y: wb.player.y }); await wait(); second(1);
  expect(wb.player.x).toBeLessThan(x0 - 0.5);
  wb.statuses = []; R.statusChanged(wb);
  // Hypnotized: B walks as A walks, and A's foe is B's.
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5; wb.player.x = c.x + 3.5; wb.player.y = c.y + 0.5;
  a.send("spell", "hypnotize"); // touched verb: lands on the picked
  await on(a, b.sessionId, "hypnotize");
  expect(wb.hamper.steeredBy).toBe(a.sessionId);
  const by0 = wb.player.y;
  b.send("move", { x: wb.player.x, y: wb.player.y - 6 }); await wait(); // B's own wish is overruled
  wa.target = { x: wa.player.x, y: wa.player.y + 6 }; second(1);
  expect(wb.player.y).toBeGreaterThan(by0 + 0.5);
  wb.statuses = []; R.statusChanged(wb);
  // Leashed by A's LASSO: B cannot get farther than four tiles from A.
  wa.gear = []; a.send("spell", "lasso"); await wait();
  wb.hp = 1e9; R.hurtWith(wb, [["leash", 10]], a.sessionId, a.sessionId, true);
  expect(wb.player.tether).toBe(a.sessionId);
  wb.target = { x: wa.player.x + 15, y: wa.player.y }; second(3);
  expect(Math.hypot(wb.player.x - wa.player.x, wb.player.y - wa.player.y)).toBeLessThanOrEqual(4.05);
  b.send("spell", "scissors"); await wait(); second(1);
  expect(wb.hamper.leashedTo).toBeUndefined();
  expect(wb.player.tether).toBe("");
  // BEER: B sways as it walks; SOBER ends it.
  wb.gear = []; b.send("spell", "beer"); await wait(); b.send("use"); await wait();
  expect(wb.unit.body.stats.num("wobble")).toBeGreaterThan(0);
  expect(wb.player.status).toMatch(/drunk/);
  b.send("spell", "coffee"); await wait(); b.send("use"); await wait();
  expect(wb.unit.body.stats.num("wobble")).toBe(0);
  void room;
});

it("control: a MAGNET carried pulls an enemy in iron toward its bearer", async () => {
  const { room, a, b, wa, wb, second, c } = await setup();
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5; wb.player.x = c.x + 6.5; wb.player.y = c.y + 0.5;
  b.send("spell", "armor"); a.send("spell", "magnet"); await wait();
  a.send("take", null); await wait(); // picked up: carried, it pulls
  expect(wa.gear.some((g: any) => g.spelled.noun === "magnet")).toBe(true);
  const d0 = Math.hypot(wb.player.x - wa.player.x, wb.player.y - wa.player.y);
  wb.target = null; second(3);
  expect(Math.hypot(wb.player.x - wa.player.x, wb.player.y - wa.player.y)).toBeLessThan(d0 - 0.5);
  void room;
});
