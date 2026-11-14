import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
// These rooms test other systems: no markets, ruins, animals or exploring to get in the way.
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const all = () => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, 99]));

async function twoPlayers() {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const said: unknown[] = [], seen: any[] = [], seenB: any[] = [], told: unknown[] = [];
  for (const c of [a, b]) for (const t of ["letters", "notice", "loadout", "dead", "won", "roundover", "refused", "spelled", "gathered", "described"]) c.onMessage(t, () => {});
  a.onMessage("spelled", (m: unknown) => said.push(m));
  a.onMessage("refused", (m: unknown) => said.push(m));
  a.onMessage("notice", (m: unknown) => said.push(m));
  a.onMessage("described", (m: unknown) => seen.push(m));
  b.onMessage("described", (m: unknown) => seenB.push(m));
  b.onMessage("notice", (m: unknown) => told.push(m));
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const c = room.map.cities[0]!;
  wa.player.x = c.x + 0.5; wa.player.y = c.y + 0.5;
  wb.player.x = c.x + 2.5; wb.player.y = c.y + 0.5;
  wa.letters = all(); wb.letters = all();
  for (const w of [wa, wb]) room.rebuild(w);
  return { room, a, b, wa, wb, said, seen, seenB, told, walkers };
}

const idOf = (room: WorldRoom, phrase: string) => [...room.state.things.entries()].find(([, t]) => t.phrase === phrase)?.[0];

it("picks up a STONE as an improvised weapon, and refuses what is too heavy", async () => {
  const { room, a, wa, said } = await twoPlayers();
  a.send("spell", "stone"); await wait();
  a.send("take"); await wait();
  expect(said.at(-1)).toBe("STONE in hand");
  expect(wa.gear.map((g: any) => g.phrase)).toEqual(["stone"]);
  expect(wa.unit.attack.num("dmg_blunt")).toBeGreaterThan(20);
  a.send("drop"); await wait();
  a.send("take"); await wait(); // the stone again: picks up fine
  a.send("drop"); await wait();
  (room as any).removeThing(idOf(room, "stone"));
  a.send("spell", "table"); await wait();
  a.send("take"); await wait();
  expect(said.at(-1)).toBe("TABLE is too heavy to carry");
  expect(wa.gear).toEqual([]);
});

it("puts adjectives spelled alone on a creature someone else owns, spending letters only when it works", async () => {
  const { room, a, b, wa, said, seen, seenB, told, walkers } = await twoPlayers();
  b.send("spell", "wolf"); await wait();
  const [wolfId, wolf] = [...walkers].find(([, w]) => w.master === b.sessionId)!;
  const before = wolf.unit.body.stats.num("integrity");
  const w0 = wa.letters.w;
  a.send("describe", { text: "weak", target: wolfId }); await wait();
  expect(said.at(-1)).toBe("WEAK on WOLF: integrity ×0.5, strength −2");
  expect(wolf.player.name).toBe("weak wolf");
  expect(wolf.unit.body.stats.num("integrity")).toBe(before / 2);
  expect(wa.letters.w).toBe(w0 - 1);
  expect(seen.at(-1)).toMatchObject({ target: wolfId, words: "WEAK", changes: ["integrity ×0.5", "strength −2"] });
  expect(seenB.at(-1)).toMatchObject({ target: wolfId }); // everyone in sight sees it
  expect(told.at(-1)).toBe(`${wa.player.name} put WEAK on your WOLF`);
  // A wolf holds one adjective: a second is refused and costs nothing.
  const letters = JSON.stringify(wa.letters);
  a.send("describe", { text: "worst", target: wolfId }); await wait();
  expect(said.at(-1)).toBe("WEAK WOLF cannot take WORST: it holds 1 adjective and has none free");
  expect(JSON.stringify(wa.letters)).toBe(letters);
  void room;
});

it("puts adjectives on a thing on the ground, on yourself, on your own gear, and only in sight", async () => {
  const { room, a, b, wa, wb, said, seen } = await twoPlayers();
  a.send("spell", "stone"); await wait();
  const stone = idOf(room, "stone")!;
  a.send("describe", { text: "huge", target: stone }); await wait();
  expect(room.state.things.get(stone)!.phrase).toBe("huge stone");
  expect(seen.at(-1).changes[0]).toMatch(/^integrity ×/);
  a.send("describe", { text: "strong", target: a.sessionId }); await wait();
  expect(wa.body.adjectives).toEqual(["strong"]);
  expect(wa.player.traits).toBe("strong");
  expect(wa.unit.body.stats.num("strength")).toBe(8);
  a.send("spell", "sword"); await wait();
  a.send("describe", { text: "sharp", target: a.sessionId, gear: 0 }); await wait();
  expect(wa.gear[0].phrase).toBe("sharp sword");
  wb.player.x = wa.player.x + 100;
  a.send("describe", { text: "weak", target: b.sessionId }); await wait();
  expect(said.at(-1)).toBe("Too far away for WEAK: it must be in sight");
  a.send("describe", { text: "weak sword", target: b.sessionId }); await wait(); // not only adjectives: an ordinary spelling
  expect(said.at(-1)).toBe("WEAK SWORD equipped");
  void b;
});
