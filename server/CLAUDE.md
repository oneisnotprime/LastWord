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
- Events use `Walker.picked` (right-click) before `Walker.foe`; area events use `Walker.aim`.
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
- Ignore options a client sends when joining. A message with no handler disconnects the sender.
