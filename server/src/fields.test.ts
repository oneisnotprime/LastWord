import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { parsePhrase } from "@lastword/shared";
import appConfig from "./app.config.js";
import { loadDictionary } from "./data.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
// These rooms test other systems: no markets, ruins, animals or exploring to get in the way.
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
// One fixed map and fixed rolls for every room here: a random map can spawn someone in a desert or
// by water, and random rolls can miss (polish batch 2: no test leans on luck).
beforeEach(() => { WorldRoom.testSeed = 103; });
afterAll(() => { WorldRoom.testSeed = null; });
afterAll(async () => { await colyseus.shutdown(); });

const dict = loadDictionary();
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));

async function twoPlayers() {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const said: unknown[] = [];
  for (const c of [a, b]) for (const t of ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled"]) c.onMessage(t, () => {});
  a.onMessage("spelled", (m: unknown) => said.push(m));
  a.onMessage("refused", (m: unknown) => said.push(m));
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 2.5; wb.player.y = c.y + 0.5;
  wa.letters = all(); wb.letters = all();
  for (const w of [wa, wb]) { w.hp = 1e9; room.rebuild(w); } // nobody dies while every word is tried
  return { room, a, b, wa, wb, said };
}

it("spells every field word without error, and nearly all of them do something", async () => {
  const fields = [...dict.words].filter(([w, d]) => d.role === "noun" && (() => {
    try { return parsePhrase(dict, w).kind === "field"; } catch { return false; }
  })()).map(([w]) => w);
  expect(fields.length).toBeGreaterThan(100);
  const { room, a, wa, wb, said } = await twoPlayers();
  const c = room.map.cities[0]!;
  const idle: string[] = [];
  for (const word of fields) {
    a.send("pick", { x: wb.player.x, y: wb.player.y }); // aimed fields land on B
    a.send("spell", word);
    await wait(20);
    room.update(0.1);
    wa.letters = all();
    // Each word is tried on its own: what the last one did to A (stun, confusion) is undone.
    for (const w of [wa, wb]) { w.statuses = []; (room as any).statusChanged(w); w.target = null; w.foe = null; }
    wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5; wb.player.x = c.x + 2.5; wb.player.y = c.y + 0.5;
  }
  await wait(300);
  for (const [i, m] of said.entries()) if (/does nothing yet/.test(String(m))) idle.push(fields[i] ?? String(m));
  if (idle.length) console.log(`field words that do nothing yet (${idle.length}): ${idle.join(" ")}`);
  const refusals = said.filter((m) => /Aim |Too far|You need|not a/.test(String(m)));
  expect(said.length).toBe(fields.length);
  expect(refusals).toEqual([]);
  // Words whose data gives them no effect, damage or letters: tolerated, listed when they appear.
  expect(idle.length).toBeLessThan(fields.length * 0.1);
}, 120_000);

it("LOVE warms everyone near (and charms them), FEAR hurts the others, HEAVEN blesses your side map-wide", async () => {
  const { a, wa, wb } = await twoPlayers();
  const morale = (w: any) => w.unit.body.stats.num("morale");
  const [ma, mb] = [morale(wa), morale(wb)];
  a.send("spell", "love"); await wait();
  expect(morale(wa)).toBe(ma + 3);
  expect(morale(wb)).toBe(mb + 3); // love reaches the living, B too (shared emotion.ts)
  expect(wb.statuses.some((x: any) => x.status === "charm")).toBe(true); // and B spares A
  a.send("spell", "fear"); await wait();
  expect(morale(wb)).toBe(mb + 3 - 4);
  expect(morale(wa)).toBe(ma + 3); // fear targets enemies only
  // HEAVEN covers the whole map but blesses only its maker's side.
  a.send("spell", "heaven"); await wait();
  expect(morale(wa)).toBe(ma + 3 + 6);
  expect(morale(wb)).toBe(mb + 3 - 4);
});

it("fields follow their maker, wear off, and end when the maker dies", async () => {
  const { room, a, b, wa, wb } = await twoPlayers();
  // B stands its ground: this test is about where fields reach, not about running from them.
  wb.buffs.push({ word: "courage", set: { immune_fear: true }, ops: [], until: Infinity });
  room.rebuild(wb);
  const morale = (w: any) => w.unit.body.stats.num("morale");
  const base = morale(wb);
  a.send("spell", "fear"); await wait();
  expect(morale(wb)).toBe(base - 4);
  wb.player.x += 40; // FEAR reaches 40 m, 10 tiles
  for (let i = 0; i < 10; i++) room.update(0.1);
  expect(morale(wb)).toBe(base);
  wa.player.x = wb.player.x; wa.player.y = wb.player.y; // the aura comes with A
  for (let i = 0; i < 10; i++) room.update(0.1);
  expect(morale(wb)).toBe(base - 4);
  expect(room.state.zones.size).toBe(1);

  // DISEASE, aimed at B, damages whoever lives inside it and lasts its forty minutes.
  wa.player.x -= 1;
  a.send("pick", { x: wb.player.x, y: wb.player.y });
  a.send("spell", "disease"); await wait();
  const hp = wb.hp;
  for (let i = 0; i < 60; i++) room.update(0.1);
  expect(wb.hp).toBeLessThan(hp);
  room.update(41 * 60);
  expect([...room.state.zones.values()].map((z) => z.word)).toEqual(["fear"]);

  // PLANET covers the map: everyone's jumping is halved.
  const jump = wb.unit.body.stats.num("jump");
  a.send("spell", "planet"); await wait();
  expect(wb.unit.body.stats.num("jump")).toBe(jump * 0.5);

  // The aura ends with its maker.
  (room as any).kill(a.sessionId, b.sessionId);
  for (let i = 0; i < 10; i++) room.update(0.1);
  expect([...room.state.zones.values()].map((z) => z.word)).not.toContain("fear");
});

it("a law covers an area's own harm: FIRE set inside someone's SANCTUARY, or under a TRUCE, does not burn them", async () => {
  const { room, a, b, wa, wb, said } = await twoPlayers();
  wb.player.x = wa.player.x + 1.5; wb.player.y = wa.player.y;
  const burns = async () => {
    const before = wb.hp;
    a.send("pick", { x: wb.player.x, y: wb.player.y });
    a.send("spell", "fire");
    await wait();
    for (let i = 0; i < 30; i++) room.update(0.1);
    return before - wb.hp;
  };
  expect(await burns(), JSON.stringify(said)).toBeGreaterThan(0); // no law: it burns
  for (const k of [...(room as any).areas.keys()]) (room as any).areas.delete(k);
  wb.statuses = []; room.rebuild(wb);
  b.send("spell", "sanctuary"); await wait();
  for (let i = 0; i < 2; i++) room.update(0.1);
  expect(await burns()).toBe(0);
  expect(wb.statuses.some((s: any) => s.status === "burn")).toBe(false);
  // An area's own law, too: a TRUCE someone spells covers fire dropped inside it afterwards.
  for (const [tid] of [...room.state.things]) (room as any).removeThing(tid);
  for (const k of [...(room as any).areas.keys()]) (room as any).areas.delete(k);
  wb.statuses = []; room.rebuild(wb);
  b.send("spell", "truce"); await wait();
  expect(await burns()).toBe(0);
});
