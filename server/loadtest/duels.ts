/**
 * Duel tournament: the same duels fought in real time and in battle rounds (shared battle.ts).
 *
 *   COMBAT=turns|realtime npx tsx loadtest/duels.ts [rooms=12] [bots=8] [difficulty=mixed|easy|normal|hard] [minutes=4]
 *
 * Each room plays `minutes` of an ordinary round of bots (kits, gathering, gear), then every
 * living bot is paired with another and a DUEL is spelled between each pair: a ring, stakes, blows
 * that cannot kill. The room is stepped until every duel has ended. SEED_BASE gives the maps; the
 * same seeds give the same bots and gear in both modes up to the duels, so the two can be compared.
 * Prints how long duels ran (in seconds, and in rounds for battles), how they ended, and what was done in them.
 */
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { WorldRoom, type BattleRecord } from "../src/WorldRoom.js";
import type { Difficulty } from "../src/bots.js";
import { parsePhrase, bars } from "@lastword/shared";

const [rooms = 12, bots = 8] = process.argv.slice(2, 4).map(Number);
const mode = (process.argv[4] ?? "mixed") as Difficulty | "mixed";
const minutes = Number(process.argv[5] ?? 4);
const combat = process.env.COMBAT === "realtime" ? "realtime" : "turns";

await appConfig.listen(Number(process.env.PORT ?? 2569));
const server = new ColyseusTestServer(appConfig);
interface Duel { seconds: number; why: string; decided: boolean; favourite: boolean | null; hp: [number, number]; blows: number; firstBlow: number; spells: number; levels: string }
const duels: Duel[] = [];
const battles: BattleRecord[] = [];
const pct = (a: number[], q: number) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))]!.toFixed(1) : "-"; };
const share = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(0)}%` : "-");
const tally = (list: string[]) => { const m = new Map<string, number>(); for (const k of list) m.set(k, (m.get(k) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "-"; };

for (let r = 0; r < rooms; r++) {
  WorldRoom.testSeed = Number(process.env.SEED_BASE ?? 1000) + r * 7919;
  const room = (await server.createRoom("world", { bots: mode === "mixed" ? 0 : bots, difficulty: mode === "mixed" ? "easy" : mode, combat })) as unknown as WorldRoom;
  if (mode === "mixed") for (let i = 0; i < bots; i++) room.addBots(1, (["easy", "normal", "hard"] as const)[i % 3]!);
  const any = room as any;
  let seconds = 0;
  const step = (n: number) => { for (let i = 0; i < n * 10 && room.state.phase !== "over"; i++) { room.update(0.1); seconds += 0.1; } };
  step(minutes * 60);
  // Pair the living, in id order, and bring each pair together where the first stands.
  const alive = [...any.bots.keys()].filter((id: string) => any.walkers.has(id)).sort() as string[];
  const open = new Map<unknown, { from: number; a: string; b: string; total: [number, number]; blows: number; firstBlow: number; spelled: number; levels: string }>();
  const settle = any.settleChallenge.bind(room), blow = any.blow.bind(room), spellWord = any.spellWord.bind(room);
  const total = (id: string) => bars(any.walkers.get(id).unit).reduce((n: number, b: { hp: number }) => n + b.hp, 0);
  any.settleChallenge = (key: string, c: any, winner: string | null, why: string) => {
    const d = open.get(c);
    if (d) {
      const fav = d.total[0] === d.total[1] ? null : d.total[0] > d.total[1] ? d.a : d.b;
      duels.push({ seconds: seconds - d.from, why: why.replace(/^\S+ (ran|gave up|was knocked down)$/, "$1"), decided: winner !== null, favourite: winner === null || fav === null ? null : winner === fav, hp: d.total, blows: d.blows, firstBlow: d.firstBlow, spells: d.spelled, levels: d.levels });
      open.delete(c);
    }
    return settle(key, c, winner, why);
  };
  any.blow = (by: string, on: string, res: { hit: boolean; damage: number }, ...rest: unknown[]) => {
    for (const d of open.values()) if ((d.a === by && d.b === on) || (d.b === by && d.a === on)) { if (res.hit && res.damage > 0) { d.blows++; if (d.firstBlow < 0) d.firstBlow = seconds - d.from; } }
    return blow(by, on, res, ...rest);
  };
  any.spellWord = (id: string, w: unknown, text: unknown) => { const out = spellWord(id, w, text); for (const d of open.values()) if (d.a === id || d.b === id) d.spelled++; return out; };
  const duel = parsePhrase(any.dict, "duel");
  for (let i = 0; i + 1 < alive.length; i += 2) {
    const a = alive[i]!, b = alive[i + 1]!;
    const wa = any.walkers.get(a), wb = any.walkers.get(b);
    wb.player.x = wa.player.x + 1; wb.player.y = wa.player.y;
    wa.picked = b;
    const had = new Set(any.challenges.values());
    try { any.challenge(a, wa, duel); } catch (e) { console.log(`  no duel ${a} ${b}: ${(e as Error).message}`); continue; } finally { wa.picked = null; }
    for (const c of any.challenges.values()) if (!had.has(c)) open.set(c, { from: seconds, a, b, total: [total(a), total(b)], blows: 0, firstBlow: -1, spelled: 0, levels: [a, b].map((id) => any.bots.get(id).difficulty).sort().join(" v ") });
    // In real time a duel is a fight: each goes for the other, as when a bot spells DUEL on whoever it fights.
    wa.foe = b; wb.foe = a;
    for (const id of [a, b]) any.bots.get(id).peaceUntil = 0;
  }
  const started = open.size;
  for (let t = 0; t < 200 && open.size && room.state.phase !== "over"; t++) step(1);
  for (const [c, d] of open) duels.push({ seconds: seconds - d.from, why: "unfinished", decided: false, favourite: null, hp: d.total, blows: d.blows, firstBlow: d.firstBlow, spells: d.spelled, levels: d.levels }), open.delete(c);
  battles.push(...room.battleLog);
  console.log(`room ${r + 1}: ${alive.length} alive at ${minutes} min, ${started} duels`);
  await room.disconnect().catch(() => {});
}
WorldRoom.testSeed = null;

console.log(`\nCombat: ${combat}; duels ${duels.length}`);
console.log(`Length (s): median ${pct(duels.map((d) => d.seconds), 0.5)}, p25 ${pct(duels.map((d) => d.seconds), 0.25)}, p75 ${pct(duels.map((d) => d.seconds), 0.75)}, max ${pct(duels.map((d) => d.seconds), 1)}`);
console.log(`First blow landed after (s): median ${pct(duels.filter((d) => d.firstBlow >= 0).map((d) => d.firstBlow), 0.5)}; no blow landed in ${share(duels.filter((d) => d.blows === 0).length, duels.length)}`);
console.log(`Blows landed a duel: median ${pct(duels.map((d) => d.blows), 0.5)}; words spelled in a duel: mean ${(duels.reduce((n, d) => n + d.spells, 0) / Math.max(1, duels.length)).toFixed(2)}, duels with a word ${share(duels.filter((d) => d.spells > 0).length, duels.length)}`);
console.log(`Ended by: ${tally(duels.map((d) => d.why))}`);
console.log(`Decided (someone took the pot): ${share(duels.filter((d) => d.decided).length, duels.length)}; knock-downs ${share(duels.filter((d) => /knocked down/.test(d.why)).length, duels.length)}`);
const fav = duels.filter((d) => d.favourite !== null);
console.log(`Won by the side with less total HP at the start: ${share(fav.filter((d) => !d.favourite).length, fav.length)} of ${fav.length}`);
if (battles.length) {
  const sum = (f: (b: BattleRecord) => number) => battles.reduce((n, b) => n + f(b), 0);
  const acts = new Map<string, number>();
  for (const b of battles) for (const [k, n] of Object.entries(b.actions)) acts.set(k, (acts.get(k) ?? 0) + n);
  const all = [...acts.values()].reduce((a, b) => a + b, 0);
  const down = battles.filter((b) => b.why === "down");
  console.log(`Battles: ${battles.length}`);
  console.log(`  rounds: median ${pct(battles.map((b) => b.rounds), 0.5)}, p25 ${pct(battles.map((b) => b.rounds), 0.25)}, p75 ${pct(battles.map((b) => b.rounds), 0.75)}, mean ${(sum((b) => b.rounds) / battles.length).toFixed(1)}`);
  console.log(`  time to knock-down: median ${pct(down.map((b) => b.rounds), 0.5)} rounds (${down.length}); knocked down in round 1 or 2: ${share(down.filter((b) => b.rounds <= 2).length, battles.length)}`);
  console.log(`  ended by: ${tally(battles.map((b) => b.why))}; at the cap ${share(battles.filter((b) => b.why === "cap").length, battles.length)}`);
  console.log(`  flee: ${sum((b) => b.fleeTries)} tries, ${share(sum((b) => b.fleeOk), sum((b) => b.fleeTries))} got away; battles ended by flight ${share(battles.filter((b) => b.why === "fled").length, battles.length)}`);
  console.log(`  actions (${all}): ${[...acts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${share(n, all)}`).join(", ")}; not Attack ${share(all - (acts.get("attack") ?? 0), all)}`);
  console.log(`  heavy blows: ${sum((b) => b.heavy)}, dodged by Defend ${share(sum((b) => b.dodged), sum((b) => b.heavy))}; battles with a dodge ${share(battles.filter((b) => b.dodged > 0).length, battles.length)}`);
  console.log(`  round length: ${(sum((b) => b.seconds) / Math.max(1, sum((b) => b.rounds))).toFixed(1)} s (bots: fixed); timeouts ${sum((b) => b.timeouts)} of ${sum((b) => b.choices)} choices by people`);
  const words = battles.flatMap((b) => b.spells);
  console.log(`  words spelled as moves: ${words.length} (${new Set(words).size} different; in ${share(battles.filter((b) => b.spells.length > 0).length, battles.length)} of battles): ${tally(words).split(", ").slice(0, 16).join(", ")}`);
}
await server.shutdown();
process.exit(0);
