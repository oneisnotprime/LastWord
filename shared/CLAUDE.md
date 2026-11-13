# shared: rules engine

Pure TypeScript. No I/O, no timers, no randomness except through a seed passed in. Both the
server and the client import this, so anything here must give the same answer on both.

- Test: `npm test -w shared` (Vitest). Typecheck: `npm run typecheck -w shared`.
- Data comes in as plain objects. Tests may read `../data` from disk; source files may not.
- Every rule gets a unit test. A word must act only through shared properties, never by name.

## Map

- `dictionary.ts` word and property lookup, including inflected forms (BIGGER -> big).
- `stats.ts` `resolve(dict, noun, adjectives)` builds an object's properties; tracks absolutes.
- `combat.ts` `strike`, `tick`, `duel`. The absolute rules are documented on `strike`.
- `world.ts` map generation from a seed, tile costs, `stepToward` movement, `stampTerrain` for
  words that reshape the land. 1 tile = 4 m.
- `phrase.ts` `parsePhrase` reads what a player typed (adjectives + noun, or adverb + verb);
  `readNoun` reads plurals; `count` is plural_count, or one for a singular (pack_size only for collectives and number words); `missing` and `spend` handle letters.
- `plural.ts` `pluralize` and `singulars`: English plurals with a short irregular list.
- `verb.ts` `castVerb`: the adverb rule (effect properties change the verb, the rest add to it);
  `useObject`: what using an object (eating, drinking) does, as a verb cast on yourself.
- `aura.ts` `auras`: light, fear and healing an object or creature gives off around itself.
- `stats.ts` also has `massed`: many of one thing as one body, integrity, mass and damage scaled.
- `letters.ts` what gathering yields on each ground, and what an object produces a minute.
- `unit.ts` a character with its gear: damage layers, held weapon scaled by strength and
  training, riding. `strikeUnit` hits the outermost layer.
- `status.ts` `STATUS_RULES`: the one table of what each status (stun, fear, poison...) does;
  `afflict` gives a struck body its attacker's `inflict_*` unless `immune_*`, `hampered` says
  what it may still do, `statusDamage` is a second of burn, poison or bleed.
- `path.ts` `findPath`: A* over tiles around anything that cannot be walked, preferring roads;
  search buffers are shared, so it is not safe to call from two threads.
- `rng.ts` seeded generator. Pass an `Rng` in; never call `Math.random`.
- `testdata.ts` loads the demo dictionary from disk, for tests only.
- `mind.ts` morale (`moraleGoal`, `nextMorale`, `routed`, `moraleAim`), how creatures choose
  (`chooseTarget`, `retreats`, `ignoresOrder`) and command (`commandLimit`, `recruitRate`).
- `upkeep.ts` food, fuel and power: `needs`, `outputs`, `draw`, `supply`, `groundFood`.
