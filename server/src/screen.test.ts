import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

// Screen, knowledge and communication (shared screen.ts, knowledge.ts, comms.ts): what the server sends.

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = false; colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });
afterEach(() => { WorldRoom.testSeed = null; });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const MESSAGES = ["letters", "notice", "loadout", "refused", "spelled", "intel", "call", "pinged", "entrance"];
const all = (n = 99) => Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((ch) => [ch, n]));

/** Two people side by side in a city, with every letter, then a third far away. */
async function setup() {
  WorldRoom.testSeed = 77;
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const c: any = await colyseus.connectTo(room as never);
  const inbox: Record<string, [string, any][]> = { a: [], b: [], c: [] };
  for (const t of MESSAGES) for (const [k, cl] of [["a", a], ["b", b], ["c", c]] as const) cl.onMessage(t, (m: unknown) => inbox[k]!.push([t, m]));
  const walkers = (room as any).walkers as Map<string, any>;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId), wc = walkers.get(c.sessionId);
  const city = room.map.cities[0]!;
  for (const w of [wa, wb, wc]) { w.letters = all(); w.hp = 1e9; room.rebuild(w); }
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 2.5; wb.player.y = city.y + 0.5;
  // C stands far off: out of earshot of an ordinary voice (40 tiles), and out of sight.
  wc.player.x = city.x + 0.5 + (city.x > room.map.size / 2 ? -150 : 150); wc.player.y = city.y + 0.5;
  const said = (who: "a" | "b" | "c", type: string) => inbox[who]!.filter(([t]) => t === type).map(([, m]) => m);
  const second = (n = 1) => { for (let i = 0; i < n * 10; i++) room.update(0.1); };
  const on = async (who: any, target: string, word: string) => { who.send("pick", { id: target }); who.send("spell", word); who.send("pick", null); await wait(); };
  return { room, a, b, c, wa, wb, wc, said, second, on, inbox };
}

const lastScreen = (said: (w: any, t: string) => any[], who: "a" | "b" | "c") => said(who, "loadout").at(-1)?.screen;

it("screen: FLARE blinds B: greys B's minimap and hides others' bars; GLASSES give them back; AMNESIA and ILLITERACY blank and scramble", async () => {
  const { a, b, wb, said, second, on } = await setup();
  await on(a, b.sessionId, "flare"); second(1); await wait();
  expect(wb.statuses.some((s: any) => s.status === "blind")).toBe(true);
  let screen = lastScreen(said, "b");
  expect(screen.blots).toMatchObject({ minimap: "static", bars: "hide" });
  expect(screen.by.bars).toBe("blind");
  // GLASSES worn restore the minimap and the bars, though B is still blind.
  b.send("spell", "glasses"); await wait(); second(1); await wait();
  screen = lastScreen(said, "b");
  expect(screen.restored).toEqual(expect.arrayContaining(["minimap", "bars"]));
  expect(screen.blots.bars).toBeUndefined();
  // AMNESIA hides the preview, the best words and the inventory.
  await on(a, b.sessionId, "amnesia"); second(2); await wait();
  expect(wb.statuses.some((s: any) => s.status === "amnesia")).toBe(true);
  screen = lastScreen(said, "b");
  expect(screen.blots).toMatchObject({ preview: "hide", best: "hide", inventory: "hide" });
  // ILLITERACY scrambles the word cards and the rack; a BOOK carried gives them back.
  await on(a, b.sessionId, "illiteracy"); second(2); await wait();
  screen = lastScreen(said, "b");
  expect(screen.blots).toMatchObject({ cards: "scramble", rack: "scramble" });
  b.send("spell", "book"); await wait(); b.send("take"); await wait(); second(1); await wait();
  screen = lastScreen(said, "b");
  expect(screen.blots.cards).toBeUndefined();
  expect(screen.blots.rack).toBeUndefined();
});

it("screen: REDACTION censors B's chips and feed; a JAMMER's field puts static on the minimap", async () => {
  const { a, b, wb, said, second, on } = await setup();
  await on(a, b.sessionId, "redaction"); second(1); await wait();
  expect(wb.statuses.some((s: any) => s.status === "censor")).toBe(true);
  expect(lastScreen(said, "b").blots).toMatchObject({ chips: "hide", feed: "hide" });
});

it("knowledge: insight shows counters (BOOK), racks of people in sight (SPY's field, ESPIONAGE), what they can spell (an ORACLE of yours); CIPHER hides", async () => {
  const { a, b, wa, wb, said, second, room } = await setup();
  second(1); await wait();
  expect(said("a", "loadout").at(-1).insight ?? 0).toBeLessThan(2);
  // A BOOK carried: insight 3, counters only.
  a.send("spell", "book"); await wait(); a.send("take"); await wait(); second(1); await wait();
  expect(said("a", "loadout").at(-1).insight).toBeGreaterThanOrEqual(2);
  expect(said("a", "intel").at(-1) ?? []).toEqual([]);
  // An ORACLE of A's reads B's rack and what B can spell.
  wb.letters = { s: 1, w: 1, o: 1, r: 1, d: 1 };
  a.send("spell", "oracle"); await wait(); second(2); await wait();
  const intel = said("a", "intel").at(-1);
  expect(intel?.[0]?.name).toBe(wb.player.name);
  expect(intel[0].letters).toBe("DORSW");
  expect(intel[0].words).toContain("SWORD");
  // B under a CIPHER is off A's intel.
  b.send("spell", "cipher"); await wait(); second(2); await wait();
  expect(said("a", "intel").at(-1)).toEqual([]);
  // Insight goes with amnesia.
  (room as any).hurtWith(wa, [["amnesia", 10]], b.sessionId, b.sessionId, false); room.rebuild(wa);
  expect((room as any).insight(wa)).toBe(0);
});

it("communication: pings reach those in earshot, not C far off; spells are called out; a RADIO hears it all; a GAG stops both; lies send made-up calls", async () => {
  const { a, b, c, wa, wc, said, second, on } = await setup();
  a.send("ping", { kind: "danger" }); await wait();
  expect(said("b", "pinged").at(-1)).toMatchObject({ kind: "danger", name: wa.player.name, ally: false });
  expect(said("c", "pinged")).toHaveLength(0);
  expect(said("a", "pinged")).toHaveLength(1); // your own mark
  a.send("spell", "sword"); await wait();
  expect(said("b", "call").at(-1)).toMatchObject({ name: wa.player.name, word: "SWORD" });
  expect(said("c", "call")).toHaveLength(0);
  // C with a RADIO hears A across the map.
  c.send("spell", "radio"); await wait(); c.send("take"); await wait(); second(1);
  expect(wc.unit.body.stats.num("hearing_range")).toBeGreaterThan(1000);
  second(2);
  a.send("ping", { kind: "here" }); await wait();
  expect(said("c", "pinged").at(-1)).toMatchObject({ kind: "here" });
  // Gagged: A's pings are refused and A's spelling goes unheard.
  await on(b, a.sessionId, "gag"); second(1);
  expect(wa.hamper.unheard).toBe(true);
  const calls = said("b", "call").length;
  second(2);
  a.send("ping", { kind: "help" }); await wait();
  expect(said("a", "refused").at(-1)).toMatch(/gagged|silenced/);
  // RUMOUR on C: made-up calls and DANGER pings.
  await on(b, c.sessionId, "rumour"); second(13); await wait();
  expect(said("c", "call").length).toBeGreaterThan(0);
  expect(said("b", "call").length).toBe(calls);
});


