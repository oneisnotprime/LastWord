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
- Starting kits: `onJoin` deals kits (`kits` message; the client sends `ready` once listening and
  gets them again); `kit` picks, else the best (`bestKit`) after KIT_SECONDS; bots pick at once.
  `chooseKit` sets `Walker.kit`: the job's effect in `rebuild`, its stats in `helpOf`, hunting
  tools and `sources`, its rules in `rulesAt`; the hand; the building through `make`. Legendary
  progress is counted in `beat` (`legendProgress`, `deeds`), unsealed with a `legend` call to
  everyone, `unseal` pays the "letters" condition, and `spellWord` waives its letters once.
  Room tests run with kits off (`WorldRoom.kits`, off under Vitest) unless they turn them on.
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
- Letter sources (`placeSources`): a `market` Thing in every city, one `temple`, `chest` caches and
  broken `ruin`s, all ownerless with `Gear.fixture` set (markets, temple and caches are also
  `terrain`, so they cannot be taken or attacked), and wild animals (`master` "-"). Gathering goes
  through `deposits` (shared `Deposits`); a dug-out cache is removed. `trade eee for o` typed as a
  spelling is a market trade (`trade`). Kills and destroyed things pay through `payee` (a creature's
  master). `WorldRoom.testBare` gives tests of other systems a map without any of this.
- People start far apart (`spawnSpot`). Bots keep the peace for 60 to 90 s (`peaceUntil`), spell
  at most once every 5 to 10 s (`nextSpell`), build producers first, hunt, break ruins, dig caches,
  trade at markets, explore, and only go for people within twice their sight.
- Bots play every system through the same code as people, choosing by word data only (`bots.ts`
  `wordBook` sorts words by use from shared rules: `buff`/`debuff` adjectives, `aimed` fields,
  area words by their place rules: `boon`, `levy`, `hinder`, `refuge`, `war`; `route`, `city`,
  `tiller`, `cook`). `thinkBot` calls one part per system: `botFlee` (hurt: run, refuge, cure),
  `botPickUp` (`takeNear`, the same as E), `botCounter`, `botSpell` (`phraseFor`: adjective
  phrases and plurals), `botSystems` (adjectives on foes and own gear, area words, roads, cities,
  crop land, cooking, `botOffer`), `botTrade` (market, hiring), `botAnswer`. `SKILL` scales each
  by difficulty. Kits: `botKit` picks one by difficulty, `botQuest` steers normal and hard bots toward
  their legendary's unlock (producers, land, hunts, trades, regions, a city, a boss, kills, letters),
  `botLegend` spells it once unsealed, and `botCounter` aims counter-words at enemies' legendaries. `mind.used` counts what each used; `botReport` and `onAward` feed
  `loadtest/tournament.ts` (`npx tsx loadtest/tournament.ts 4 8 mixed 60`: rounds of bots, the
  systems they used, letter sources by `sourceOf`, round lengths).
- Objects are made by `make`: up to `SEPARATE_UP_TO` (12) creatures or things each, more as one
  with `count` (`Player.count`, `Thing.count`, `Spelled.count`; stats via shared `massed`).
- `cast` applies a verb with its adverbs (shared `castVerb`); touched verbs with event properties
  go through `happen` on the picked target. A verb that would do nothing is refused.
- `use` (U) applies an object to its user through `affect`, the same code as `cast`.
- `take` (E) picks up wearables, and anything light enough (shared `cannotCarry`) into a hand, or
  gets back on a mount of yours walking with you. `dismount` (R) gets off: a machine stays on the
  ground as yours, a living mount walks with you as a creature. A vehicle that cannot move on land
  is never ridden (shared `cannotRide`); a ridden machine out of fuel or power has speed 0.
- `make` puts a sense (shared `senseOf`: MAP, COMPASS) in `Walker.senses`, not the world;
  `sendSensed` sends `sensed` (living things, letter makers in range) once a second for the minimap.
- Claims (shared `claimOf`) are `Area`s with `claim` set, radiated like fields: `res_*` up by
  `shelter` for the owner's side, `claimAt` scales blows on their things and adds theft security.
  Zones carry `owner` and `shelter` (0 unless a claim).
- The knocked out keep their client: `watchers` says whom they watch (their killer, or its
  master; then that one's killer) and `refreshViews` sends them what that one sees (`watching`).
- A client-steered person's route searches skip the per-tick budget (`steered`).
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
- Places: every letter a person gets from the world goes through `earn` (the rules of the areas
  and weather at that spot, shared `place.ts`; then `tax_rate` areas take their share).
  `rulesAt` lists them, `lawAgainst` checks a `law` (attack, gather, spell, trade, theft). An area
  `begin`s once: `deposit_factor`, `summons`, an event's `tile_type`, and a notice to those inside.
  Events carry the word's ops as an `effect` and honour `field_targets`. Sky words with a length
  give the old daylight back (`daylightEnds`); weather rules are `weatherRules`; a sky word with a
  `field_radius` that sets no weather (DROUGHT, ECLIPSE) also lays its field. Zones carry `until`
  (round clock) and `by`; the state carries `weatherWord/By/Until` and `daylightWord/By/Until`.
- Production (`produce`, once a second; shared `produce.ts`): every thing on the ground and every
  creature that makes letters is a `Producer`; its owner is read afresh (thing owner, creature
  master). Conditions are measured where it stands (tilled `Tile.Field`, moisture with
  `waterers`, `soil`, workers' `labor` of the owner's side, `state.wind`, water beside it, the
  owner's claim, hunger, `stalled`, `fights` within PEACE_RADIUS). Flora pays once a
  CYCLE_SECONDS to its owner's side close by; machines take the letters they convert from their
  owner. The rule: whatever belongs to you produces, on the ground, as a creature, or carried,
  worn and ridden (`carried`, at its owner's spot); ageing (Y) counts from `Gear.born` wherever it
  is kept. The loadout's `producing` lines say what each makes or why not, and `income` (letters a
  minute by letter, with their producers) feeds the top-left HUD; told when it changes. Bots go `home` to their
  first producer half the time they move on.
- Territory (`territory`, every TERRITORY_EVERY seconds; shared `territory.ts`): claims' land
  pays L, `roads` (tiles a route word laid, by owner) pay R, cities pay their `rulers` S per
  citizen (citizens are walkers with `citizenOf`, kept in their city by `roam`). `rule` makes a
  ruler and tells everyone; `takes_city` words take the city they are spelled in. `hire`,
  `transmute`, `offer`/`answer` (messages `market`, `hire`, `transmute`, `offer`, `answer`; typed
  "offer name abc for de", "transmute ...", "hire"); `offers` lists a person's offers. Workers
  find a job (`jobFor`). Bosses rise at BOSS_TIMES (`riseBoss`; `Player.boss`) and drop Z.
  `state.cities` carries each city's ruler and citizens. For local testing only: `BOSS_AT=20`.
- Letters gained go through `award`, which sends `got` { letters, why, x, y } for the client's
  letter popup ("E · forage", "H · hunted COW (+12 food)", "D · broke RUIN", "A · FARM").
  `gathered` is still sent for a gathered letter. `gather` refuses at once where nothing is left
  (shared `Deposits.problem`) and sends `gathering` (seconds) when it starts.
- Blows are noted by `blow` and sent once a tick by `flushHits` as `hits`: [{ by, on, amount,
  layer, kind, ranged, x?, y? }], merged per attacker and target, only to clients that see either.
- Hunting: a killed living, non-sentient body adds shared `carcassFood` to the killer's food;
  a wild kill pays shared `huntYield` (H, its first letter, bonuses) with the reasons as `detail`.
- Gathering rolls (shared `biome.ts`): a miss sends `missed` { x, y, text } ("nothing · DESERT
  12%"); a find's `got` carries `detail` (the odds and the tools that helped, `helpOf`).
- J: the first person into each 64-tile region (`discovered`), once a map. Ruins have their X one
  time in four. Wild animals are drawn from the biome they stand in (`wild`, shared `wildlife`).
- Nobody strikes past their sight: reach is the weapon's `attack_range` up to the striker's sight.
- `sendThreats` (twice a second): `threats` [{ id, x, y, name, air, targeting, reach }] to each
  person, what is coming for them, seen or not, sent only on change.
- `take` { id } claims or picks up that thing if in reach (a click on a RUIN walks there, then sends it).
- `CHEAT` ("xxx") fills every letter on any server, for playtesting (TODO: a real debug server).
  A wandering wild creature ambles at `AMBLE_PACE`; it runs only to chase or flee.
- `take` (E) by a thing nobody owns that cannot be carried (a RUIN) `claim`s it: it becomes yours
  where it stands, radiates for you and makes its letters for you.
- `exterminate`: a word kills the creatures its `counters` names (by noun or archetype) near the
  speller; DEBUG counters insects. With `DEBUG=1` (the `dev` script; never the live server)
  spelling DEBUG fills every letter instead.
- Ticks run through `safeUpdate`: a throw is logged and the room goes on; a tick over
  `SLOW_TICK_MS` is logged with what the room held. A dropped connection keeps its place for
  `RECONNECT_SECONDS` (`onDrop`/`onReconnect`); the client reconnects on its own.
- Dictionary themes: `kitchen` (once a second) cooks raw things by heat and rots old ones (shared
  food.ts), rewriting `Gear.spelled` and the thing's phrase; `use` poisons with `toxin`. Pacts
  (`makePact`, `breach`, `keepPacts`; `side` returns a pact's id, so allies share a side) come from
  `binds` words through `happen`. `lawAgainst` charges a law's `fine` (FINE_SECONDS apart) instead
  of refusing; `hunt` laws stop attacks on wild animals. Events passed on a person (`onPerson`:
  ARREST, SENTENCE, PARDON, VERDICT) give or end statuses and take letters with no blow. Scouts
  (`scout`) range toward undiscovered regions and pay their master J; `priceFor` haggles with a
  trader near you; builders near a new structure set `Gear.built` (integrity multiplier). Planted
  producers keep `Producer.grown`. `alchemy` picks the transmuting ratio, a carried precious
  material (shared `alchemyRatio`) included, which `transmute` uses up. An event reads `field_radius`/`field_duration` if it has no
  `event_radius`/`event_duration`.
- Themes batch 2: `home` (once a second per person) sums comfort inside their claims into
  `Walker.home` (an effect `applyFields` adds), counts `Walker.stored` (fines, breaches and
  pickpocketing take only the rest) and `Walker.eyes` (things that watch, sent in `sensed` and the
  loadout for the minimap). `kill` leaves the stored letters as `Gear.hoard` in the dead's stores,
  now nobody's; `payHoard` pays them to whoever claims or breaks one. `heldAt` slows root and
  silence in an enemy lockup's claim. `make` crafts through `craftAt` (stations within CRAFT_RANGE,
  a material carried or lying by, used up). `produce` counts machines' `labor` as workers. `breed`
  adds young to fed herds within command.
- Themes batch 3: `make` grafts a bodypart onto `graftHost` (the picked walker in sight, else the
  speller); `sever` cuts grafts off (to the ground, nobody's) for `touch` (touched verbs that
  inflict or sever land on the picked walker in sight; `happen` sends severing events there) and
  for blows whose attack `severs`. `hurtWith` takes a `contagion` (sickness keeps it; the
  vaccinated and the lately `recovered` do not catch it) and calls `winOver` (charm wins a
  creature over, `setMaster`). In `beat`: `temper` (creatures with their temper up go for
  enemies; `think` keeps that foe), `air` (cold and heat damage, `Walker.exposed`, told on
  change), `contagion` (the sick pass it on through `nearGrid`, not inside a `contact` law).
  `fooled` (a disguise: `Walker.unmasked` after a strike) keeps wild animals, angry creatures and
  bots off a disguised walker. `compel` sends the enraged (`hampered.berserk`) at the nearest
  walker; deaf creatures take no orders. `sendThreats` adds walkers heard (`earshot`, `heard`).
- Themes batch 4: `spellWord` refuses a miracle without its faith (`spendFaith`) and a payer
  without the letters; what a spelling `pays` is noted on `Walker.paying` and paid by
  `settlePay` once its letters are spent. `informAndPay` (events on a person and touched verbs:
  `read_inventory`, `pays`). `sufferStatuses` pays debts (`payDebt`); `steal`/`stealCreature` give
  a debtor no security against their creditor and count a word's own contest value (BRIBE).
  `home` pays bank interest (`payInterest`, `Walker.interest`). `earn` multiplies by the earner's
  `earnFactor` (bless, curse). `pulse` gives boons to the area's own side. Altars (`altars`) make
  deaths and ruins near them offerings (`sacrificed`, in `kill` and `strikeThing`). Traps
  (`traps`, `springTraps` five times a second; `trapHidden` keeps them out of enemies' views;
  `exterminate` breaks traps a word counters). Areas carry `decoys` (`decoysFor`: fake threats and
  minimap dots), `jams` (`jammed`: `sensed` is blacked out) and `weather` (a sky field's tile);
  `sendThreats` shows the exposed to every enemy within EXPOSED_TILES; `weatherPatches` (in
  `beat`) lays weather tiles near people through `reshapeOnly` (`Edit.only`).
- Themes batch 5: `rebuild` reads time and gravity (`Walker.time`, `gravity`, `range`), sailing
  (`Walker.sailing`: `walk` routes with SAIL_COST) and the void (`hampered.nulled`: no gear, mount
  or fields). `make` launches vessels (`launchSpot`: by the owner's port, else the nearest water);
  `takeNear` boards one from the shore; `dismount` leaves it moored. Areas carry `pull`, `waves`
  and `meteors` (`motionOf`; `move` once a second, `impact` strikes and marks a zone). `beat` keeps
  `Walker.past` (health a second, for `rewind`) and runs `refereeChallenges`. Challenges
  (`challenge`, `settleChallenge`, `forfeit`, `challengeOf`; keyed by the ring or flag area: a word
  that counters it voids it) stake letters; `kill` spares a duellist (RING_FLOOR) and settles it.
  `keepPeace` (in `equip`, and `make` for creatures) gives `peace` holders a truce once
  (`Gear.peaceUsed`). `meta` handles `swaps_owners` (`dearest`, `giveThing`), `misspells` and `ages`
  (`age`). `hurtWith` draws chaos ops; `sufferStatuses` ticks at the walker's time, skips damage on
  the untouchable and lands doom. `harms`, `lawful`, `touch`, traps and combat skip the untouchable.
  Combat: tempo times time, ranged reach times `range`, `knockbackOf` after a landed blow. A thing
  that `docks` joins `markets` (its owner takes PORT_TOLL T); `helpOf` adds luck to gathering; a
  fishing find with gear lands a catch (`fishes`).
- Polish batch 1: bots use the themes (`botThemes`: tries in random order, by `SKILL.themes`;
  `botCure` first when ailing or cold, by `SKILL.cures`; `botBoat` takes a launched vessel out and
  back; `botCast` aims a word at a walker, a spot or itself; bots.ts `themeUses` sorts words into
  `ThemeUse`s and `THEME_SYSTEMS` lists what the tournament reports). Summoned vessels go on the
  nearest water (`launchSpot` with PORT_TILES) or not at all. `home` blinds eyes inside an enemy
  jam (`jammedAt`). `sell` (message `sell` { index, get }; `marketInfo.sells`) sells carried things
  by shared `salePrice`. `spellWord` reads stand-ins (shared `standIn`: WORD WOLF pays W O R D);
  `meta` skips a typo where the owner's side has something that `spellchecks` (`spellchecker`).
  `dismountWalker` is the R key for people and bots.
- Polish batch 2: `counter` also ends the weather a word counters. `botBoat` gets a riding bot
  off first and walks it to the shore by its boat; `takeNear` boards a vessel in reach rather than
  remounting a mount beside you. `fixtures` indexes the map's fixtures for `nearFixture`;
  `claimGround` remembers a claim's road tiles; `within` is the cheap distance test. Every room
  test file sets `testSeed`: no test depends on a random map or random rolls.
