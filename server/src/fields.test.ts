import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { parsePhrase } from "@lastword/shared";
import appConfig from "./app.config.js";
import { loadDictionary } from "./data.js";
import type { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { colyseus = await boot(appConfig); });
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
});

it("LOVE helps you and yours, FEAR hurts the others, HEAVEN blesses your side map-wide", async () => {
  const { a, wa, wb } = await twoPlayers();
  const morale = (w: any) => w.unit.body.stats.num("morale");
  const [ma, mb] = [morale(wa), morale(wb)];
  a.send("spell", "love"); await wait();
  expect(morale(wa)).toBe(ma + 3);
  expect(morale(wb)).toBe(mb); // B is not A's
  a.send("spell", "fear"); await wait();
  expect(morale(wb)).toBe(mb - 4);
  expect(morale(wa)).toBe(ma + 3); // fear targets enemies only
  // HEAVEN covers the whole map but blesses only its maker's side.
  a.send("spell", "heaven"); await wait();
  expect(morale(wa)).toBe(ma + 3 + 6);
  expect(morale(wb)).toBe(mb - 4);
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
