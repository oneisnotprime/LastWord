import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { generateMap, Tile, tileAt, walkable } from "@lastword/shared";
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

  expect(inbox.spelled).toEqual(["SWORD equipped"]);
  expect(inbox.refused).toHaveLength(3);
  expect(inbox.refused[0]).toBe("ZZZ is not in the dictionary yet");
  const after = inbox.letters.at(-1) as Record<string, number>;
  expect(after.s).toBe(before.s! - 1);
  expect(after.w).toBe(before.w! - 1);

  // A sword is held, so it goes into the hand, not onto the ground.
  expect(a.state.players.get(a.sessionId).gear).toBe("sword");
  expect(a.state.things.size).toBe(0);

  // Dropping it puts it on the ground where others in sight can see it; taking picks it up.
  a.send("drop");
  await new Promise((r) => setTimeout(r, 200));
  await (room as any).waitForNextPatch();
  const things = [...a.state.things.values()];
  expect(things).toHaveLength(1);
  expect(things[0]).toMatchObject({ phrase: "sword", owner: a.sessionId });
  expect(things[0].x).toBeCloseTo(50);
  expect(b.state.things.size).toBe(0); // out of sight
  a.send("take");
  await new Promise((r) => setTimeout(r, 200));
  await (room as any).waitForNextPatch();
  expect(a.state.players.get(a.sessionId).gear).toBe("sword");
  expect(a.state.things.size).toBe(0);

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

it("fights: armor breaks before the body, the dead are knocked out and the last one alive wins", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const got = { a: [] as [string, unknown][], b: [] as [string, unknown][] };
  for (const type of ["letters", "spelled", "refused", "notice", "dead", "won"]) {
    a.onMessage(type, (m: unknown) => got.a.push([type, m]));
    b.onMessage(type, (m: unknown) => got.b.push([type, m]));
  }
  const walkers = (room as any).walkers;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 3.5; wb.player.y = city.y + 0.5;
  const wait = () => new Promise((r) => setTimeout(r, 150));

  wa.letters = { g: 1, u: 1, n: 1, h: 1, a: 1, t: 1 };
  wb.letters = { a: 1, r: 2, m: 1, o: 1, z: 3 };
  a.send("spell", "gun");
  b.send("spell", "armor");
  await wait();
  expect(wa.player.gear).toBe("gun");
  expect(wb.player.gear).toBe("armor");
  a.send("spell", "hat"); // a second thing for the head would be refused; one is fine
  await wait();
  expect(wa.player.gear).toBe("gun, hat");

  // Out of reach the attacker walks toward its target and does not fire: a gun reaches 50 m, 12.5 tiles.
  wb.player.x = city.x + 30.5;
  a.send("attack", b.sessionId);
  await wait();
  const startX = wa.player.x;
  for (let i = 0; i < 10; i++) room.update(0.1);
  expect(wb.hp).toBe(100);
  expect(wb.gear[0].integrity).toBe(400);
  expect(wa.player.x).toBeGreaterThan(startX);

  // In reach the armor takes every hit until it breaks; only then is the body hurt.
  wb.player.x = wa.player.x + 3;
  let armorBrokeAt = -1;
  for (let i = 0; i < 2000 && walkers.has(b.sessionId); i++) {
    room.update(0.1);
    if (armorBrokeAt < 0 && wb.gear.length === 0) {
      armorBrokeAt = i;
      expect(wb.hp).toBe(100);
    }
  }
  await wait();
  expect(armorBrokeAt).toBeGreaterThan(0);
  expect(walkers.has(b.sessionId)).toBe(false);
  expect(room.state.players.has(b.sessionId)).toBe(false);
  expect(got.b.some(([t, m]) => t === "notice" && m === "Your ARMOR was destroyed")).toBe(true);
  expect(got.b.find(([t]) => t === "dead")![1]).toBe(wa.player.name);
  expect(wa.letters.z).toBe(3); // the dead player's letters go to the killer
  expect(got.a.some(([t]) => t === "won")).toBe(true);
});

it("lays terrain, pushes players out of it, and lets things on the ground be destroyed for letters", async () => {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const a: any = await colyseus.connectTo(room as never);
  const b: any = await colyseus.connectTo(room as never);
  const got = { a: [] as [string, unknown][], b: [] as [string, unknown][] };
  for (const type of ["letters", "spelled", "refused", "notice", "dead", "won"]) {
    a.onMessage(type, (m: unknown) => got.a.push([type, m]));
    b.onMessage(type, (m: unknown) => got.b.push([type, m]));
  }
  const walkers = (room as any).walkers;
  const wa = walkers.get(a.sessionId), wb = walkers.get(b.sessionId);
  const city = room.map.cities[0]!;
  wa.player.x = city.x + 0.5; wa.player.y = city.y + 0.5;
  wb.player.x = city.x + 1.5; wb.player.y = city.y + 0.5;
  const wait = () => new Promise((r) => setTimeout(r, 150));

  // A pond is water two tiles across; both players end up on its shore, and clients are told.
  wa.letters = { p: 1, o: 1, n: 1, d: 1 };
  a.send("spell", "pond");
  await wait();
  await (room as any).waitForNextPatch();
  expect(tileAt(room.map, city.x + 0.5, city.y + 0.5)).toBe(Tile.Water);
  for (const w of [wa, wb]) expect(walkable(room.map, w.player.x, w.player.y)).toBe(true);
  expect(b.state.edits.length).toBe(1);
  expect(b.state.edits[0].tile).toBe(Tile.Water);
  const pond = [...room.state.things.entries()].find(([, t]) => t.phrase === "pond")![0];
  a.send("take");
  a.send("attack", pond); // part of the land: neither carried nor attacked
  await wait();
  expect(wa.gear).toHaveLength(0);
  expect(wa.foe).toBeNull();

  // B builds a chair; A smashes it and earns D for destroying and V for beating another's thing.
  wb.letters = { c: 1, h: 1, a: 1, i: 1, r: 1 };
  b.send("spell", "chair");
  await wait();
  const chair = [...room.state.things.entries()].find(([, t]) => t.phrase === "chair")![0];
  wa.letters = {};
  wa.player.x = wb.player.x; wa.player.y = wb.player.y; // there is no path-finding around the pond yet
  a.send("attack", chair);
  await wait();
  for (let i = 0; i < 300 && room.state.things.has(chair); i++) room.update(0.1);
  await wait();
  expect(room.state.things.has(chair)).toBe(false);
  expect(wa.letters).toEqual({ d: 1, v: 1 });
  expect(got.b.some(([t, m]) => t === "notice" && m === "Your CHAIR was destroyed")).toBe(true);
});
