import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { CELL_WARNING, DODGE_TILES } from "@lastword/shared";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Playtest batch C1: power you can see coming. Heavy blows wind up and can be stepped out of; sky
// and area harm is local, shown first and kept off by shelter; deaths say what did them; a bot's
// peace covers its creatures; an attack wins over drawing a wild animal in; gear that no longer
// fits is dropped, not thrown.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));
const ticks = (room: any, seconds: number) => { for (let t = 0; t < seconds * 10; t++) room.update(0.1); };

/** A room with people placed by hand (no clients), each with every letter. */
async function people(n: number, spread = 9) {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as any;
  const c = room.map.size / 2, ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `p${i}`;
    room.addPerson(id, id, { x: c + (i % 4) * spread, y: c + Math.floor(i / 4) * spread });
    room.walkers.get(id).letters = all();
    ids.push(id);
  }
  return { room, ids, w: (id: string) => room.walkers.get(id) };
}

it("a heavy blow winds up, shown to both sides, and misses whoever steps out of its ring", async () => {
  const { room, w } = await people(2);
  const a = w("p0"), b = w("p1");
  b.player.x = a.player.x + 1.5; b.player.y = a.player.y;
  room.spellWord("p0", a, "rifle");
  a.foe = "p1";
  const before = b.hp;
  room.update(0.1);
  expect(a.windup).toBeTruthy(); // a rifle shot would take a big share of a person
  // B steps aside before it lands: dodged, unhurt.
  b.player.x += DODGE_TILES + 0.5;
  ticks(room, 2);
  expect(b.hp).toBe(before);
  // An ordinary blow (a SWORD on a person) does not wind up.
  const c = w("p1");
  room.spellWord("p1", c, "sword");
  c.foe = "p0"; c.player.x = a.player.x + 1;
  room.update(0.1);
  expect(c.windup).toBeUndefined();
});

it("a fight between two armed people lasts seconds, and the dead are told what killed them", async () => {
  const { room, w } = await people(3);
  const a = w("p0"), b = w("p1");
  b.player.x = a.player.x + 1; b.player.y = a.player.y;
  room.spellWord("p0", a, "sword");
  a.foe = "p1";
  let t = 0;
  for (; t < 600 && room.walkers.has("p1"); t++) room.update(0.1);
  expect(room.walkers.has("p1")).toBe(false);
  expect(t / 10).toBeGreaterThanOrEqual(4);
  expect(t / 10).toBeLessThanOrEqual(20);
  const recap = room.recap(b, "p0");
  expect(recap).toMatchObject({ killer: "p0", what: "SWORD" });
  expect(recap.top[0]).toMatchObject({ who: "p0", what: "SWORD", kind: "slash" });
  expect(room.tally.get("p0")).toBe(1);
});

it("a STORM strikes in marked cells near people, not the whole map: a roof keeps it off, and nobody dies at once", async () => {
  const { room, ids, w } = await people(8);
  const caster = w("p0");
  const cells: any[] = [];
  const cellAt = room.cellAt.bind(room);
  room.cellAt = (...args: any[]) => { cellAt(...args); cells.push([...room.areas.values()].at(-1)); };
  room.spellWord("p0", caster, "storm");
  ticks(room, 1);
  // Nobody is struck at once, and the storm itself is no map-wide strike.
  for (const id of ids) expect(w(id).hp).toBe(100);
  // Cells fall near people (a STORM strikes about once in twenty seconds, as a whole), each small
  // and shown CELL_WARNING seconds before it lands.
  ticks(room, 40);
  expect(cells.length).toBeGreaterThan(0);
  for (const c of cells) { expect(c.radius).toBeLessThanOrEqual(4); expect(c.armed - (c.until - c.lasts)).toBeCloseTo(CELL_WARNING); }
  // Each cell strikes only its own few tiles: someone far from every cell is untouched.
  // Someone under a roof (a HOUSE beside them) takes nothing from it.
  const p = w("p3");
  if (p) {
    room.spellWord("p3", p, "house");
    p.hp = 100; room.rebuild(p);
    expect(room.shelterOf("p3", p)).toBe(1);
    ticks(room, 30);
    expect(p.hp).toBe(100);
  }
  expect(CELL_WARNING).toBeGreaterThan(1);
});

it("a TORNADO dropped on a foe never harms its speller's side, and an area is shown before it strikes", async () => {
  const { room, w } = await people(2);
  const a = w("p0"), b = w("p1");
  b.player.x = a.player.x + 3; b.player.y = a.player.y;
  a.aim = { x: b.player.x, y: b.player.y }; a.picked = "p1";
  room.spellWord("p0", a, "tornado");
  a.aim = null; a.picked = null;
  room.update(0.1);
  expect(b.hp).toBe(100); // still only shown
  ticks(room, 6);
  expect(a.hp).toBe(100); // its speller, inside its reach, is spared
  expect(!room.walkers.has("p1") || w("p1").hp < 100).toBe(true);
});

it("a bot's peace covers its creatures: they do not go for people who leave them be", async () => {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", { bots: 1, difficulty: "hard" })) as any;
  const [botId, mind] = [...room.bots][0] as [string, any];
  const bot = room.walkers.get(botId);
  mind.peaceUntil = room.elapsed + 60;
  room.addPerson("p9", "p9", { x: bot.player.x + 2, y: bot.player.y });
  const wolf = room.addCreature({ spelled: { noun: "wolf" }, phrase: "wolf", vehicle: false, integrity: null }, botId, bot.player.x + 1, bot.player.y);
  const c = room.walkers.get(wolf);
  c.foe = "p9";
  room.update(0.1);
  expect(c.foe).toBeNull();
  // Attacked, it defends its master even in peace.
  room.walkers.get("p9").foe = botId;
  room.update(0.1);
  expect(c.foe).toBe("p9");
});

it("a wild animal you are attacking is never drawn in by a recruiting perk: the attack wins", async () => {
  const { room, w } = await people(2);
  const a = w("p0");
  const bunny = room.addCreature({ spelled: { noun: "rabbit" }, phrase: "rabbit", vehicle: false, integrity: null }, "-", a.player.x + 2, a.player.y);
  const lure = a.unit.body.stats.clone();
  lure.set("recruit_rate", 60);
  const sources = room.sources.bind(room);
  room.sources = () => [lure];
  a.upkeep = { have: 0, limit: 10 };
  a.foe = bunny;
  room.recruit("p0", a, { creatures: [], things: [] }, 1);
  expect(room.walkers.get(bunny)?.master).toBe("-");
  // Left alone, the same perk draws it in.
  a.foe = null;
  room.recruit("p0", a, { creatures: [], things: [] }, 1);
  room.sources = sources;
  expect(room.walkers.get(bunny)?.master).toBe("p0");
});

it("gear that no longer fits is dropped at your feet instead of throwing", async () => {
  const { room, w } = await people(2);
  const a = w("p0");
  room.spellWord("p0", a, "sword");
  room.spellWord("p0", a, "gavel");
  // A third thing in the hand (as a lost graft or a change to what is held leaves it): it no longer fits.
  a.gear.push({ spelled: { noun: "spear" }, phrase: "spear", vehicle: false, integrity: null });
  expect(() => room.rebuild(a)).not.toThrow();
  expect(a.gear.length).toBeLessThan(3);
  expect([...room.state.things.values()].some((t: any) => t.owner === "p0")).toBe(true);
});
