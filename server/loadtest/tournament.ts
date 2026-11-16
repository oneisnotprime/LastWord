/**
 * Bot tournament: plays whole rounds of bots with no humans, headless, and prints which systems
 * the bots used, where their letters came from, and how long rounds ran.
 *
 *   npx tsx loadtest/tournament.ts [rooms=4] [bots=8] [difficulty=mixed|easy|normal|hard] [minutes=60]
 *
 * "mixed" gives each room's bots easy, normal and hard in turn. Rooms play one after another in
 * this process (the room steps by hand, ten ticks to a second, as fast as it can).
 * SEED_BASE=n starts the rooms' seeds elsewhere (default 1000), for a second set of maps.
 * WATCH=words.txt (one word a line) also counts how often bots spelled those words.
 */
import { ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { sourceOf, THEME_SYSTEMS, type Difficulty } from "../src/bots.js";
import { WorldRoom } from "../src/WorldRoom.js";
import { readFileSync } from "node:fs";
import { parsePhrase, STATUS_RULES } from "@lastword/shared";

const [rooms = 4, bots = 8] = process.argv.slice(2, 4).map(Number);
const mode = (process.argv[4] ?? "mixed") as Difficulty | "mixed";
const cap = Number(process.argv[5] ?? 60);

// PORT=2600 runs beside another tournament (`boot` would always take 2568 for a defined server).
await appConfig.listen(Number(process.env.PORT ?? 2568));
const server = new ColyseusTestServer(appConfig);
const used = new Map<Difficulty, Map<string, number>>();
const sources = new Map<string, number>();
const rounds: { minutes: number; winner: string; difficulty: string; firstDeath: number }[] = [];
const wins = new Map<string, number>();
const themedUsers = new Map<string, number>();
// Time to kill: from the first blow of the fight that ended in a death (a gap of ENGAGE_GAP seconds
// with no damage starts a new fight) to the death, for people and for creatures; and what killed.
const ENGAGE_GAP = 10;
const ttk = { person: [] as number[], creature: [] as number[] };
const firstDeaths: number[] = [];
const watched = new Set(process.env.WATCH ? readFileSync(process.env.WATCH, "utf8").split(/\s+/).filter(Boolean) : []);
const spelledWatched = new Map<string, number>();
let spelledAll = 0;
// Letter availability: every 30 s each bot's rack is checked against every watched word (could it spell it now?).
const affordable = new Map<string, number>();
let racks = 0;
const canSpell = (letters: Record<string, number>, word: string) => { const need: Record<string, number> = {}; for (const ch of word) need[ch] = (need[ch] ?? 0) + 1; return Object.entries(need).every(([ch, n]) => (letters[ch] ?? 0) >= n); };
const killers = new Map<string, number>();
// Rack variety: every 30 s each bot's rack is measured (letters held, distinct letters, nouns and
// verbs it could spell now) and its letters added to a tally of what bots hold.
// The opening (first five minutes) is kept apart: later racks are a few hoards.
const rack = { n: 0, size: 0, distinct: [] as number[], spellable: [] as number[], held: new Map<string, number>(), open: { distinct: [] as number[], spellable: [] as number[] } };
const gathered = new Map<string, number>();
// What decided deaths and rounds: a blow (a person's weapon or creature), an area or weather word
// (STORM, NUKE; a person's or the round's own), the storm wall, or the wild.
const deathBy = new Map<string, number>(), roundBy = new Map<string, number>();
let haunts = 0;
// Statuses on the living, every 10 s: how many each person has, and how many keep them helpless.
const statusSamples: number[] = [], helplessSamples: number[] = [];
let spellWords: string[] | null = null;

for (let r = 0; r < rooms; r++) {
  WorldRoom.testSeed = Number(process.env.SEED_BASE ?? 1000) + r * 7919;
  const first = mode === "mixed" ? "easy" : mode;
  const room = (await server.createRoom("world", { bots: mode === "mixed" ? 0 : bots, difficulty: first })) as unknown as WorldRoom;
  if (mode === "mixed") for (let i = 0; i < bots; i++) room.addBots(1, (["easy", "normal", "hard"] as const)[i % 3]!);
  room.onAward = (_id, letters, why) => {
    if (process.env.WHY && sourceOf(why) === process.env.WHY) console.log(why);
    sources.set(sourceOf(why), (sources.get(sourceOf(why)) ?? 0) + letters.length);
    if (sourceOf(why) === "gather") for (const ch of letters) gathered.set(ch, (gathered.get(ch) ?? 0) + 1);
  };
  let seconds = 0;
  const fightFrom = new Map<string, { from: number; last: number }>();
  const anyRoom = room as any;
  const blow = anyRoom.blow.bind(room), kill = anyRoom.kill.bind(room);
  let firstDeath = NaN;
  let lastDeathBy = "";
  const haunt = anyRoom.haunt.bind(room);
  anyRoom.haunt = (...args: unknown[]) => { const out = haunt(...args); haunts++; return out; };
  const deathClass = (w: any, killerId: string): string => {
    const r = anyRoom.recap(w, killerId);
    const what = String(r.what);
    if (what === "wall") return "storm wall";
    const isArea = [...anyRoom.areas.values()].some((a: any) => a.word.toUpperCase() === what) || String(room.state.weatherWord).toUpperCase() === what
      || (() => { try { const k = parsePhrase(anyRoom.dict, what.toLowerCase()).kind; return k === "sky" || k === "event"; } catch { return false; } })();
    if (isArea) return r.killer ? "area/weather (a person's)" : "area/weather (the round's)";
    return r.killer ? "blow" : "wild";
  };
  if (watched.size) {
    const spellWord = anyRoom.spellWord.bind(room);
    anyRoom.spellWord = (id: string, w: unknown, text: unknown) => {
      const out = spellWord(id, w, text);
      spelledAll++;
      const noun = String(text).toLowerCase().trim().split(/\s+/).at(-1)!;
      for (const k of [noun, noun.replace(/s$/, ""), noun.replace(/es$/, "")]) if (watched.has(k)) { spelledWatched.set(k, (spelledWatched.get(k) ?? 0) + 1); break; }
      return out;
    };
  }
  anyRoom.blow = (by: string, on: string, r: { hit: boolean; damage: number }, ...rest: unknown[]) => {
    if (r.hit && r.damage > 0 && anyRoom.walkers.has(on)) {
      const f = fightFrom.get(on);
      if (!f || seconds - f.last > ENGAGE_GAP) fightFrom.set(on, { from: seconds, last: seconds }); else f.last = seconds;
    }
    return blow(by, on, r, ...rest);
  };
  anyRoom.kill = (id: string, killerId: string) => {
    const w = anyRoom.walkers.get(id);
    if (w && w.master !== "-" && w.citizenOf === undefined) {
      const f = fightFrom.get(id);
      const t = f ? seconds - f.from : 0;
      (w.master === null ? ttk.person : ttk.creature).push(t);
      if (w.master === null && Number.isNaN(firstDeath)) {
        firstDeath = Math.round(seconds); firstDeaths.push(seconds);
        const r = anyRoom.recap(w, killerId);
        console.log(`  first death ${(seconds / 60).toFixed(2)} min: ${w.player.name} by ${r.killer || "the wild"}'s ${r.what}`);
      }
      if (w.master === null) { const c = deathClass(w, killerId); deathBy.set(c, (deathBy.get(c) ?? 0) + 1); lastDeathBy = c; }
      if (w.master === null) { const what = String(anyRoom.recap(w, killerId).what).toLowerCase(); killers.set(what, (killers.get(what) ?? 0) + 1); }
    }
    fightFrom.delete(id);
    return kill(id, killerId);
  };
  let sampled = 0;
  let rackAt = 0;
  let statusAt = 0;
  while (room.state.phase !== "over" && seconds < cap * 60) {
    room.update(0.1); seconds += 0.1;
    if (seconds - statusAt >= 10) {
      statusAt = seconds;
      for (const w of anyRoom.walkers.values()) {
        if (w.master !== null || w.unit?.dead) continue;
        statusSamples.push(w.statuses.length);
        helplessSamples.push(w.statuses.filter((a: any) => STATUS_RULES[a.status as keyof typeof STATUS_RULES]?.helpless).length);
      }
    }
    if (seconds - rackAt >= 30) {
      rackAt = seconds;
      spellWords ??= [...anyRoom.dict.words].filter(([w, d]: [string, { role: string }]) => (d.role === "noun" || d.role === "verb") && /^[a-z]+$/.test(w) && !anyRoom.dict.crude(w)).map(([w]: [string]) => w);
      for (const [id, w] of anyRoom.walkers) {
        if (!anyRoom.bots.has(id) || w.unit?.dead) continue;
        const held = Object.entries(w.letters as Record<string, number>).filter(([, n]) => n > 0);
        const spellable = spellWords!.filter((word) => canSpell(w.letters, word)).length;
        rack.n++; rack.distinct.push(held.length); rack.spellable.push(spellable);
        if (seconds <= 300) { rack.open.distinct.push(held.length); rack.open.spellable.push(spellable); }
        for (const [ch, n] of held) { rack.size += n; rack.held.set(ch, (rack.held.get(ch) ?? 0) + n); }
      }
    }
    if (watched.size && seconds - sampled >= 30) {
      sampled = seconds;
      for (const [id, w] of anyRoom.walkers) {
        if (!anyRoom.bots.has(id)) continue;
        racks++;
        for (const word of watched) if (canSpell(w.letters, word)) affordable.set(word, (affordable.get(word) ?? 0) + 1);
      }
    }
  }
  if (room.state.phase !== "over") {
    // Time up: who was left, and could they reach each other (a JET with nothing on the ground that hits flyers).
    for (const [id, w] of anyRoom.walkers) {
      if (w.master !== null) continue;
      const atk = w.unit.attack;
      console.log(`  left: ${id} ${w.flying ? "flying" : "on foot"}${w.unit.riding ? ` riding ${w.unit.riding.name}` : ""}, weapon ${w.unit.weapon?.name ?? "-"} targets ${atk ? atk.tags("targets").join(",") || "land" : "-"}, hp ${Math.round(w.hp)}, foe ${w.foe ?? "-"}`);
    }
  }
  const report = room.botReport();
  for (const b of report) {
    const m = used.get(b.difficulty) ?? used.set(b.difficulty, new Map()).get(b.difficulty)!;
    for (const [k, n] of Object.entries(b.used)) { m.set(k, (m.get(k) ?? 0) + n); if (n > 0) themedUsers.set(k, (themedUsers.get(k) ?? 0) + 1); }
  }
  const winner = room.state.winner || "(none)";
  const level = report.find((b) => b.id === winner)?.difficulty ?? "-";
  wins.set(level, (wins.get(level) ?? 0) + 1);
  if (room.state.phase === "over") roundBy.set(lastDeathBy || "-", (roundBy.get(lastDeathBy || "-") ?? 0) + 1);
  rounds.push({ minutes: +(seconds / 60).toFixed(1), winner, difficulty: level, firstDeath });
  console.log(`room ${r + 1}: ${winner} (${level}) won after ${(seconds / 60).toFixed(1)} min${room.state.phase === "over" ? "" : " (time up)"}; first death ${firstDeath} s`);
  room.onAward = undefined;
  await room.disconnect().catch(() => {});
}
WorldRoom.testSeed = null;

console.log(`\nRounds: ${rounds.length}; minutes ${rounds.map((r) => r.minutes).join(", ")}; mean ${(rounds.reduce((n, r) => n + r.minutes, 0) / rounds.length).toFixed(1)}`);
const deaths = rounds.map((r) => r.firstDeath).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
console.log(`First death (s): ${deaths.join(", ")}; median ${deaths[Math.floor(deaths.length / 2)] ?? "-"}`);
console.log(`Wins by difficulty: ${[...wins].map(([k, n]) => `${k} ${n}`).join(", ")}`);
const pct = (a: number[], q: number) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))]!.toFixed(1) : "-"; };
for (const [k, a] of Object.entries(ttk)) console.log(`Time to kill (${k}s, ${a.length}): median ${pct(a, 0.5)} s, p25 ${pct(a, 0.25)}, p75 ${pct(a, 0.75)}, under 2 s ${a.filter((t) => t < 2).length}`);
console.log(`First person dead at: ${firstDeaths.map((t) => (t / 60).toFixed(2)).join(", ")} min`);
console.log(`People killed by: ${[...killers].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(", ")}`);
console.log(`Person deaths by: ${[...deathBy].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
console.log(`Rounds decided by (the last death): ${[...roundBy].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
console.log(`Ghost haunts: ${haunts} (${(haunts / Math.max(1, rounds.length)).toFixed(0)} a round)`);
{
  const mean = (a: number[]) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2);
  console.log(`Statuses per living person (every 10 s, ${statusSamples.length}): mean ${mean(statusSamples)}, p90 ${pct(statusSamples, 0.9)}, max ${Math.max(0, ...statusSamples)}; helpless mean ${mean(helplessSamples)}, share of samples helpless ${((helplessSamples.filter((n) => n > 0).length / Math.max(1, helplessSamples.length)) * 100).toFixed(1)}%`);
}
const systems = [...new Set([...used.values()].flatMap((m) => [...m.keys()]))].sort();
const levels = (["easy", "normal", "hard"] as const).filter((d) => used.has(d));
console.log(`\nSystems used (count per difficulty):\n${["system".padEnd(16), ...levels.map((l) => l.padStart(8))].join("")}`);
for (const s of systems) console.log([s.padEnd(16), ...levels.map((l) => String(used.get(l)?.get(s) ?? 0).padStart(8))].join(""));
const themed = [...THEME_SYSTEMS, ...systems.filter((k) => k.startsWith("cure ") && !(THEME_SYSTEMS as readonly string[]).includes(k))];
console.log(`\nThemes' systems (count per difficulty; bots that used each at least once):\n${["system".padEnd(16), ...levels.map((l) => l.padStart(8)), "  bots"].join("")}`);
for (const k of themed) {
  const users = themedUsers.get(k) ?? 0;
  console.log([k.padEnd(16), ...levels.map((l) => String(used.get(l)?.get(k) ?? 0).padStart(8)), String(users).padStart(6)].join(""));
}
const unused = themed.filter((k) => !(themedUsers.get(k) ?? 0));
console.log(`Themes' systems used: ${themed.length - unused.length} of ${themed.length}${unused.length ? `; never: ${unused.join(", ")}` : ""}`);
if (watched.size) {
  const n = [...spelledWatched.values()].reduce((a, b) => a + b, 0);
  const any = [...affordable.values()].length;
  console.log(`\nAll words spelled by bots: ${spelledAll}; racks sampled ${racks}; watched words some rack could spell: ${any} of ${watched.size}; mean share of racks that could spell one: ${racks ? (([...affordable.values()].reduce((a, b) => a + b, 0) / watched.size / racks) * 100).toFixed(1) : "-"}%`);
  console.log(`Most affordable watched words (share of racks): ${[...affordable].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} ${((v / racks) * 100).toFixed(0)}%`).join(", ")}`);
  console.log(`\nWatched words spelled: ${n} times, ${spelledWatched.size} different: ${[...spelledWatched].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${k} ${v}`).join(", ")}`);
}
if (rack.n) {
  const all = [...rack.held.values()].reduce((a, b) => a + b, 0);
  const mean = (a: number[]) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1);
  console.log(`\nRacks (${rack.n} bot samples, every 30 s): mean ${(rack.size / rack.n).toFixed(1)} letters; distinct letters mean ${mean(rack.distinct)}, median ${pct(rack.distinct, 0.5)}; nouns and verbs spellable now mean ${mean(rack.spellable)}, median ${pct(rack.spellable, 0.5)}`);
  console.log(`Opening racks (first 5 min, ${rack.open.distinct.length}): distinct mean ${mean(rack.open.distinct)}, median ${pct(rack.open.distinct, 0.5)}; spellable mean ${mean(rack.open.spellable)}, median ${pct(rack.open.spellable, 0.5)}`);
  const g = [...gathered.values()].reduce((a, b) => a + b, 0);
  console.log(`Gathered letters (${g}): ${[...gathered].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.toUpperCase()} ${((n / g) * 100).toFixed(1)}`).join(" ")}`);
  console.log(`Letters held: ${[...rack.held].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.toUpperCase()} ${((n / all) * 100).toFixed(1)}`).join(" ")}`);
}
const total = [...sources.values()].reduce((n, v) => n + v, 0);
console.log(`\nLetter sources (${total} letters):`);
for (const [k, n] of [...sources].sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(12)}${String(n).padStart(7)}  ${((n / total) * 100).toFixed(1)}%`);
await server.shutdown();
process.exit(0);
