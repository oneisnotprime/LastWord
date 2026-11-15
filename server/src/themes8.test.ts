import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Expansion batch 3: traps and dungeons (re-arming traps, captures, lockups that hold), heraldry,
// courts and fealty (tribute, pacts ended by counter-words), and the bots' anti-air.
let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));

async function setup() {
  WorldRoom.testSeed = 31;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const R = room as any;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const walkers = R.walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 0.5; wb.player.y = c.y + 12.5;
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const thing = (noun: string) => [...R.grounded.entries()].find(([, g]: [string, any]) => g.spelled.noun === noun) as [string, any] | undefined;
  return { room, R, a, b, wa, wb, second, thing, walkers };
}

it("a MINEFIELD springs, stays and re-arms; a TRIPWIRE is spent", async () => {
  const { R, a, wa, wb, second, thing } = await setup();
  a.send("spell", "minefield"); await wait();
  const [mid, mine] = thing("minefield")!;
  expect(R.traps.has(mid)).toBe(true);
  wa.player.x += 12; // A walks off
  wb.player.x = mine.x ?? R.state.things.get(mid).x; wb.player.y = R.state.things.get(mid).y + 0.5;
  second(1);
  expect(R.state.things.has(mid)).toBe(true); // not spent
  expect(R.sprung.has(mid)).toBe(true);
  wb.player.y += 30;
  second(25);
  expect(R.sprung.has(mid)).toBe(false); // armed again
  a.send("spell", "tripwire"); await wait();
  const [lid] = thing("tripwire")!;
  wb.player.x = R.state.things.get(lid).x; wb.player.y = R.state.things.get(lid).y;
  second(1);
  expect(R.state.things.has(lid)).toBe(false);
});

it("a MANTRAP drops its victim into its owner's JAIL; the walls hold them until they break the door from inside", async () => {
  const { R, a, wa, wb, second, thing } = await setup();
  a.send("spell", "jail"); await wait();
  const [jid] = [...R.rooms.keys()] as string[];
  const jail = R.rooms.get(jid);
  wa.player.x += 14; second(1);
  a.send("spell", "mantrap"); await wait();
  const [tid] = thing("mantrap")!;
  const t = R.state.things.get(tid);
  wb.player.x = t.x; wb.player.y = t.y;
  second(1);
  expect(wb.inside).toBe(jid);
  wb.statuses = []; R.statusChanged(wb); // the jaws' hold worn off
  // It walks for the far wall: held.
  wb.target = { x: jail.x, y: jail.y + jail.r + 4 };
  second(5);
  expect(wb.inside).toBe(jid);
  // Its blows land on the door, not the jail; the door breaks, and out it walks.
  jail.door = 50;
  wb.foe = jid; wb.target = null;
  wb.unit.attack.set("accuracy", "ABS");
  second(10);
  expect(jail.broken).toBe(true);
  wb.foe = null;
  // Out through the broken door: the wall no longer holds it.
  const from = { x: wb.player.x, y: wb.player.y };
  wb.player.x = jail.x; wb.player.y = jail.y + jail.r + 0.5;
  R.bar(wb, from);
  expect(wb.inside).toBeUndefined();
});

it("an INCARCERATION passed on someone puts them in the speller's lockup; a JAILBREAK spelled inside breaks out", async () => {
  const { R, a, b, wa, wb, second } = await setup();

  a.send("spell", "dungeon"); await wait();
  const [did] = [...R.rooms.keys()] as string[];
  wa.player.x += 14; second(1);
  wb.player.x = wa.player.x + 2; wb.player.y = wa.player.y;
  wa.unit.body.stats.set("authority", 10); // beats B's stealth
  wa.picked = b.sessionId;
  R.spellWord(a.sessionId, wa, "incarceration");
  wa.picked = null;
  expect(wb.inside).toBe(did);
  wb.statuses = []; R.statusChanged(wb);
  b.send("spell", "jailbreak"); await wait();
  expect(R.rooms.get(did).broken).toBe(true);
});

it("FEALTY makes its speller liege: the vassal pays tribute on what it earns; BETRAYAL ends it with no penalty", async () => {
  const { R, a, b, wa, wb } = await setup();
  wb.player.y = wa.player.y + 2;
  a.send("pick", { id: b.sessionId }); a.send("spell", "fealty"); a.send("pick", null); await wait();
  const pact = R.pactOf(a.sessionId);
  expect(pact?.liege).toBe(a.sessionId);
  expect(pact.members.has(b.sessionId)).toBe(true);
  const before = Object.values(wa.letters as Record<string, number>).reduce((n, v) => n + v, 0);
  let got = "";
  for (let i = 0; i < 20; i++) got += R.earn(b.sessionId, "eeeee", wb.player, "test");
  const after = Object.values(wa.letters as Record<string, number>).reduce((n, v) => n + v, 0);
  expect(after - before).toBeGreaterThan(10); // about 30 of 100
  expect(got.length).toBeLessThan(90);
  const bLetters = Object.values(wb.letters as Record<string, number>).reduce((n, v) => n + v, 0);
  b.send("pick", { id: a.sessionId }); b.send("spell", "betrayal"); b.send("pick", null); await wait();
  expect(R.pactOf(a.sessionId)).toBeUndefined();
  // No breach penalty: B lost only the letters of BETRAYAL.
  expect(bLetters - Object.values(wb.letters as Record<string, number>).reduce((n, v) => n + v, 0)).toBe("betrayal".length);
});

it("bots know the new words: anti-air, fealty, breaking out", async () => {
  const { wordBook } = await import("./bots.js");
  const { loadDictionary } = await import("./data.js");
  const book = wordBook(loadDictionary());
  const of = (use: string) => (book.byUse.get(use as never) ?? []).map((x) => x.word);
  for (const w of ["bow", "rifle", "jet", "eagle"]) expect(of("antiair"), w).toContain(w);
  expect(of("antiair")).not.toContain("sword");
  for (const w of ["fealty", "homage", "feudalism"]) expect(of("fealty"), w).toContain(w);
  for (const w of ["jailbreak", "breakout"]) expect(of("breakout"), w).toContain(w);
});
