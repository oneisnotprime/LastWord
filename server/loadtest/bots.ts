// Connects bots that wander the map, then reports traffic.
// usage: tsx loadtest/bots.ts [clients=100] [seconds=600] [endpoint=http://localhost:2567] [crowd]
// With "crowd", every bot walks to the first city and mills about there: the worst case for
// sight-based views, since everyone sees everyone.
import { readFileSync } from "node:fs";
import { Client } from "@colyseus/sdk";
import { generateMap } from "@lastword/shared";

const clients = Number(process.argv[2] ?? 100);
const seconds = Number(process.argv[3] ?? 600);
const endpoint = process.argv[4] ?? "http://localhost:2567";
const crowd = process.argv[5] === "crowd";
let gather: { x: number; y: number } | null = null;

/** Bytes that have crossed the loopback interface; the test runs on one machine. */
function loopbackBytes(): number {
  const line = readFileSync("/proc/net/dev", "utf8").split("\n").find((l) => l.trim().startsWith("lo:"));
  return line ? Number(line.split(":")[1]!.trim().split(/\s+/)[0]) : NaN;
}

let patches = 0, seenTotal = 0, seenSamples = 0, errors = 0;

async function bot(i: number) {
  const room: any = await new Client(endpoint).joinOrCreate("world", {});
  room.onStateChange(() => { patches++; });
  room.onError(() => { errors++; });
  const wander = () => {
    const me = room.state.players?.get(room.sessionId);
    if (me) {
      if (crowd) gather ??= generateMap(room.state.seed).cities[0]!;
      const near = gather ?? me, spread = gather ? 8 : 80;
      room.send("move", { x: near.x + (Math.random() - 0.5) * spread, y: near.y + (Math.random() - 0.5) * spread });
      seenTotal += room.state.players.size - 1;
      seenSamples++;
    }
  };
  setTimeout(() => { wander(); setInterval(wander, 2000 + Math.random() * 4000); }, 500 + i * 10);
  return room;
}

const rooms = await Promise.all(Array.from({ length: clients }, (_, i) => bot(i)));
console.log(`${rooms.length} bots connected; running ${seconds}s`);
const startBytes = loopbackBytes(), started = Date.now();
await new Promise((r) => setTimeout(r, seconds * 1000));
const elapsed = (Date.now() - started) / 1000;
const bytes = loopbackBytes() - startBytes;
console.log(
  `result clients=${clients} seconds=${elapsed.toFixed(0)} ` +
  `kb_per_client_per_s=${(bytes / 1024 / clients / elapsed).toFixed(2)} total_mbit_s=${((bytes * 8) / 1e6 / elapsed).toFixed(2)} ` +
  `patches_per_client_per_s=${(patches / clients / elapsed).toFixed(1)} avg_others_in_sight=${(seenTotal / Math.max(1, seenSamples)).toFixed(1)} errors=${errors}`,
);
await Promise.all(rooms.map((r) => r.leave()));
process.exit(0);
