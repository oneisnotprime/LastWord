import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import appConfig from "./app.config.js";
import { WorldRoom } from "./WorldRoom.js";

let colyseus: ColyseusTestServer;
beforeAll(async () => { WorldRoom.testBare = true; colyseus = await boot(appConfig); });
afterAll(async () => { WorldRoom.testBare = false; await colyseus.shutdown(); });

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const ticks = (room: WorldRoom, n: number) => { for (let i = 0; i < n; i++) room.update(0.1); };
const TYPES = ["hits", "letters", "loadout", "dead", "won", "roundover", "gathered", "gathering", "got", "spelled", "refused", "notice", "sensed", "watching", "described", "nothing"];

async function player(letters?: Record<string, number>) {
  const room = (await colyseus.createRoom("world", {})) as unknown as WorldRoom;
  const c: any = await colyseus.connectTo(room as never);
  const got: [string, any][] = [];
  for (const t of TYPES) c.onMessage(t, (m: any) => got.push([t, m]));
  const r = room as any, walkers = r.walkers as Map<string, any>, w = walkers.get(c.sessionId);
  const city = room.map.cities[0]!;
  w.player.x = city.x + 0.5; w.player.y = city.y + 0.5;
  if (letters) w.letters = { ...letters };
  room.rebuild(w);
  const of = (t: string) => got.filter(([k]) => k === t).map(([, m]) => m);
  return { room, r, c, w, walkers, city, got, of };
}

it("a wild FOX that was running from you and then joins you stops fleeing and follows you", async () => {
  const { room, r, c, w, walkers } = await player();
  const id = r.addCreature({ spelled: { noun: "fox" }, phrase: "fox", vehicle: false, integrity: null }, "-", w.player.x + 3, w.player.y);
  const fox = walkers.get(id);
  r.refreshViews();
  // Badly hurt by the player (a fox is cunning): it pulls back from them.
  fox.hp = 5;
  ticks(room, 12);
  expect(fox.fleeing).toBe(true);
  expect(fox.player.status).toMatch(/retreating/);
  r.setMaster(id, fox, c.sessionId);
  ticks(room, 30);
  expect(fox.fleeFrom).toBeNull(); // still hurt, but nobody near is its enemy now
  expect(fox.player.status).not.toMatch(/fleeing|retreating|wild/);
  // Badly hurt, with nobody near to run from: it keeps with its master and wears no running label.
  w.player.x += 8;
  ticks(room, 40);
  expect(fox.player.status).not.toMatch(/fleeing|retreating/);
  expect(Math.hypot(fox.player.x - w.player.x, fox.player.y - w.player.y)).toBeLessThan(4);
});
