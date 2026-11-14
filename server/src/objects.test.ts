import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { nearestWalkable, parsePhrase, useObject } from "@lastword/shared";
import appConfig from "./app.config.js";
import { loadDictionary } from "./data.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
// These rooms test other systems: no markets, ruins, animals or exploring to get in the way.
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
// One fixed map and fixed rolls for every room here: a random map can spawn someone in a desert or
// by water, and random rolls can miss (polish batch 2: no test leans on luck).
beforeEach(() => { WorldRoom.testSeed = 105; });
afterAll(() => { WorldRoom.testSeed = null; });
afterAll(async () => { await colyseus.shutdown(); });

const dict = loadDictionary();
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
/** Waits until the server has acted on what was sent (a slow machine takes longer than `wait`), up to two seconds. */
const until = async (done: () => boolean) => { for (let i = 0; i < 40 && !done(); i++) await wait(50); };
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));
const second = (room: WorldRoom) => { for (let i = 0; i < 10; i++) room.update(0.1); };

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
  wb.player.x = c.x + 2.5; wb.player.y = c.y + 0.5;
  wa.letters = all(); wb.letters = all();
  for (const w of [wa, wb]) room.rebuild(w);
  return { room, a, b, wa, wb, said, c };
}

/** Puts A and B on a row of 40 tiles of dry land, two tiles apart, so nobody is put ashore as they are moved about. */
function onDryLand(room: WorldRoom, wa: any, wb: any) {
  for (let y = 2; y < room.map.size - 2; y++) {
    for (let x = 2; x < room.map.size - 42; x++) {
      let ok = true;
      for (let i = 0; i <= 40 && ok; i++) { const p = { x: x + i + 0.5, y: y + 0.5 }; ok = nearestWalkable(room.map, p) === p; }
      if (!ok) continue;
      wa.player.x = x + 0.5; wa.player.y = y + 0.5; wb.player.x = x + 2.5; wb.player.y = y + 0.5;
      return;
    }
  }
  throw new Error("no dry land");
}

const max = (w: any) => w.unit.body.stats.num("integrity");
const things = (room: WorldRoom) => [...room.state.things.values()].map((t) => t.phrase);

it("MEDICINE heals, ends poison, protects from disease for its duration, and is gone after", async () => {
  const { room, a, b, wa, said } = await twoPlayers();
  (room as any).hurtWith(wa, [["poison", 60]], b.sessionId, b.sessionId, false);
  wa.hp = 20; room.rebuild(wa);
  expect(wa.player.status).toBe("poison");
  const disease = wa.unit.body.stats.num("res_disease");
  a.send("spell", "medicine"); await wait();
  expect(things(room)).toEqual(["medicine"]); // it lies at your feet
  a.send("use"); await wait();
  expect(said.at(-1)).toBe("Used MEDICINE for 600 seconds; no longer poison");
  expect(wa.hp).toBe(max(wa)); // 150 restored, up to full health
  expect(wa.statuses).toEqual([]);
  expect(wa.unit.body.stats.num("res_disease")).toBeCloseTo(disease + 0.5);
  expect(things(room)).toEqual([]); // single use: eaten
  a.send("use"); await wait();
  expect(said.at(-1)).toMatch(/^Nothing here to use/);
});

it("BREAD and APPLE restore health; a stack of breads is eaten one at a time", async () => {
  const { room, a, wa, said } = await twoPlayers();
  wa.hp = 50; room.rebuild(wa);
  a.send("spell", "bread"); await wait();
  a.send("use"); await wait();
  expect(said.at(-1)).toBe("Used BREAD; +6 food"); // its nutrition goes into the food store
  expect(wa.hp).toBe(65);
  a.send("spell", "apple"); await wait();
  a.send("use"); await wait();
  expect(wa.hp).toBe(75);
  expect(things(room)).toEqual([]);
  // THIRTY BREADS is one stack of thirty: each use eats one.
  a.send("spell", "thirty breads"); await wait();
  const [id, stack] = [...room.state.things.entries()][0]!;
  expect(stack.count).toBe(30);
  a.send("use", id); await wait();
  expect(stack.count).toBe(29);
  expect(wa.hp).toBe(90);
});

it("WINE's courage lasts its duration and wears off", async () => {
  const { room, a, wa, said } = await twoPlayers();
  const courage = wa.unit.body.stats.num("courage");
  a.send("spell", "wine"); await wait();
  a.send("use"); await wait();
  expect(said.at(-1)).toBe("Used WINE for 600 seconds; +2 food");
  expect(wa.unit.body.stats.num("courage")).toBe(courage + 4);
  expect(wa.buffs.map((x: any) => x.word)).toEqual(["wine"]);
  room.update(599);
  expect(wa.unit.body.stats.num("courage")).toBe(courage + 4);
  room.update(2);
  expect(wa.unit.body.stats.num("courage")).toBe(courage);
  expect(wa.buffs).toEqual([]);
});

it("using what cannot be used is refused, and the thing stays", async () => {
  const { room, a, wa, said } = await twoPlayers();
  a.send("spell", "sword"); await wait();
  a.send("use", 0); await wait();
  expect(said.at(-1)).toBe("SWORD cannot be used: it heals, cures and changes nothing");
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["sword"]);
  a.send("use"); await wait();
  expect(said.at(-1)).toBe("SWORD cannot be used: it heals, cures and changes nothing");
  wa.gear = []; room.rebuild(wa);
  a.send("use"); await wait();
  expect(said.at(-1)).toBe("Nothing here to use: spell something to eat, drink or take, and stand by it");
  a.send("spell", "leaf"); await wait();
  a.send("use"); await wait();
  expect(said.at(-1)).toBe("Used LEAF; +0.2 food"); // nutrition alone feeds the food store, and it is eaten
  expect(room.state.things.size).toBe(0);
  a.send("use", 7); await wait();
  expect(said.at(-1)).toBe("You carry nothing there");
  // Someone else's bread is not yours to eat.
  a.send("spell", "bread"); await wait();
  const [id, bread] = [...room.state.things.entries()][0]!;
  bread.owner = "someone";
  a.send("use", id); await wait();
  expect(said.at(-1)).toBe("BREAD is not yours");
  wa.player.x += 5;
  bread.owner = "";
  a.send("use", id); await wait();
  expect(said.at(-1)).toBe("BREAD is too far away");
});

it("a held TORCH lights and frightens around its holder, moves with them, and stops when dropped or destroyed", async () => {
  const { room, a, wa, wb } = await twoPlayers();
  onDryLand(room, wa, wb);
  room.state.daylight = "night";
  for (const w of [wa, wb]) room.rebuild(w);
  const lit = (w: any) => w.unit.body.stats.flag("night_vision");
  const morale = (w: any) => w.unit.body.stats.num("morale");
  const base = morale(wb), sight = wb.sight;
  expect(lit(wb)).toBe(false);
  a.send("spell", "torch"); await wait();
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["torch"]);
  second(room);
  expect(lit(wa)).toBe(true); // light reaches everyone in it, the holder too
  expect(lit(wb)).toBe(true);
  expect(wb.sight).toBeGreaterThan(sight); // B sees as if by day
  expect(morale(wb)).toBe(base - 1); // fear_aura 1, on enemies only
  expect(morale(wa)).toBe(base);
  // B walks out of the light (5 tiles), still in sight of the torch (60 m, 15 tiles).
  wb.player.x += 8;
  second(room);
  expect(lit(wb)).toBe(false);
  expect(morale(wb)).toBe(base - 1);
  wb.player.x += 20;
  second(room);
  expect(morale(wb)).toBe(base);
  // A carries the torch to B: the light comes too.
  wa.player.x = wb.player.x - 1;
  second(room);
  expect(lit(wb)).toBe(true);
  // Dropped, it lights where it lies; A walks off into the dark.
  a.send("drop"); await wait();
  expect(things(room)).toEqual(["torch"]);
  wa.player.x -= 10;
  second(room);
  expect(lit(wa)).toBe(false);
  expect(lit(wb)).toBe(true);
  expect(morale(wb)).toBe(base - 1); // a thing on the ground is A's, and frightens A's enemies
  // Destroyed, it gives off nothing.
  const [id] = [...room.state.things.keys()];
  room.removeThing(id!);
  second(room);
  expect(lit(wb)).toBe(false);
  expect(morale(wb)).toBe(base);
  expect((room as any).areas.size).toBe(0);
});

it("a LAMP lights where it stands; a GYM's field strengthens its owner around it; a creature's body radiates", async () => {
  const { room, a, b, wa, wb } = await twoPlayers();
  onDryLand(room, wa, wb);
  room.state.daylight = "night";
  for (const w of [wa, wb]) room.rebuild(w);
  a.send("spell", "lamp"); await wait();
  second(room);
  expect(wa.unit.body.stats.flag("night_vision")).toBe(true);
  const strength = wa.unit.body.stats.num("strength");
  a.send("spell", "gym"); await wait();
  second(room);
  expect(wa.unit.body.stats.num("strength")).toBe(strength + 2);
  expect(wb.unit.body.stats.num("strength")).toBe(strength); // field_targets owned
  expect([...room.state.zones.values()].map((z) => z.word)).toContain("gym");
  // When the owner leaves the gym's 30 m, it no longer works on them.
  wa.player.x += 10;
  second(room);
  expect(wa.unit.body.stats.num("strength")).toBe(strength);
  // A WOLF (fear_aura) frightens its master's enemies wherever it goes.
  const morale = wb.unit.body.stats.num("morale");
  wa.player.x -= 6;
  a.send("spell", "wolf"); await wait();
  await until(() => [...(room as any).walkers.values()].some((w: any) => w.master === a.sessionId));
  second(room);
  expect(wb.unit.body.stats.num("morale")).toBeLessThan(morale);
  const wolves = [...(room as any).walkers.entries()].filter(([, w]: any) => w.master === a.sessionId);
  for (const [id] of wolves) (room as any).kill(id, b.sessionId);
  second(room);
  // The torch-less A and B: only the lamp's light remains, and the gym's field.
  expect(wb.unit.body.stats.num("morale")).toBe(morale);
});

it("uses every usable word in the dictionary", async () => {
  // Usable, as counted for the report: anything edible, or with restores, effect_status,
  // potency, or a duration with operations, that spelling makes as an object.
  const candidates = [...dict.words].filter(([w, d]) => {
    if (d.role !== "noun") return false;
    try { if (parsePhrase(dict, w).kind !== "object") return false; } catch { return false; }
    const s = d.set, dur = Number(s.duration ?? 0);
    return s.edible === true || Number(s.restores ?? 0) > 0 || (Array.isArray(s.effect_status) && s.effect_status.length > 0) ||
      Number(s.potency ?? 0) > 0 || (dur > 0 && d.ops.length > 0) || s.duration === "ABS";
  }).map(([w]) => w);
  expect(candidates.length).toBeGreaterThan(50);
  const { room, a, wa, said, c } = await twoPlayers();
  const did: string[] = [], not: string[] = [];
  for (const word of candidates) {
    wa.hp = 1; wa.letters = all(); wa.buffs = []; wa.statuses = [];
    wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
    room.rebuild(wa);
    const before = said.length;
    // Each reply is waited for, not a fixed time: under load a fixed wait can miss one.
    const reply_ = async (n: number) => { for (let t = 0; t < 100 && said.length < n; t++) await wait(10); };
    a.send("spell", word);
    await reply_(before + 1);
    a.send("use");
    await reply_(before + 2);
    const reply = String(said.at(-1));
    expect(said.length, `${word} ${JSON.stringify(said.slice(-4))}`).toBe(before + 2);
    wa.statuses = []; (room as any).statusChanged(wa); // a poisonous one (HEMLOCK) would kill the next try
    (reply.startsWith("Used ") ? did : not).push(`${word}${reply.startsWith("Used ") ? "" : ` (${reply})`}`);
    // Clear the ground and the hands for the next word; creatures it made leave too.
    for (const id of [...room.state.things.keys()]) room.removeThing(id);
    wa.gear = [];
    for (const [id, w] of [...(room as any).walkers]) if (w.master === a.sessionId) (room as any).kill(id, "");
    room.update(0.1);
  }
  console.log(`usable words: ${candidates.length}; used to effect: ${did.length}; not: ${not.length}\n  ${not.join("\n  ")}`);
  // Every word the data gives an effect (shared useObject) was used, wherever spelling put it,
  // unless spelling made it a creature that walks off on its own, or land (a WHEAT field).
  const effective = candidates.filter((w) => useObject(dict, w) && !dict.word(w)!.set.tile_type &&
    !(parsePhrase(dict, w).stats.flag("alive") && Math.max(...["speed_land", "speed_air", "speed_water"].map((k) => parsePhrase(dict, w).stats.num(k))) > 0));
  for (const w of effective) expect(did.map((d) => d.split(" ")[0]), w).toContain(w);
}, 240_000);
