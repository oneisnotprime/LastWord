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
- `world.ts` map generation from a seed, tile costs, `stepToward` movement. 1 tile = 4 m.
- `phrase.ts` `parsePhrase` reads what a player typed; `missing` and `spend` handle letters.
- `letters.ts` what gathering yields on each ground, and what an object produces a minute.
- `unit.ts` a character with its gear: damage layers, held weapon scaled by strength and
  training, riding. `strikeUnit` hits the outermost layer.
- `rng.ts` seeded generator. Pass an `Rng` in; never call `Math.random`.
- `testdata.ts` loads the demo dictionary from disk, for tests only.
