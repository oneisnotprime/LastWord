import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { generateMap, tileAt, walkable } from "@lastword/shared";
import appConfig from "./app.config.js";
import type { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { colyseus = await boot(appConfig); });
afterAll(async () => { await colyseus.shutdown(); });

const visible = (client: any) => [...client.state.players.keys()].sort();

it("spawns players on walkable ground and tells the client the map seed", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  await (room as any).waitForNextPatch();
  expect(a.state.seed).toBe(room.map.seed);
  expect(generateMap(a.state.seed).tiles).toEqual(room.map.tiles);
  const me = a.state.players.get(a.sessionId);
  expect(walkable(room.map, me.x, me.y)).toBe(true);
  expect(tileAt(room.map, me.x, me.y)).toBeDefined();
});

it("sends a client only the players inside its sight range", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const pa = room.state.players.get(a.sessionId)!, pb = room.state.players.get(b.sessionId)!;

  // Sight is 60 m, which is 15 tiles. Put them 100 tiles apart.
  pa.x = 50; pa.y = 50; pb.x = 150; pb.y = 50;
  room.refreshViews();
  await (room as any).waitForNextPatch();
  expect(visible(a)).toEqual([a.sessionId]);
  expect(visible(b)).toEqual([b.sessionId]);

  pb.x = 60;
  room.refreshViews();
  await (room as any).waitForNextPatch();
  expect(visible(a)).toEqual([a.sessionId, b.sessionId].sort());
  expect(a.state.players.get(b.sessionId).x).toBeCloseTo(60);

  pb.x = 150;
  room.refreshViews();
  await (room as any).waitForNextPatch();
  expect(visible(a)).toEqual([a.sessionId]);
});

it("walks a player toward the point it asks for", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const p = room.state.players.get(a.sessionId)!;
  const city = room.map.cities[0]!;
  p.x = city.x + 0.5; p.y = city.y + 0.5;
  a.send("move", { x: p.x + 2, y: p.y });
  await new Promise((r) => setTimeout(r, 300));
  for (let i = 0; i < 20; i++) room.update(0.1);
  expect(p.x).toBeCloseTo(city.x + 2.5, 1);
  a.send("move", { x: "nonsense" });
  a.send("move", null);
  await new Promise((r) => setTimeout(r, 100));
  expect(room.clients.length).toBe(1);
});

it("spells a word into an object, spends the letters, and refuses what it cannot make", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const inbox = { letters: [] as unknown[], spelled: [] as unknown[], refused: [] as unknown[] };
  for (const type of ["letters", "spelled", "refused"] as const) a.onMessage(type, (m: unknown) => inbox[type].push(m));
  for (const type of Object.keys(inbox)) b.onMessage(type, () => {});
  const pa = room.state.players.get(a.sessionId)!, pb = room.state.players.get(b.sessionId)!;
  pa.x = 50; pa.y = 50; pb.x = 150; pb.y = 50;
  await new Promise((r) => setTimeout(r, 100));
  // The first hand is sent on join, before this test could listen; read it from the room.
  const before = { ...(room as any).walkers.get(a.sessionId).letters } as Record<string, number>;
  expect(before.s).toBeGreaterThanOrEqual(1);

  a.send("spell", "sword");
  a.send("spell", "zzz");
  a.send("spell", "quetzal sword");
  a.send("spell", 42);
  await new Promise((r) => setTimeout(r, 300));
  await (room as any).waitForNextPatch();

  expect(inbox.spelled).toEqual(["sword"]);
  expect(inbox.refused).toHaveLength(3);
  expect(inbox.refused[0]).toBe("ZZZ is not in the dictionary yet");
  const after = inbox.letters.at(-1) as Record<string, number>;
  expect(after.s).toBe(before.s! - 1);
  expect(after.w).toBe(before.w! - 1);

  const things = [...a.state.things.values()];
  expect(things).toHaveLength(1);
  expect(things[0]).toMatchObject({ phrase: "sword", owner: a.sessionId });
  expect(things[0].x).toBeCloseTo(50);
  expect(b.state.things.size).toBe(0); // out of sight

  for (let i = 0; i < 6; i++) a.send("spell", "sword");
  await new Promise((r) => setTimeout(r, 300));
  expect(inbox.refused.at(-1)).toMatch(/^You need /);
});

it("gathers letters from the ground, pays out production, and passes letters between players", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const got = { a: [] as [string, unknown][], b: [] as [string, unknown][] };
  for (const type of ["letters", "spelled", "refused", "gathered", "notice"]) {
    a.onMessage(type, (m: unknown) => got.a.push([type, m]));
    b.onMessage(type, (m: unknown) => got.b.push([type, m]));
  }
  const walkers = (room as any).walkers;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 1.5; wb.player.y = city.y + 0.5;
  const count = (w: any) => Object.values(w.letters as Record<string, number>).reduce((n, v) => n + v, 0);
  const wait = () => new Promise((r) => setTimeout(r, 150));

  // Gathering takes two seconds of standing still and yields a city letter.
  const start = count(wa);
  a.send("gather");
  await wait();
  room.update(1);
  expect(count(wa)).toBe(start);
  room.update(1.1);
  await wait();
  expect(count(wa)).toBe(start + 1);
  expect(got.a.find(([t]) => t === "gathered")![1]).toMatch(/^[lnst]$/);

  // Moving cancels a gathering.
  a.send("gather");
  await wait();
  a.send("move", { x: wa.player.x, y: wa.player.y });
  await wait();
  room.update(3);
  expect(count(wa)).toBe(start + 1);

  // A farm pays its owner two A a minute.
  wa.letters = { f: 1, a: 1, r: 1, m: 1 };
  a.send("spell", "farm");
  await wait();
  expect(wa.letters.a).toBe(0);
  room.update(60);
  expect(wa.letters.a).toBe(2);

  // Letters pass between players who stand close, and only then.
  a.send("give", { to: wb.player.name, letters: "aa" });
  await wait();
  expect(wa.letters.a).toBe(0);
  expect(wb.letters.a).toBeGreaterThanOrEqual(2);
  expect(got.b.some(([t, m]) => t === "notice" && /gave you AA/.test(String(m)))).toBe(true);
  a.send("give", { to: wb.player.name, letters: "zz" });
  await wait();
  wb.player.x += 50;
  a.send("give", { to: wb.player.name, letters: "f" });
  a.send("give", { to: "nobody", letters: "f" });
  a.send("give", "nonsense");
  await wait();
  expect(got.a.filter(([t]) => t === "refused").map(([, m]) => m)).toEqual([
    "You need Z Z", `${wb.player.name} is too far away`, "nobody is not here", "Give whom what? Try: give player2 abc",
  ]);
});
