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
- Starting kits: `onJoin` deals kits; a person picks in three steps (shared KIT_STEPS: job, building,
  letters; `kits` { step, options, seconds, chosen } per step, `kit` { step, index },
  `pickStep`; the client sends `ready` once listening and gets the step again), the best
  (`bestStep`, shared `bestOption`) after KIT_SECONDS a step, untouchable meanwhile
  (`hamper.untouchable` while `picking`); hands are dealt for the job picked (shared `kitHands`).
  Bots take a whole kit at once (`botKit`).
  `chooseKit` sets `Walker.kit`: the job's effect in `rebuild`, its stats in `helpOf`, hunting
  tools and `sources`, its rules in `rulesAt`; the hand; the building through `make`; `sendKit` tells
  them `kit` { job, building, card }. No legendary comes with a kit (batch C1).
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
- Letter sources (`placeSources`): a `market` Thing in every city, one `temple`, `chest`s and
  broken `ruin`s, all ownerless with `Gear.fixture` set (markets, temple and chests are also
  `terrain`, so they cannot be taken or attacked), and wild animals (`master` "-"). Gathering goes
  through `deposits` (shared `Deposits`); a dug-out chest is removed, and its X and prize come in
  one `got` ("chest"). `trade eeee for o` typed as a spelling is a market trade (`trade`): any
  letters, `marketPrice` of them (place rules and haggling, whole letters) for each one asked.
  `swap` (message or typed) is `swapRack`: the whole rack for as many random letters, once per
  market per person (`markets` remembers `swapped`). Kills and destroyed things pay through `payee` (a creature's
  master). `WorldRoom.testBare` gives tests of other systems a map without any of this.
- People start far apart (`spawnSpot`). Bots keep the peace for 60 to 90 s (`peaceUntil`), spell
  at most once every 5 to 10 s (`nextSpell`; the first no sooner than 5 s in, so hands start whole), build producers first, hunt, break ruins, dig caches,
  trade at markets, explore, and only go for people within twice their sight.
- Bots play every system through the same code as people, choosing by word data only (`bots.ts`
  `wordBook` sorts words by use from shared rules: `buff`/`debuff` adjectives, `aimed` fields,
  area words by their place rules: `boon`, `levy`, `hinder`, `refuge`, `war`; `route`, `city`,
  `tiller`, `cook`). `thinkBot` calls one part per system: `botFlee` (hurt: run, refuge, cure),
  `botPickUp` (`takeNear`, the same as E), `botCounter`, `botSpell` (`phraseFor`: adjective
  phrases and plurals), `botSystems` (adjectives on foes and own gear, area words, roads, cities,
  crop land, cooking, `botOffer`), `botTrade` (market, hiring, selling,
  a rack swap when it wants nothing and half its rack is one letter), `botAnswer`. `SKILL` scales each
  by difficulty. Kits: `botKit` picks one by difficulty. `mind.used` counts what each used; `botReport` and `onAward` feed
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
  `transmute`, `offer`/`answer` (messages `market`, `swap`, `hire`, `transmute`, `offer`, `answer`;
  typed "offer name abc for de", "transmute ...", "swap", "hire"); transmuting needs alchemy
  (`alchemy`: a `transmute_in` on the person, their gear, things or creatures, or a precious
  material carried), else it is refused; `offers` lists a person's offers. Workers
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
- Gathering rolls (shared `biome.ts`): a forage find is drawn from the biome's pool (E about a
  third, the rest letters fitting the ground, rare J K V X on hostile ground; inside a room,
  `w.inside`, the shared INTERIOR pool and nothing else); a miss sends `missed` { x, y, text } ("nothing · DESERT
  12%"); a find's `got` carries `detail` (the odds and the tools that helped, `helpOf`).
- J: the first person into each 64-tile region (`discovered`), once a map. Every region a person
  enters (`explore`, their own `explored`, scouts' included) widens their sight in `rebuild`
  (shared `exploredSight`); the J popup's detail says "+sight", else a `sight` message does. Ruins have their X one
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
- Expansion batch 1: `kitchen` weighs each heat source's temperature against a raw thing's
  shared `heatNeeded` (ore smelts by a FORGE, not a CAMPFIRE); `bugs` (once a second) grows a creature
  into its `matures_into` once `Walker.born` is old enough (`age` moves `born`), and lets borers strike
  things of their `bores` materials near them (`strikeThing`, through armour). Bots: `borer` use
  (bots.ts), spelled beside an enemy's thing they eat. `loadtest/tournament.ts` takes WATCH=words.txt.
- Expansion batch 2: `hangGuard` (in `placeInRoom`) hangs a door guard put down in or beside its
  side's room on the door (`Indoors.guards`, `max` and `door` raised; `leaveRoom` takes it off;
  `breakDoor` breaks the guards too); `doorBreaker` checks shared `opensPast` against the guards;
  `breachDoors` (in `happen`) breaks enemy doors in an event's reach when it `counters` doors; `bugs`
  hatches things that `matures_into` (ground and carried) and lets borers reach from a building's
  wall. Bots: `siege` (bots.ts: door counters, `siege` weapons and engines, breaching events) on an
  enemy's walk-in building in sight when not fighting a person, `guard` (a PORTCULLIS at home),
  borers on enemy things in sight (then it goes for the thing), young beasts scored by what they grow
  into (`grownWorth`), `raidHeadway` (gives up a door it cannot dent after RAID_PATIENCE s),
  `BotMind.wants` (a borer or siege word it has a target for: `botWant` trades toward it first).
  `loadtest/tournament.ts` with WATCH also prints how many racks could spell each watched word.
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
- Fun batch C2: people and their creatures walk at FOOT_PACE (1.6) times `speed_land` when not
  riding or flying (`rebuild`); a wild creature running (chasing or fleeing) tires past
  WIND_SECONDS to TIRED_PACE (`Walker.winded`, in `walk`; rest in `roam`). `take` (E) with nothing
  to pick up at a chest or the temple starts gathering (`startGather`, the G handler). A
  `single_use` thing with damage set on the ground (a BOMB) is a fuse (`fuses`, `blowFuses`): after
  its `attack_windup` (FUSE_SECONDS) it hits every walker and thing within `attack_area`, the
  maker's side too with `friendly_fire`. A grand spelling (shared `grand`) sends `entrance`
  { name, word, kind, x, y, grandeur } to everyone (`entrance`). `loadtest/tournament.ts` prints
  first deaths; `PORT=` runs it beside another.
- Playtest batch C1 (PLAN.md "Fights you can see"): combat goes through shared `strike`, felt and
  paced (`landed`). `Walker.windup`: a heavy blow (shared `windupOf`) holds still, is sent as
  `windups` [{ by, on, x, y, seconds }] with the hits (`flushHits`), and misses (`Hit.kind`
  "dodged") whoever moved DODGE_TILES; `botDodge` steps bots out of rings and marked areas by
  `SKILL.dodges`. Areas: `addArea` arms a striking area after AREA_WARNING (`Area.armed`, `Zone.warn`
  seconds); `burn` strikes nothing before; one wider than CELL_FROM strikes through `dropCells`
  (per person, `cellGap`) and `cellAt` (an `Area` with `cell`, striking once when armed; meteors
  use it too); `shelterOf` (roof: an `enterable` thing within ROOF_TILES; else the side's claim
  shelter) scales area blows. Aimed areas (`placement` target) never have `friendlyFire`.
  Deaths: `blow` notes `Walker.harm` (`harmed`, `culprit`: "BOT1", "COLOSSUS"; damage over time
  too) and `kill` sends `dead` with `recap` { killer, what, top, seconds, alive } and the kill feed
  (`feed`: `killed` { killer, what, victim } to whoever was in it, saw either, or was within
  FEED_TILES). `roundover` adds { clock, kills (`tally`), people }. `atPeace`: a bot in its opening
  peace and its creatures only defend (`think`, `temper`). `recruit` never draws in a wild animal
  its recruiter's side is fighting. `rebuild` drops gear that no longer fits (`shedGear`) instead of
  throwing; `rebuild(w, true)` throws (equipping, describing). Bots skip crude words (`wordBook`).
  `loadtest/tournament.ts` also prints time to kill (first blow of a fight to the death), the first
  death of each round and what killed people (the recap).
- Walk-in buildings (shared interior.ts): `placeInRoom` (in `addThing`) makes a walk-in building a
  room (`rooms`, `Thing.room` radius, `Thing.door` percent, 0 broken) and notes things lying inside
  (`roomOfThing`); `leaveRoom` (in `removeThing`). `Walker.inside` is kept by `walk` (`stride`
  moves, then `bar`: an enemy is slid round the wall, told "door shut"; a door counter carried
  breaks it, `breakDoor`). `mayEnter`: the owner's side, nobody's, or a broken door (open until
  mended all the way, `mendDoors` in `beat`). `walkerHidden`/`thingHidden` keep the inside out of
  `refreshViews`, `pick`, bots' people; `walled`: no blows across a wall (combat loop, fuses);
  `strikeThing` from outside lands on the door (`strikeDoor`); `shelterOf` is 1 indoors; area
  blows skip things indoors; `steal` and `takeNear` reach inside only from inside. Bots: a quarry
  gone indoors turns into a raid on the door (`raid`, `break in`, then in after them), `botFlee`
  hides in its own building (`hide`), `botShelter` goes in from striking areas (`shelter`),
  `botStore` puts carried valuables down inside (`store`), and home is sometimes indoors.
- Expansion batch 3: traps that re-arm (`sprung`: shown to all until set again) and capture
  (`capture`: into the captor's side's nearest lockup, `heldIn`; `bar` holds an enemy inside a lockup,
  its blows from inside land on the door in `strikeThing`); events on a person with `captures` do the
  same. Pacts carry `liege` and `tribute` (`earn` pays the liege its share; `freePact` in
  `withCounters` and the object path ends a pact a word counters). Bots: `held` (a breakout word, else
  it batters the door), `fealty` and `rebel` tries in `botThemes`, `antiair` (bots.ts: weapons and
  creatures that target the air, flying armed mounts; `reachesAir`, `needsAir`, `BotMind.air`: a flyer
  it cannot strike sends it after one first, and a rider whose mount cannot reach a flyer gets off to
  use what it carries), `BotMind.target` (`botTarget`: a word a few letters short, TARGET_SHORT, kept
  TARGET_SECONDS; `botWant` trades and offers toward it and `botTrade` keeps its letters; spelled
  first once affordable), and the endgame (`endgame`: with two left or after 25 min every bot fights
  whoever it finds and goes after the nearest). `loadtest/tournament.ts` prints who was left at time-up.
- Frequency batch 2: late in a round (after BOT_HUNT_AFTER, or the endgame) a riding bot whose ride
  has stopped dead (out of fuel or power) or made no headway for 30 s toward where it is going gets off
  and goes on foot (`BotMind.ride`, used "dismount"): two bots sat in dead machines far apart were the
  rounds that ran to the time cap.
- Concept batch (the round's systems; `concept3.test.ts`): spelling rules (`speechFor`: owned
  things, `Walker.speech` put on them by acts on a person, touched verbs and self verbs, areas'
  `PlaceRules.speech` with the maker's side spared what hinders; `bindSpeech` fixes "top" to the
  letter held most when it lands; `spellWord` and `describeWord` pay shared `priceOf`, read typos
  with `readMisspelt`; the loadout carries `spelling`). Command: `mutiny` (any word with one, at
  spell time), fear wears loyalty in `deathBeat` (FEAR_LOYALTY), loadout `command.loyalty`
  (`loyaltyOf`). Death: `kill` first tries `cheatDeath` (`useLife`: granted `Walker.lives`, then
  gear, things, the spelled body `ownBody`; then a last stand, `Walker.standing`), honours
  `denies_revival` (`kill(id, killer, final)`), `bury` (a GRAVE with the rarer half, or the dead's
  `entombs` tomb), `rise` (`raises`), then `makeGhost`: ghosts (`ghosts`, `Ghost.proxy` a walker
  not in `walkers`, `Player.ghost`) drift (`driftGhosts`), spell only `haunts` words with no harm
  (`haunt`, GHOST_HARMLESS), are seen by all (`refreshViews` through `bodyOf`), and `watch` lets
  them follow the living. `revive` (a `revives` word with the ghost picked, or `deathBeat`: a
  reviver of their side, a former follower or a thing they own beside the ghost). `conceptSpell`
  adds the storm, a mutiny, lives and last stands to any spelling. The storm wall: `startStorm`
  (off under Vitest: `WorldRoom.storms`), `stormBeat` (clock, holds, state `storm*`, harm outside,
  the round's weather), `bendStorm`; bosses go by `roundClock`. Bots: `heldUnder` (bans, tax and
  word limit shape what they afford), `botStorm` (heads into the next circle, holds the wall when
  far out), concept tries in `botThemes` (life, stand, wordsmith, censor, mutiny, storm hurry),
  `ghostBots`. For local testing only: `STORM_CLOCK=200`.
- Screen, knowledge and communication (shared screen.ts, knowledge.ts, comms.ts; `screen.test.ts`):
  the loadout carries `screen` (`screenFor`: statuses, `restoredFor` from gear, buffs, fields and senses,
  `jammed`) and `insight`; `screens` (in `beat`) re-tells a changed screen, sends `intel` (`intelFor`:
  readers are you and your creatures with insight 5+, within their sight or READ_TILES; oracle words
  at most one rack a beat, kept ORACLE_SECONDS) and lies' made-up `call` and DANGER `pinged`
  (`lieBeats`). `ping` { kind, x?, y? } goes through `pingFrom` to `listeners` (shared `hears`) as
  `pinged`; `entrance` calls a non-grand spelling out to listeners as `call` (`callOut`); the
  `unheard` (gag, silence) send neither. Bots: `restore` use (bots.ts: words that give back the panels
  a status greys, tried by `botCure` when no cure fits), HELP pings when attacked in a pact, and they
  walk to an ally's HELP or ATTACK ping (`BotMind.help`); hexes include the new statuses.
- Concept batch: combat. `blow` sends a hit's `aff` ("weak", "resist", "immune": shared affinity.ts).
  `rebuild` sets `Walker.size`/`stature` (`Player.size` for the standee) and `magnets`. Reach adds
  the foe's `hitbox`; `bar` keeps a body over DOOR_STATURE out of every room and lets one under
  SLIP_STATURE under any shut door; `equip` checks `rideProblem` and lets a creature that `carries`
  its master be ridden (`takeNear`). Luck: gathering rerolls a miss, a ruin's X and a hunt's rare
  letter use `luckyChance`, `springTraps` lets the lucky step over (`luckyPast`), `settleGamble`
  throws a `gamble` (house or person) once a spelling is paid, and `use` throws DICE; `luck` messages
  { x, y, text, bad? } go to the client. Control: `walk` mirrors a reversed walker's new target once
  (`mirroredFor`) and sways a wobbling one; `compel` lets a hypnotist steer (target and foe);
  `tether` (after walking) drags the leashed back to LEASH_TILES and lets carried magnets pull;
  a cord-cutting thing carried (`effect_status` leash) snaps a leash; `affect` ending drunk or
  reverse drops the buffs that cause them; `showStatus` adds drunk and reverse from properties and
  sets `Player.tether`. Bots: hexes and cures include the four control statuses; a bot whose blows
  land "immune" FUTILE_BLOWS times leaves that foe for FUTILE_SECONDS (`BotMind.futile`).
  `combat2.test.ts` has a scenario per dimension.
- Playtest batch 2 (`playtest6.test.ts`): ghosts (`haunt`) strip what shared `ghostMayCarry` forbids,
  their areas are `Area.ghost` (never follow, `reaches`/`harms` skip whoever is indoors, a new haunting
  ends the ghost's last: `Ghost.areas`, `dropArea`), bot ghosts pick only words that still do something and
  never an indoor quarry. `Walker.resist` (shared diminishing returns) goes through every `afflict`, `cure`,
  `wake`, `tickStatuses`. Area, fuse, trap and ambush blows use shared `strikeLayers` (shelter scales the
  blow first). `dropCells` strikes as often as the area's word says (`Area.nextCell`; no rate: one cell by
  each person once). `spellWord` adds shared `surcharge`; bots cost words with `spellingCost`. `earn`
  tapers steady income (`taper`: producers, land, roads, citizens, interest) by shared `hoardShare`;
  gathering passes the rack (`Deposits.gather(..., held)`). `trade` and `marketInfo` work at home on your
  own claim (`homeClaim`, HOME_TRADE_EXTRA, no T, `market.home`). Loadout statuses carry `by`
  (`sourceName`: "BOT7's ghost"). Meat and stores go to a killer within PLUNDER_TILES (`kill`). The recap
  headline is the top harm. Wild animals leave newcomers be (`newcomer`, `Walker.arrived`, ARRIVAL_SECONDS).
  `botOffer` never in a fight. `watch` { fight: true } follows the fight going on (`hottestFight`).
  `loadtest/tournament.ts` also prints what killed people (blow, storm wall, area or weather), what decided
  each round, ghost haunts and statuses per living person.
- Turn-based fork (`docs/TURN_BASED_PLAN.md`, `battle.test.ts`): the room option `combat: "realtime" | "turns"`
  (`WorldRoom.combat`: turns by default, real time under Vitest; COMBAT=realtime overrides; rooms filter by it;
  `state.combat`). In turns a DUEL (`challenge`, not a race) opens a battle: `openBattle`, `battles`
  (`BattleRun`, keyed by the ring's area), `Walker.battle` (pinned: `stepBattles` clears targets each tick, the
  combat loop and `thinkBots` skip it, nothing outside strikes it, `pinned` refuses take/drop/use/trade),
  `beginPlan` (PLAN_FIRST/PLAN_SECONDS for people, BOT_ROUND_SECONDS for bots; twice timed out is `away`: the
  bot mind plays after AWAY_SECONDS), `battleAct` (message `battleAct` { move, target?, text? }; a `spell`
  message from a fighter is its move), `resolveBattle` (shared `resolveRound` with hooks: `spellWord` for
  words, `blow`/`settle`/`kill`/`hurtWith` for blows; statuses pass STATUS_ROUND_SECONDS a round with one
  round's damage: `sufferStatuses(…, dotSeconds)`; Defend lays a `spell_cost` rule for one round, DEFEND_WORD),
  `closeBattle` (settles the challenge: a knock-down via `kill`'s RING_FLOOR, a runner gives up the pot),
  `sendBattle` (private `battle` sheet; `battleEvents` { round, events, lines }; never another's choice).
  Bots: bots.ts `botMove` (pure policy over `movesOf`), `botBattleWord` (a better weapon, a mend, armour, a
  ride). `battleLog` (`BattleRecord`) feeds `loadtest/tournament.ts` (COMBAT=…; prints battles and duels) and
  `loadtest/duels.ts` (the same duels in both modes on the same seeds). A DEBUG=1 server takes "debug near"
  (brings the nearest person beside you) for browser checks.
