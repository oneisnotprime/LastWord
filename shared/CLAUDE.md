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
- `letters.ts` where letters come from (PLAN.md "Letter economy"): `ACTION_SOURCES` (the eleven
  action letters), `Deposits` (gathering: E anywhere, O by water, G in hills, U by mountains, per
  8-tile patch, running out and growing back slowly; sites: caches give X, the temple Q),
  `placeSources` (markets, temple, caches, ruins, wild animals on the `mainland`), `spawnPoint`
  (people far apart), `regionOf` (exploring gives J), `MARKET` and `readTrade` ("trade eee for o"),
  `killLetters` (K, V, H) and `destroyLetters` (D, V, F, X); `production` reads `produce_*`.
- `economy.ts` `starterHand` (eight letters around a word that produces something, `starterWords`)
  and `reachability`/`reachTable`: the shortest chain from the action letters to every letter;
  its test prints the table.
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
- `upkeep.ts` food, fuel and power: `needs`, `outputs`, `draw`, `supply`, `groundFood`;
  `startingSupply`: a newly made machine brings `STARTING_SUPPLY_MINUTES` (30) of what it draws.
- `inspect.ts` cards telling what something is (spell preview, right-click inspect): `inspectText`,
  `cardOf`, `keyStats`, `behaviours`; `becomes` (creature, worn, terrain or ground: the rule the
  server's `make` uses) and `aimOf` (whether a spelling is clicked onto someone, anywhere, or neither).
- `sense.ts` `senseOf`: a noun that only shows things (`map_reveal`, `detect_letters`,
  `detect_life`, nothing else but make-up) is part of its owner's screen, a minimap, not an object;
  `claimOf`: a `claim_radius` claims ground (`CLAIM_REACH` times it) where the owner's things take
  `shelter` less damage and are harder to steal. `ride.ts` `cannotRide`: no speed on land or in the air.
- `describe.ts` adjectives spelled alone: `readDescription` reads them, `applyAdjectives` puts
  them on something already made (same as spelling it with them; refuses past `adjective_slots`),
  `changes` says what changed in plain words ("integrity ×0.2", "accuracy −0.4").
- `unit.ts` also carries light things: anything with no `equip_slot` and no damage of its own is
  held as an improvised weapon (`improvised`: blunt damage 2 × hardness × √mass, one hand, two
  over half the limit) if it weighs at most `carryLimit` (strength × 4 kg); `cannotCarry` says why not.
