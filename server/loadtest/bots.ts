// Connects bots, then reports traffic.
// usage: tsx loadtest/bots.ts [clients=100] [seconds=600] [endpoint=http://localhost:2567] [mode=wander]
//
// Modes:
//   wander  walk about at random (movement and views only)
//   crowd   walk to the first city and mill about; start the server with CROWD=1 for the worst
//           case, where everyone sees everyone from the start
//   play    play the game: gather, spell whatever the letters allow, attack whoever is in sight
import { readFileSync } from "node:fs";
import { Client } from "@colyseus/sdk";
import { generateMap, missing, type Letters } from "@lastword/shared";
import { loadDictionary } from "../src/data.js";

const clients = Number(process.argv[2] ?? 100);
const seconds = Number(process.argv[3] ?? 600);
const endpoint = process.argv[4] ?? "http://localhost:2567";
const mode = process.argv[5] ?? "wander";
let gather: { x: number; y: number } | null = null;

/** Bytes that have crossed the loopback interface; the test runs on one machine. */
function loopbackBytes(): number {
  const line = readFileSync("/proc/net/dev", "utf8").split("\n").find((l) => l.trim().startsWith("lo:"));
  return line ? Number(line.split(":")[1]!.trim().split(/\s+/)[0]) : NaN;
}

const dict = loadDictionary();
const spellable = [...dict.words].filter(([, d]) => d.role === "noun" || d.role === "verb").map(([w]) => w);
const tally = { patches: 0, seenTotal: 0, seenSamples: 0, errors: 0, spelled: 0, refused: 0, dead: 0, won: 0 };
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)]!;

async function bot(i: number) {
  const room: any = await new Client(endpoint).joinOrCreate("world", {});
  let letters: Letters = {}, alive = true;
  room.onStateChange(() => { tally.patches++; });
  room.onError(() => { tally.errors++; });
  room.onMessage("letters", (held: Letters) => { letters = held; });
  room.onMessage("spelled", () => { tally.spelled++; });
  room.onMessage("refused", () => { tally.refused++; });
  room.onMessage("dead", () => { alive = false; tally.dead++; });
  room.onMessage("won", () => { tally.won++; });
  for (const type of ["notice", "gathered", "loadout"]) room.onMessage(type, () => {});

  const wander = (me: any, spread: number, near = me) =>
    room.send("move", { x: near.x + (Math.random() - 0.5) * spread, y: near.y + (Math.random() - 0.5) * spread });

  const act = () => {
    const me = room.state.players?.get(room.sessionId);
    if (!alive || !me) return;
    let people = 0, nearest: string | null = null, nearestDistance = Infinity;
    room.state.players.forEach((p: any, id: string) => {
      if (id === room.sessionId || p.owner === room.sessionId) return;
      if (p.owner === "") people++;
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      if (p.owner !== "-" && d < nearestDistance) { nearest = id; nearestDistance = d; }
    });
    tally.seenTotal += people;
    tally.seenSamples++;

    if (mode === "crowd") {
      gather ??= generateMap(room.state.seed).cities[0]!;
      return wander(me, 8, gather);
    }
    if (mode !== "play") return wander(me, 80);

    const roll = Math.random();
    if (nearest && roll < 0.5) return room.send("attack", nearest);
    if (roll < 0.75) {
      const can = spellable.filter((w) => !missing(letters, w));
      if (can.length) return room.send("spell", pick(can));
    }
    if (roll < 0.9) return room.send("gather");
    wander(me, 40);
  };
  setTimeout(() => { act(); setInterval(act, 2000 + Math.random() * 3000); }, 500 + i * 10);
  return room;
}

const rooms = await Promise.all(Array.from({ length: clients }, (_, i) => bot(i)));
console.log(`${rooms.length} bots connected; mode ${mode}; running ${seconds}s`);
const startBytes = loopbackBytes(), started = Date.now();
await new Promise((r) => setTimeout(r, seconds * 1000));
const elapsed = (Date.now() - started) / 1000;
const bytes = loopbackBytes() - startBytes;
console.log(
  `result clients=${clients} mode=${mode} seconds=${elapsed.toFixed(0)} ` +
  `kb_per_client_per_s=${(bytes / 1024 / clients / elapsed).toFixed(2)} total_mbit_s=${((bytes * 8) / 1e6 / elapsed).toFixed(2)} ` +
  `patches_per_client_per_s=${(tally.patches / clients / elapsed).toFixed(1)} avg_people_in_sight=${(tally.seenTotal / Math.max(1, tally.seenSamples)).toFixed(1)} ` +
  `spelled=${tally.spelled} refused=${tally.refused} dead=${tally.dead} won=${tally.won} errors=${tally.errors}`,
);
await Promise.all(rooms.map((r) => r.leave().catch(() => {})));
process.exit(0);
