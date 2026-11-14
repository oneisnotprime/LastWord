# server

Node process that owns the game state. One room per map instance (from milestone M2).

- Test: `npm test -w server`. Typecheck: `npm run typecheck -w server`. Run: `npm run dev:server`.
- Game rules live in `shared/`; this package does I/O, networking, map generation, persistence.
- The server is the only authority. Never trust a value a client sends beyond its intent.

## Map

- `src/app.config.ts` server definition; `src/main.ts` starts it (`PORT`, `METRICS=1`).
- `src/WorldRoom.ts` the room: joins, movement intents, 10 Hz tick, sight-based views.
- `src/state.ts` what is sent to clients. Fields tagged `.view()` go only to clients whose
  view holds that instance. Keep it small: every field costs bandwidth for every viewer.
- `loadtest/bots.ts` bot load test: `npx tsx loadtest/bots.ts 100 600` (add `crowd` after the
  endpoint, and start the server with `CROWD=1`, for the worst case where everyone sees
  everyone). Run the server with `METRICS=1` to see CPU and tick time.
- Colyseus 0.18: `defineServer`/`defineRoom`, `messages = {}`, `setTimestep`, `@colyseus/sdk`
  on the client. Older tutorials use a different API; check docs.colyseus.io.
- Gear a player carries lives in the room (`Walker.gear`) and is shown to others only as the
  text in `Player.gear`; things on the ground are `Thing`s in the state.
- Field words (`field`) are `Area`s with an `effect` applied to whoever they `reach`;
  `applyFields` runs once a second and on every cast. A word ends areas it `counters` whatever
  its kind.
- Room test files share one port, so `vitest.config.ts` runs them one at a time.
- Events use `Walker.picked` before `Walker.foe`; area events use `Walker.aim`. The client sets them
  with `pick` just before spelling an aimed event and clears them just after (spell, then click).
- `move` replaces the route at once (no walking on to an old aim); `stop` halts where the server
  has you. Released arrow keys send `stop`, not a position, which would be stale.
- Events (`happen`) pick what to do from the word's properties, not its name; areas they
  leave behind are `Area`s ticked by `burn` and sent to clients as `Zone`s.
- A creature is a `Walker` with no client: `master` is its owner's id, `think()` gives it a
  foe or a place to go each tick, and it shows in `state.players` with `owner` set.
- A spelling is one of four kinds (`parsePhrase().kind`): object, verb (`cast`), event
  (`happen`), sky (`sky`). Each of the last three throws before any letters are spent.
- A round ends when one person is left (`endRound`): the room locks, sends `roundover`, and
  closes after `ROUND_END_SECONDS` (15; tests use 1). Clients reload into a new room.
- For local testing only: `LETTERS=9` gives every player nine of each letter, `CROWD=1` spawns
  everyone in one city, `SEED_THINGS=5000` scatters that many objects at start.
- `loadtest/bots.ts` modes: `wander`, `crowd`, `play` (gathers, spells and fights).
- Only the room's first client's options are read (`onCreate`: `bots`, `difficulty`, `mode`);
  later joiners' are ignored. A message with no handler disconnects the sender.
- Bots (`bots.ts` chooses, `thinkBot` acts): people whose id and name are `botN`, with no client.
  They think twice a second (easy once), spread by `phase`; spelling goes through `spellWord`,
  the same code as the `spell` message. Rooms filter by `mode` so friends never join a bot room.
- Statuses: `Walker.statuses` (rules in shared `status.ts`). `hurtWith` gives them on a landed
  blow or an area pulse, `statusChanged` rebuilds and sets `Player.status`, `sufferStatuses`
  deals damage over time and counts down, `compel` makes the frightened flee, the confused
  wander and creatures in `sets_hostile` areas attack. Areas `pulse` once a second (statuses
  from harmless areas, cures, `contagion`).
- `make` sorts a spelling with shared `becomes`, and adds shared `startingSupply` to the owner's stores.
- Objects are made by `make`: up to `SEPARATE_UP_TO` (12) creatures or things each, more as one
  with `count` (`Player.count`, `Thing.count`, `Spelled.count`; stats via shared `massed`).
- `cast` applies a verb with its adverbs (shared `castVerb`); touched verbs with event properties
  go through `happen` on the picked target. A verb that would do nothing is refused.
- `use` (U) applies an object to its user through `affect`, the same code as `cast`.
- `take` (E) picks up wearables, and anything light enough (shared `cannotCarry`) into a hand.
- `describe` { text, target, gear? }: adjectives spelled alone put on a thing, creature, person
  (`Player.traits`) or your own gear, within your sight (`describeWord`); everyone in sight of the
  target gets `described` with what changed. `state.alive` and `state.clock` feed the HUD.
- Objects radiate (`radiate`, `syncRadiation`): a `field_radius` gives the same `Area` a field
  word makes (`fieldArea`), and shared `auras` adds light, fear and healing. Carried things and
  bodies radiate around their walker (synced in `rebuild`), things on the ground around
  themselves (`addThing`/`removeThing`).
- Minds and upkeep run once a second in `beat`: morale climbs back and the broken flee
  (`nerve`), each person's `command` limit (extras run wild), `upkeep` (stores in
  `Walker.stores`; hungry creatures turn wild, machines stall), `recruit`, and wild creatures
  `roam`. Loadouts a `rebuild` changes are sent once at the end of the tick (`toTell`).
