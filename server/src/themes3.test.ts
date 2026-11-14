import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "described", "sensed", "got", "threats", "hits"];
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));

/** Two people side by side in a city, with every letter, too tough to die. */
async function setup() {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, unknown][]> = { a: [], b: [] };
  for (const t of MESSAGES) { a.onMessage(t, (m: unknown) => inbox.a!.push([t, m])); b.onMessage(t, (m: unknown) => inbox.b!.push([t, m])); }
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  for (const w of [wa, wb]) { w.letters = all(); w.hp = 1e9; room.rebuild(w); }
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 1.5; wb.player.y = c.y + 0.5;
  const said = (who: "a" | "b", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m);
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const mine = (owner: string, name: string) => [...walkers].find(([, w]) => w.master === owner && w.player.name === name);
  return { room, a, b, wa, wb, walkers, said, second, mine };
}

it("body parts: WINGS clicked on your WOLF graft it so it flies; AMPUTATE cuts them off onto the ground", async () => {
  const { room, a, b, wa, wb, said, mine } = await setup();
  a.send("spell", "wolf"); await wait();
  const [wolfId, wolf] = mine(a.sessionId, "wolf")!;
  expect(wolf.flying).toBe(false);
  a.send("pick", { id: wolfId }); a.send("spell", "wing"); a.send("pick", null); await wait();
  expect(said("a", "spelled").at(-1)).toMatch(/grafted onto WOLF/);
  expect(wolf.flying).toBe(true);
  // B cuts it off: it falls to the ground, nobody's.
  b.send("pick", { id: wolfId }); b.send("spell", "amputate"); b.send("pick", null); await wait();
  expect(wolf.flying).toBe(false);
  const lying = [...(room as any).grounded.entries()].find(([, g]: [string, any]) => g.phrase === "wing");
  expect(lying).toBeTruthy();
  expect(room.state.things.get(lying[0])!.owner).toBe("");
  // Spelled with nobody picked, a body part grows on its speller.
  a.send("spell", "claw"); await wait();
  expect(said("a", "spelled").at(-1)).toMatch(/grafted onto you/);
  expect(wa.unit.attack.num("dmg_slash")).toBeGreaterThan(20);
  void wb;
});

it("clothing: a BLIZZARD freezes the unclothed; a PARKA bears it; a FIRE beside you warms", async () => {
  const { room, a, b, wa, wb, second, said } = await setup();
  a.send("spell", "blizzard"); await wait();
  for (const w of [wa, wb]) { w.hp = 100; room.rebuild(w); }
  b.send("spell", "parka"); await wait();
  wb.hp = 100; room.rebuild(wb);
  second(3); await wait();
  expect(wa.exposed).toBe("cold");
  expect(wa.hp).toBeLessThan(100);
  expect(said("a", "notice").some((m) => /Freezing/.test(String(m)))).toBe(true);
  expect(wb.exposed ?? "").toBe("");
  // A CAMPFIRE beside A: warm again.
  a.send("spell", "campfire"); await wait();
  second(2);
  expect(wa.exposed, JSON.stringify((room as any).dict.word("campfire")?.set)).toBe("");
});

it("clothing: wild wolves leave someone in a COSTUME be, until they strike", async () => {
  const { room, a, wa, second } = await setup();
  const id = (room as any).addCreature({ spelled: { noun: "wolf", adjectives: ["fierce"] }, phrase: "fierce wolf", vehicle: false, integrity: null }, "-", wa.player.x + 2, wa.player.y);
  const wolf = (room as any).walkers.get(id);
  // Everyone else out of the way: the wolf sees only A.
  for (const [wid, w] of (room as any).walkers) if (wid !== id && wid !== a.sessionId) { w.player.x += 200; }
  a.send("spell", "costume"); await wait();
  expect(wa.unit.body.stats.num("disguise")).toBeGreaterThan(0);
  second(3);
  expect(wolf.foe).not.toBe(a.sessionId);
  wa.unmasked = (room as any).elapsed + 30; // A struck someone: shown for what they are
  second(3);
  expect(wolf.foe).toBe(a.sessionId);
});

it("emotions: LOVE charms a rival's creature over to its speller; RAGE turns creatures on whoever is nearest", async () => {
  const { a, b, said, mine, second } = await setup();
  b.send("spell", "rabbit"); await wait();
  const [rid, rabbit] = mine(b.sessionId, "rabbit")!;
  a.send("spell", "love"); await wait();
  second(2);
  expect(rabbit.master).toBe(a.sessionId);
  expect(said("a", "notice").some((m) => /comes over to you/.test(String(m)))).toBe(true);
  expect(said("b", "notice").some((m) => /charmed away/.test(String(m)))).toBe(true);
  expect(rid).toBeTruthy();
});

it("music: a DRUM gives its carrier away on others' threat arrows; the deaf hear nothing", async () => {
  const { room, a, wa, wb, said, second } = await setup();
  wb.player.x = wa.player.x + 40; // far beyond sight, within earshot
  a.send("spell", "drum"); await wait();
  second(2); await wait();
  const heard = (said("b", "threats").at(-1) ?? []) as any[];
  expect(heard.find((t) => t.id === a.sessionId)?.heard).toBe(true);
  // B is deafened: the drum is no longer heard.
  wb.statuses.push({ status: "deaf", left: 600, from: a.sessionId, origin: a.sessionId });
  (room as any).statusChanged(wb);
  second(2); await wait();
  const after = (said("b", "threats").at(-1) ?? []) as any[];
  expect(after.find((t) => t.id === a.sessionId)).toBeUndefined();
});

it("disease: a RAT's bite makes you sick, and a VACCINE keeps it off", async () => {
  const { room, a, wa, wb, second } = await setup();
  wa.statuses.push({ status: "sick", left: 200, from: "", origin: "", contagion: 1 });
  (room as any).statusChanged(wa);
  wb.player.x = wa.player.x + 1; wb.player.y = wa.player.y;
  for (let i = 0; i < 120 && !wb.statuses.some((x: any) => x.status === "sick"); i++) { wb.player.x = wa.player.x + 1; second(1); }
  expect(wb.statuses.some((x: any) => x.status === "sick")).toBe(true);
  // A vaccinated person does not catch it.
  wb.statuses = []; (room as any).statusChanged(wb); wb.recovered = undefined;
  wb.buffs.push({ word: "vaccine", set: {}, ops: [["res_disease", "add", 1]], until: Infinity }); room.rebuild(wb);
  for (let i = 0; i < 30; i++) { wb.player.x = wa.player.x + 1; second(1); }
  expect(wb.statuses.some((x: any) => x.status === "sick")).toBe(false);
  void a;
});
