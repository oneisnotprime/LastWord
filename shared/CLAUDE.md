# shared: rules engine

Pure TypeScript. No I/O, no timers, no randomness except through a seed passed in. Both the
server and the client import this, so anything here must give the same answer on both.

- Test: `npm test -w shared` (Vitest). Typecheck: `npm run typecheck -w shared`.
- Data comes in as plain objects. Tests may read `../data` from disk; source files may not.
- Every rule gets a unit test. A word must act only through shared properties, never by name.

## Map

- `dictionary.ts` word and property lookup, including inflected forms (BIGGER -> big); `crude`
  (data/crude.json from tools/crude.txt): never a tip, a word of the moment, or a bot's word.
- `stats.ts` `resolve(dict, noun, adjectives)` builds an object's properties; tracks absolutes.
- `combat.ts` `strike`, `tick`, `duel`. The absolute rules are documented on `strike`. Blows and
  bodies are felt (`felt`: in full to FELT_KNEE, the square root past it) and paced (`landed`,
  FIGHT_PACE); `windupOf` says which blows wind up (HEAVY_SHARE, WINDUP_SECONDS, DODGE_TILES).
- `hazard.ts` harm from the sky and areas: AREA_WARNING, cells (CELL_FROM, CELL_TILES,
  CELL_WARNING, CELL_SCATTER, `cellGap`, `cellRadius`), shelter (`shelterShare`, ROOF_TILES), and
  `selfRisk` (the spell preview's warning when a word's strikes can land on its speller).
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
  action letters), `Deposits` (gathering: forage anywhere (E and the biome's pool), O by water, G in hills, U by mountains, per
  8-tile patch, running out and growing back slowly; sites: chests give X, the temple Q),
  `placeSources` (markets, temple, chests, ruins, wild animals on the `mainland`), `spawnPoint`
  (people far apart), `regionOf` (exploring gives J), `exploredSight` (sight from regions
  explored: SIGHT_EXPLORE), `MARKET` (any 4 for 1) and `readTrade` ("trade eeee for o"), `rackSwap`
  (a market's once-only swap, drawn from `HAND_FILL`), `marketRatio` (whole letters),
  `killLetters` (K, V, H) and `destroyLetters` (D, V, F, X); `production` reads `produce_*`;
  `Deposits.problem` says why gathering would find nothing; `GATHER_REASONS` names each deposit
  for the letter popup; `chestPrize` is the prize that comes with a chest's X; `LETTER_GUIDE` is the
  alphabet guide under the spell box (test-checked against the data).
- `produce.ts` things you own that make letters (PLAN.md table): `producerOf` reads `produce_*`
  and `production_needs` (tilled, water, labor, wind, flow, claim, harvest, extract, vowel or a
  letter used up); `outputOf` gives letters a minute in measured `Conditions` and why not
  ("needs tilled land", "no wind"); `windAt` (map wind), `moistureAt`, `Soil` (fertility per
  8-tile patch, worn by crops), `ageRate` (Y from age), `needsText`, `producingLine`.
  `Tile.Field` is tilled land; a `soil` stamp changes only `SOIL` tiles.
- `territory.ts` land, roads, cities, trades and bosses: `landHeld` (tiles per owner, contested,
  weighted by claim age `taper`), `roadRun` (a road word's run), `readOffer`, `readTransmute`,
  `transmuteProblem`, `bossWords` (bosses from the data), and the rates (`LAND_RATE`,
  `ROAD_RATE`, `CITIZEN_S`...). `stampTiles` in world.ts gives a stamp's tiles; a stamp with
  `x2`, `y2` is a run between two points.
- `economy.ts` `starterHand` (eight letters around a word that produces something, `starterWords`)
  and `reachability`/`reachTable`: the shortest chain from the action letters to every letter,
  through producers whose needs are reached (a crop needs a tilling word, furniture a claim);
  its test prints the table. `PENDING_SOURCES` lists letters no source reaches yet.
- `unit.ts` a character with its gear: damage layers, held weapon scaled by strength and
  training, riding. `strikeUnit` hits the outermost layer.
- `biome.ts` biomes (`BIOMES`, one per walkable `Tile`; `generateMap` lays large regions from
  ranked temperature and moisture): each has a name, a `habitat` tag, a forage chance (about 60%
  at a typical spot: 15% on snow to 70% in jungle) and the letters it finds, written as whole
  percents (`pool`, 100 letters, E first at 30 to 40%, then letters fitting the ground; PLAN.md
  "Letter economy"). Hostile ground (desert, badlands, tundra, snow, ash) finds less often but
  has J, K, V, Y, X; Z only on ash (1%); never Q. `INTERIOR` is the biome inside any building's
  room (`biomeAt(..., indoors)`; `Deposits.gather` takes `indoors`: only foraging, household letters,
  45%). `forageOdds` gives the HUD's shares. `toolHelp`: things whose `harvest_sources`
  name a kind of gathering add 10 points a point of `harvest_bonus` (SHOVEL dig, NET fish, BASKET
  forage); `roll`/`rollText` ("JUNGLE 35% · +10% SHOVEL"); `wildlife` (creatures by `habitat`,
  the big and fierce rarer); `huntYield` (H, the animal's first letter, more for big bodies,
  blades, bows on birds, hunting gear, a rare letter from far-off animals).
- `status.ts` `STATUS_RULES`: the one table of what each status (stun, fear, poison...) does;
  `statusSeconds` stretches a word's seconds (`STATUS_STRETCH`, bent back past `STATUS_HORIZON`),
  `effectSeconds` a verb's or a use's `duration` (about twenty times);
  `afflict` gives a struck body its attacker's `inflict_*` unless `immune_*`, `hampered` says
  what it may still do, `statusDamage` is a second of burn, poison or bleed.
- `path.ts` `findPath`: A* over tiles around anything that cannot be walked, preferring roads;
  search buffers are shared, so it is not safe to call from two threads. `clearLine` checks every
  tile a line touches (sampling missed corners a walker then ran into).
- `world.ts` `stepToward` slides along an edge instead of stopping dead, and walks out of ground
  nobody can stand on; `openGround`/`roomAround`: where to put someone the land changed around, so
  they are never boxed into a pocket of a tile or two.
- `rng.ts` seeded generator. Pass an `Rng` in; never call `Math.random`.
- `testdata.ts` loads the demo dictionary from disk, for tests only.
- `mind.ts` morale (`moraleGoal`, `nextMorale`, `routed`, `moraleAim`), how creatures choose
  (`chooseTarget`, `retreats`, `ignoresOrder`) and command (`commandLimit`, `recruitRate`).
- `upkeep.ts` food, fuel and power: `needs`, `outputs`, `draw`, `supply`, `groundFood`,
  `carcassFood` (what a hunted body feeds, by its mass);
  `startingSupply`: a newly made machine brings `STARTING_SUPPLY_MINUTES` (30) of what it draws.
- `place.ts` what an area does to letters and acts (`placeRules`): yields from `produce_*` and
  `harvest_bonus` ops, `growth`, `deposit_factor`, `tax_rate`, `lode`, `trade_rate`, `law`; `harvest`
  applies them to letters earned; `rulesText` says it in plain lines. `Deposits.scale` and the
  `growth` argument of `gather` act on the ground; `marketRatio` turns `trade_rate` into a price.
- `inspect.ts` `eventCard` and `countersOf`: what an event, field or weather in force does, and the
  words that end it (event chips; remembered per dictionary). `lasting`: whether a spelling lays
  something lasting (map-wide `LASTING.wideMinutes`, or one place `LASTING.localMinutes`); the
  polish2 test checks every one has a word that ends it.
- `territory.ts` `discTiles`: a claim's tiles, remembered per map (`landHeld` uses it).
- `inspect.ts` cards telling what something is (spell preview, right-click inspect): `inspectText`,
  `cardOf`, `keyStats`, `behaviours`; `heldText` (one line: what carrying it does, or "no effect
  held"), `effectText` (what something in force on you does); `becomes` (creature, worn, terrain or ground: the rule the
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
- `kits.ts` starting kits: `dealKits` (three kits, all parts different), `kitHand` (eight letters
  around a starter word, leaning toward the job), `jobStats`/`jobBodyOps`/`jobRules` (a job as a
  carried tool, body operations and place rules), `kitCard` lines, `kitScore`, the pick in three
  steps (`KIT_STEPS` job, building, letters; `kitOptions`, `bestOption`, `kitHands`). No legendary.
- Dictionary themes (TODO.md), each a shared system words use by their properties:
  - `material.ts` (materials): a material noun before a noun (GLASS SWORD) or an adjective whose
    `material` names one (WOODEN) remakes the thing out of it (`applyMaterial`, called by `resolve`):
    density, toughness, hardness, brittleness, flammability, conductivity, value, colour, and the
    material's own damage and resistances; `susceptibility` (brittle things shatter, flammable burn,
    low melting points melt, conductors carry lightning) is read by every `strike`; `materialText`;
    `alchemyRatio`: a carried precious material lets you transmute to Z (from TRANSMUTE_RATIO, less
    for richer stuff), and is used up. Without it or a `transmute_in` thing there is no transmuting.
  - `food.ts` (food): `raw` things by heat (`cooks`: 150 C within COOK_RANGE) become their
    `cooks_into` or COOKED (`cooked`); past `shelf_life` they go ROTTEN (`rotted`); `toxin` is the
    poison eating gives. States sit on `Spelled.states` (adjectives that take no slot).
  - `produce.ts` `grow` (plants): rooted living things grow from SEEDLING to full yield over
    `growth_time` × GROW_PACE minutes at the place's growth; `Conditions.grown` scales output.
  - `work.ts` (professions): `jobsOf` reads a worker's jobs from its properties (farm, craft, build,
    scout, trade, heal, preach, lead, guard); `haggled`, `builtBy`, `jobText`.
  - `law.ts` (law): `pactOf` (`binds`: a pact with people you pick, `bind_penalty` for breaking
    it), `breachText`, `takeLetters` (fines, commonest letters first). `place.ts` adds `fine` and
    the `hunt` law.
  - `home.ts` (buildings, furniture): `comfortOf`/`homeComfort` (comfort at home: morale and
    healing by the square root of the sum), `storageOf`/`exposed` (stored letters are out of
    thieves' and fines' reach; `takeLetters` takes a `stored` floor), `keepSafe`/`hoards` (at death
    the rarest stay in the stores), `holdFactor` (a lockable thing's claim slows enemies' root and
    silence: `tickStatuses` takes it; `Claim.holds`), `homeText`.
  - `craft.ts` (tools and crafting): `crafts` on a station names what it makes and works;
    `craftPlan` (HANDMADE, made of a carried material it works), `makesAt`, `worksAt`, `craftText`.
  - `tech.ts` (machines): `eyeOf` (a thing on the ground that watches: its tiles on its owner's
    minimap), `automates` (a machine's `labor` works producers near it), `techText`.
  - `herd.ts` (animals): `breedRate` (two or more of a kind, fed, near: young at `reproduction`
    × BREED_PACE a game hour per pair), `herdText`.
  - `body.ts` (body parts): a bodypart (`equip_slot` graft) is grafted on whoever is picked
    (`aimOf` "someone"); `GRAFT_CAPABILITIES` become the body's, `handsOf` (each graft granting
    `held` is a hand; `Unit` takes 2 + that), `graftCosts` (food a kg, land speed by weight, a
    seam to sickness), `severing` (`severs`: grafts cut off), `bodyText`.
  - `wear.ts` (clothing): `lends`/`lend` (a thing worn in a body slot, not protection, adds its
    `LENT_ADD`, `res_*`, `immune_*`, camouflage; `Unit` calls it), `airAt` (biome `BIOME_AIR`,
    night, weather and fields' `temperature_delta`, a fire near by), `exposure` (cold or fire
    damage past `temp_min`/`temp_max`), `disguised` (`disguise` against `detect_stealth` and a
    nose), `wearText`. `Unit` also adds held things' `loudness` to the body.
  - `disease.ts` (disease): the `sick` status (status.ts); `catchChance` (contagion a minute cut
    by `res_disease`), `recovered` (IMMUNE_SECONDS), CONTACT_TILES, `law` contact (place.ts
    `LAWS`), `diseaseText`. `Affliction.contagion` carries how catching it is.
  - `emotion.ts` (emotions): the `rage` status (`berserk`), `wonOver` (CONVERT_SECONDS of charm
    wins a creature), `spoiling` (TEMPER_FROM aggression), `emotionText`.
  - `sound.ts` (music): `earshot` (HEARD_FROM loudness, EARSHOT tiles a point, plus
    `hearing_range`), the `deaf` status (`UNHEARD` in status.ts: charm and sleep do not reach the
    deaf), `soundText`.
  - `money.ts` (money): `pays` (letters handed over; `canPay`), `contestOf` (a word's own value
    is the speller's side of a contest: a BRIBE's price against loyalty), the `debt` status
    (`debtDue`: a letter every DEBT_SECONDS to the creditor; `owesTo`: a debtor's things have no
    security against them), `interestDue` (a store's `interest` as T), `moneyText`.
  - `crime.ts` (crime): traps (`isTrap`: `trigger_radius`; `springReach`; `hiddenFrom`: stealth
    against detect_stealth), SEES_THROUGH, `crimeText`.
  - `signal.ts` (information): the `expose` status (status.ts `exposed`; EXPOSED_TILES),
    `readout` (what `read_inventory` tells), decoys (`decoyAt`, `fooledByDecoys`), `jams`,
    `signalText`. `Sensed.jammed` blacks out the minimap.
  - `faith.ts` (religion): faith is a fourth `SUPPLIES` store (`faith_output`, `upkeep_faith`),
    `faithProblem` (`faith_cost`), `offering` and ALTAR_TILES (`sacrifice`), the `bless` and
    `curse` statuses (status.ts `earns`, `earnFactor`; `boon`: areas give a boon to their side),
    `faithText`.
  - `weather.ts` (weather): `weatherTile` (a weather word's `tile_type`), `PATCH_FROM` (what each
    laid tile may change: a stamp's `only` mask in world.ts), `patchNear`, PATCH_SECONDS,
    `weatherText`.
  - `time.ts` (time): `timeOf` (a body's `time_scale` times its statuses' `time`: haste 2, stasis 0;
    `tickStatuses` takes it), `areaTime`/place.ts `timeAt` (an area's time on letters made, growth
    and ageing), `rewound` (REWIND_WINDOW of health history), `agedBorn` (`ages`), `timeText`.
    Statuses `haste` (ends slow, slow ends it) and `stasis` (still, helpless, `untouchable`).
  - `space.ts` (space): `gravityOf`, `gravitySpeed`, `gravityRange`, `floats` (under FLOAT_BELOW),
    `grounded` (from GROUNDED_FROM), `knockbackOf` (`anchored` holds), `impacts`/`impactNear`
    (`meteors`), `spaceText`; `pull` is an area's.
  - `sea.ts` (sea): `sails` (a vessel), `SAIL_COST` (world.ts `Costs`: `walkable`, `stepToward`,
    path.ts `findPath`/`clearLine` take it), LAUNCH_TILES, BOARD_TILES, PORT_TILES, PORT_TOLL
    (`docks`), `waveDamage`/`waveSlow` (`waves`), `fishTable`/`catchOf` (a catch's letter), `seaText`.
  - `sport.ts` (sports): `Challenge` (`stakes`, `race_to`: `ahead`, `pot`, `backInRing`, RING_FLOOR,
    FLAG_TILES), `peaceOf` (`peace` gives the `truce` status: helpless, `untouchable`), `sportText`.
  - `idea.ts` (abstract ideas): `luckOps` (`luck`, LUCK_POINT; `Unit` applies it), `chaosOps` (the
    `chaos` status's random ops, on `Affliction.ops`), the `void` status (`nulls`: `hampered.nulled`),
    the `doom` status (`fated`, `doomDamage`), `typoOf` (`misspells`), `spellchecked` (`spellchecks`),
    `standsFor`/`standIn` (`stands_for`: a stand-in pays for another word), `ideaText`.
  - `bug.ts` (bugs, theme 26): `matured`/`matureSeconds` (`matures_into` after `growth_time` ×
    GROW_PACE: the server's `bugs` swaps the creature, count and master kept), `bores` (BORE_TILES,
    BORE_TIMES: a borer eats things of its `bores` materials, through armour), `bugText`.
  - siege and arms (theme 28): `interior.ts` door guards (`doorGuard`: lockable, `blocks` land, not a
    room, not carried: PORTCULLIS, DRAWBRIDGE, GATE; GUARD_SHARE of its integrity added to its owner's
    door; `boltsAgainst`/`opensPast`: a guard bolts the door against what it counters unless the breaker
    counters the guard), `guardText`, and a siege line on cards (`interiorText`). Engines are mountable
    weapons with `siege` (combat.ts already multiplies blows on built things).
  - mythic beasts and prehistoric giants (theme 29): bug.ts `hatches` (a thing that `matures_into` a
    creature hatches where it lies or is carried: EGG, COCOON, PUPA); counters are `counters` read by
    the server's `exterminate`.
  - traps and dungeons (theme 30): crime.ts `rearms` (a trap with no `single_use` re-arms after
    REARM_SECONDS), `capturesInto` (`captures`: a sprung trap or an event on a person drops its victim
    into its owner's nearest lockup within CAPTURE_TILES); interior.ts `holds` (a walk-in lockup, home.ts
    `holdFactor`, keeps enemies inside until its door is broken).
  - heraldry, courts and fealty (theme 31): law.ts `PactSpec.tribute` (a pact word's `tax_rate`: the
    others pay the speller, the liege, that share of every letter they earn), `endsPact` (a word whose
    `counters` names a pact's word frees its speller with no penalty), `tributeText`.
  - stone and ore (theme 27): food.ts `heatNeeded` (a raw thing's `smelts_at`: ore smelts into its
    `cooks_into` metal only by that much heat); rocks, minerals and landforms are data on the
    material, terrain and trap systems.
- Frequency batch 1 (`freq1.test.ts`): data only. A noun's archetype decides how it acts (`phrase.ts`
  `kindOf`): an act aimed at someone needs an event archetype (act, event, crime...); a knowledge,
  feeling or attribute word with a `field_radius` is a field; a physical class (artifact, person...)
  is an object whose field radiates from it. No object or creature radiates fear, healing or a field
  past 200 m (the map is about 1 km across).
- Frequency batch 2 (`freq2.test.ts`): data only, the same rules. Units (REGIMENT, LEGION) are fields
  that `summons` soldiers; counter adjectives act by meaning (HARMLESS, UNARMED, PARKED, SUNK).
- Frequency batch 3 (`freq3.test.ts`): data only, the same rules. Terrain-class words with a
  `field_radius` and no `tile_type` are objects (`kindOf`), so self fields such as ROOFTOP and
  SKYLINE are attributes; `summons` acts only on areas (fields and events), not on objects or verbs.
- `combat.ts` `shown`: damage, HP and integrity as cards and tips show them (felt).
- `letters.ts` `salePrice`: what a market pays for a thing sold, by its `value` (SALE_MAX).
- `tips.ts` teaching tips: `wordTip` (one line of what a word does in numbers, plus its shortest
  counter-word), `wordIdeas` (one word per `TIP_KINDS` kind, weighted by `tipWeight` toward words
  the held letters nearly spell), `RULE_TIPS` (short "did you know" lines, test-checked against the
  data), `tipOfTheMoment` (either, for the idle spell window).
- Fun batch C2: `inspect.ts` `objectKind` (weapon, gear, ride, creature, building, terrain, item;
  tips.ts `spellGroup` uses it) and `leadStats` (a card's numbers in the order its kind cares
  about: a weapon's damage and reach, a creature's HP, a ride's speed; `integrity` reads "HP" on
  the living); `cardOf` puts `trivia` (made of, loud) after what changes a fight, and fields and sky
  words get radius and minutes as stats. `behaviours` offers swinging a ground thing only if its
  class is a made or natural object a person (strength 5) can lift ("too heavy to carry" else) and
  says when a `single_use` explosive goes off. `grandeur`/`grand` (GRAND_FROM): whether a spelling
  makes an entrance. tips.ts `bestWords`: the few best words a rack spells now for a `Situation`
  (power for its kind plus what the speller lacks; two a group; the last place for the biggest).
  economy.ts `starterWeapons`/`weaponLetters`: starting hands (`starterHand`, kits' `kitHand`) add a
  weapon's letters where they fit.
- Walk-in buildings: `interior.ts` `interiorOf` (the rule: `enterable`, not `portable`, `occupants` 1
  or more, `footprint` at least INTERIOR_FROM 3 tiles, times `count`; radius 0.5 + √footprint / 2
  tiles; door DOOR_SHARE 0.1 of integrity), `doorAt` (south wall), `within`, `opensDoors` (`counters`
  door, lockable or gate: KEY, THIEF, RAM), `seesThroughWalls` (RADAR), DOOR_MEND, DOOR_QUIET,
  BESIDE_TILES, `interiorText` (on `cardOf` through `behaviours`).
