# Last Word: to-do

## Decided

- 2D top-down, pixel style, one generated map per instance, about 100 players, constant PvP.
- Win by killing everyone else. Death is a full wipe and knocks you out. Alliances must break.
- Letters are spent permanently unless a word says otherwise.
- Words do what they say; counters are other words. Attack absolutes beat defence absolutes;
  among absolutes, specific beats general.
- One adjective per noun by default; other words can grant more slots.
- Combat is stat-based from nouns and their adjectives, resolved in world ticks.
- Objects appear where the speller stands unless the word's `placement` says otherwise
  (sun: sky; theft: a target; rain: a region).
- Each word has one role, whichever is most useful. Verbs act on the caster.
- Acts and events are their own class and make things happen in the world.
- Plurals spawn several; S is a powerful letter.
- A singular noun makes exactly one: WOLF is one wolf, ANT one ant, SHEEP one sheep. A noun's own
  `pack_size` no longer multiplies a singular spawn. Only plurals (`plural_count`, 3 by default),
  number words and adjectives that change `pack_size` (TEN WOLVES, THOUSAND ANTS, TEN WOLF) and
  collectives (archetype group: an ARMY is its `pack_size`) make more than one.
- Objects do what their data says: using one (U) acts as a verb cast on yourself; anything
  with a `field_radius`, light, fear or healing radiates around whoever carries it or where it lies.
- Damage lands on the outermost thing first: vehicle, then armor and shield, then the character.
  Each must be destroyed before the next is hurt.
- A swung weapon scales with its wielder's strength; any weapon scales with training.
- Riding: the unit fights and moves as the vehicle, and the rider's adjectives apply to it too.
- Pets and drones act on their own, as separate units.
- Nothing is indestructible by default. Mountain, sun and god have very high defences and can
  be destroyed by the right thing (dynamite on a mountain, holy or magic damage on a god).
  Only an adjective such as INDESTRUCTIBLE makes something so.
- A god needs no food.
- Desktop only: keyboard and mouse, or a controller. No touch or phone layout.
- On a controller, spelling is done by picking from the letters you hold.
- All assets and word data are generated ahead of time; no model at runtime.
- Every word feeds the same shared systems (PLAN.md); no private mechanics per word.
- The game lives in its own repository.

## Properties words use that the engine ignores

Properties set by at least 20 words in `data/demo.json` that nothing in `shared/src` or
`server/src` reads (searched for the id as a string, plus the `dmg_`, `res_`, `immune_`,
`inflict_` and `produce_` prefixes). Not counted: `counters` (read as `set.counters`), `stealth`
and `security` (read through THEFT's `contest_with` and `contested_by`). 71 properties,
by how many words set them (minds and upkeep took `sentient`, `intelligence`, `food_need`,
`authority`, `recruit_rate`, `command_limit`, `food_output`, `nutrition`, `upkeep_power`,
`upkeep_fuel` and `aggression` off this list):

  `speech` 229, `footprint` 143, `loudness` 139, `value` 118, `faction` 115, `flammability` 109,
  `diet` 108, `reputation` 107, `hardness` 102, `enterable` 102, `read_properties` 102,
  `occupants` 93, `claim_radius` 90, `storage_letters` 86, `labor` 86, `alarm` 85,
  `bind_penalty` 80, `trade_bonus` 77, `map_reveal` 77, `binds` 76, `beauty` 73, `blocks` 72,
  `movement_cost` 71, `cover` 69, `storage_objects` 68, `needs_foundation` 61, `tax_rate` 60,
  `lockable` 59, `law` 55, `craft_slots` 53, `density` 53, `shape` 49, `targets` 48, `state` 48,
  `placeable_on` 47, `build_speed` 47, `read_inventory` 47, `survives_death` 46,
  `grants_adjective_slots` 43, `detect_letters` 43, `grants_slots_to` 41, `seats` 39, `odor` 38,
  `color` 38, `attack_area` 37, `self_propelled` 36, `depth` 36, `camouflage` 34, `moisture` 34,
  `carry_capacity` 32, `temperature_delta` 32, `prevents_death` 31, `fertility` 30,
  `detect_stealth` 30, `container_slots` 29, `terrain_ignored` 28, `knockback` 28, `negates` 27,
  `water_output` 26, `copies` 24, `harvest_bonus` 23, `brittleness` 23, `reproduction` 23,
  `locks` 23, `conductivity` 22, `harvest_sources` 22, `teleport_range` 22, `burn_time` 21,
  `tamable` 20, `growth_time` 20, `elevation` 20

## High priority

- [x] Dedicated loadout and inventory screens (L and I)
- [ ] Loadout and inventory on a controller; item details (what a thing does) on hover or select

## Later: words drive every system (user's notes; not started)

Each word below is an example: build a whole dictionary around each concept, and search the
lexicon so every related word is captured.

- [ ] Brainstorm a few hundred cool systems, then search the dictionary for each one's words
- [ ] Every system and power has an opposing system and power
- [ ] Every mechanic is modifiable by words: player total HP, anything, maybe even graphics
- [ ] Meta words: TYPO makes something break; DICTIONARY gives a full list of words
- [ ] FAILED, BROKEN, PATHETIC, COWARDLY do what they say
- [ ] INVISIBLE does what it says
- [ ] Tiny things have uses (TINY and related adjectives, bugs, swirls): high stealth, slipping
      through defences, higher speed
- [ ] Decide what drives magic: intelligence, or something else
- [ ] OPEN opens doors, locks and walls; GONE, DEAD, BROKEN act on targets
- [ ] FAR moves something far away; abilities to place objects further than normal; teleporting
- [ ] Water, air and land vehicles
- [ ] THIRSTY and HUNGRY raise food needs, and fuel needs for vehicles
- [ ] Technology has a purpose: COMPUTER, MONITOR, CAMERA and the like
- [ ] Ways to see more of the map: wider sight, or a zoomed-out view of the map
- [ ] Scales such as good and evil, smart and dumb, that words move players and things along

## Data

- [x] Word lists by role, class and archetype (59,232 with a role, 5,385 inert)
- [x] Property schema (349 properties, 14 groups)
- [x] Letter sources for all 26 letters
- [x] Demo dictionary with property values (351 words)
- [x] Comparatives and superlatives (401 forms)
- [ ] Review the role and archetype of every core-tier word (about 6,400); WordNet's first
      sense is often not the useful one (chair came out as a person, table as a group)
- [ ] Rule on comparatives that are also real words (number, flatter, better): which meaning wins
- [ ] Review the scale of the demo numbers: real-world units and very large gaps between words
      (nuke 5,000,000 damage against sword 40); confirm or compress before the full pass
- [x] Plural rules, including irregular plurals (shared `plural.ts`)
- [ ] Verb tenses
- [x] First property pass: 2,958 generated words merged (3,310 in the dictionary), written by
      Opus 5.5 subagents from the same prompt and examples the batch would use
- [ ] Rule on words kept out of the dictionary (`EXCLUDED` in generate_words.py): nationalities,
      religions, ethnicities, sexuality, disability, and sexual violence, self-harm and hate
- [ ] Review generated entries the subagents flagged: PIECE (gun or chess piece), FIGURE,
      DIFFERENCE, ROADS (written as an anchorage; players will expect the plural of ROAD), CHAT
      (a bird), ABSOLUTE, ZERO and NONE (zero multipliers), NON and OTHERWISE (negative
      multipliers), MILLION and BILLION (plural_count of a million and a billion), LATE (kills
      what it modifies), IMPOSSIBLE (absolute evasion), CHRIST was excluded, TRUMP (a trump card
      that beats everything), DELETE (a verb that destroys a touched target)
- [ ] Generated words use properties the engine does not act on yet (effect_multiplier on
      adverbs, negates, copies, strips_adjectives, plural_count); sky words like PLANET are now
      fields
- [x] Plural forms in the lexicon (ROADS, LEGS, FALLS): the plural rule wins when the entry has
      the singular's archetype; an entry of another archetype (MEN, PEOPLE: groups) keeps its own data
- [ ] Next batch: words 3,001 to 10,000
- [ ] Grammar words (are, have, not, but, the rest of `GRAMMAR` in generate_words.py) need a
      deliberate ruling: inert, or something spectacular
- [ ] Sanity checks on that pass: sibling ordering (pond < lake < sea < ocean), unit ranges
- [ ] Map every property to one of the shared systems; drop or merge any that touch none
- [ ] Tile-level quantities (temperature, moisture, fertility, light) so effects spread by adjacency
- [ ] Find a use for the inert bucket (states, communication, shapes, processes, days and months)
- [ ] Words that are not in WordNet (slang, new words)
- [ ] Art pass (M7): before choosing, prototype a few distinct, unusual graphic styles for the
      user to pick from; then a sprite or icon per word in the chosen style
- [ ] Pick an art style from the prototypes (client/styles.html)

## Special objects: dictionary and related words

Words about words get hand-designed effects instead of generic ones, since they can act on the
game's own material: letters, spellings and the dictionary.

- [ ] DICTIONARY and its relatives (lexicon, thesaurus, glossary, encyclopedia, vocabulary,
      library, book, scroll)
- [ ] The currency itself (letter, alphabet, word, vowel, consonant, syllable, rune, glyph)
- [ ] Writing tools and writers (pen, ink, font, typewriter, printer, scribe, author, poet)
- [ ] Parts of speech and wordplay (noun, verb, adjective, synonym, antonym, anagram,
      palindrome, rhyme, pun, riddle, crossword)
- [ ] Decide each one's effect; ideas: DICTIONARY shows what any word would do before you spell
      it, THESAURUS swaps a word for a synonym, ANAGRAM rearranges an object into another word
      with the same letters, VOWEL and CONSONANT change which letters a source gives
- [ ] These overlap the "words that mean the currency" entry on the watch list below; rule on
      both together

## Overpowered word watch list

Full list with spelling costs: `data/watchlist.tsv` (269 words). Rulings needed:

- [ ] Map-scale nouns made of common letters: sea, sun, star, ocean, atom, doom, death
- [ ] Number words and collectives as multipliers: ten, million, army, horde, swarm, legion
- [ ] Scaling modifiers with no scarce letters: all, more, total, infinite, immortal
- [ ] Words that mean the currency: letter, alphabet, word, noun, rune, pen
- [ ] Death escapes under 9 points: soul, heir, clone
- [ ] Verbs whose target is unclear when cast on yourself: erase, reset, undo, end, die
- [ ] Beings: god (three ordinary letters), titan
- [ ] Time, fate, luck and other cheap abstractions
- [ ] Plurals of everything above (suns, gods) for one more S
- [ ] Re-score the list once real letter generation rates exist; cost is currently letter
      scarcity in the lexicon

## Design still open

- [ ] IRRESISTIBLE against other absolutes is an edge case; revisit only if it comes up in play
- [ ] Damage a destroyed layer did not absorb is lost; decide whether it should carry through
- [ ] A sword cannot hurt plate armor at all (40 slash, 60% resisted, 30 armor); confirm that is
      intended, since it makes armor a hard counter to most hand weapons
- [ ] Behaviour for pets and drones acting on their own
- [ ] Which layers an attack can reach (land, air, water, underground); `targets` is not enforced yet
- [ ] Area damage, friendly fire and lingering damage; only one-on-one strikes exist so far

- [ ] How events are contested (theft: speller's stealth against target's security) and what
      range they reach
- [ ] How long a round runs in practice; what to do about players who are offline if it is days
- [ ] Turtling and snowballing; revisit after playtests
- [ ] How alliances are formed through words (treaty, clan) and how they break
- [x] Upkeep: food, fuel and power as the natural limit on large things (see Build)
- [ ] Upkeep still to do: `diet` (what a creature eats), `water_output` and water as a fourth
      store, `production_needs` (a FARM's labour and water), `fertility` beyond gathering; power
      is counted per minute like the others, not as a load that must be balanced at each moment
- [ ] Letter generation rates and map distribution of sources
- [ ] NPC behaviour in cities and countryside
- [ ] Trading interface: barter, market, pooled spelling

## Later

- [ ] Map conditions: five random adjectives applied to the whole map at the start
- [ ] Family mode with a filtered word list
- [ ] Map size scales with the number of players in the round
- [ ] Winners' rounds: the winner of a round is matched against other winners
- [ ] Track consecutive wins; reward streaks with appearance-only adjectives on the player
      (GOLDEN, RADIANT and the like) that change how they look and nothing else
- [ ] Rarity and chaos words (RANDOM, SPECIAL, MYTHIC, LEGENDARY, EPIC, RARE) change how letters
      are generated and what nouns do, in large and showy ways

## Build

- [x] Choose stack, hosting, netcode and art approach (see PLAN.md)
- [x] Move to its own repository
- [x] M0: scaffold packages, test commands, CI
- [x] M1: rules engine (operators, degrees, absolutes, combat tick)
- [x] M2: server, generated map, movement, sight-based views; 100-bot load test passed
- [x] Load test with objects, creatures and playing bots (results in PLAN.md)
- [x] Path-finding: walkers go around water, mountains and walls, and prefer roads
- [x] M3: client connects, draws the map, walks, and spells words into objects
- [ ] Controller input: movement, and spelling by picking from held letters
- [ ] Spelled objects only sit on the ground; no equipping, placement rules or effects yet
- [ ] Starter letters are a placeholder hand (SWORD plus 20 random) until letter sources exist
- [x] M4: gathering by hand, letter production from objects, giving letters to a nearby player
- [ ] Letter sources are a first pass: gathering depends only on the ground, and objects pay
      out without needing labour, water or fuel. D, F, H, K, V, J, Q, X, Z have no source yet
- [ ] Trading is a typed command (give player2 abc); needs a real interface and two-way offers
- [x] M5 (part): equipping, picking up and dropping, attacking players, death and knockout,
      last one alive wins
- [x] M5: terrain words reshape the map; things on the ground can be attacked and destroyed;
      D, K and V now have sources (destroying things, kills, beating another player's things)
- [x] M5: verbs act on the caster for their duration (RUN, FLY, HEAL, SNEAK, HIDE); THEFT takes a
      selected thing if your stealth meets its security; sky words set day, night and weather
- [x] M5: creatures you spell follow you, defend you and fight what you fight; ones you can
      ride are mounts instead; they outlive their master, ownerless
- [x] Events act through their properties: MURDER, RAID, REPAIR, RESCUE, TRADE, REVOLT, AMBUSH,
      and areas that damage or turn hostile (FIRE, WAR, EARTHQUAKE, FAMINE); WAR triples K
- [ ] SIEGE does nothing yet (food upkeep exists now; cutting supply off is the next step)
- [x] Right-click picks out a target or marks a spot without attacking; targeted area events
      (FIRE) must be aimed and in reach; region events (WAR, EARTHQUAKE, FAMINE) cover the speller's
      surroundings
- [x] FIRE spreads over forest (fast), grass (slower) and swamp (barely), not stone or water;
      a word that counters it (RAIN, FLOOD) puts fires out and stops new ones taking hold
- [ ] Burnt ground stays as it was; forest could turn to bare ground after a fire
- [ ] EARTHQUAKE covers 375 tiles and hits everyone, its maker included
- [x] Plurals and numbers: CATS is `plural_count` cats (3 by default) for one more S; a singular
      is exactly one (WOLF is one wolf; a collective such as ARMY is its `pack_size`); number words (TEN, THOUSAND, MILLION: adjectives,
      or quantity nouns used as one) set how many and take the adjective slot. Up to 12 spawn
      separately; more are one creature or thing with a count (ANT ×1000) whose integrity, mass,
      damage and letter output are multiplied by it. That is how large counts are represented,
      not a cap. Terrain is laid once with its area multiplied by the count
- [x] Verbs: `<adverb> <verb>` (QUICKLY RUN, FOREVER FLY). Adverb ops on effect properties change
      the verb (duration, cast_time, restores); `effect_multiplier` is the strength the verb's own
      ops apply at; other adverb properties add to what the verb does. One adverb per verb.
      Touched verbs with event properties act on the picked target (DELETE, STEAL, BUY, CAPTURE,
      GRANT, GRAB, PULL, SUCK, SEND). 287 of 288 verbs do something; REPEAT (`duplicates`) does not
- [ ] Verbs still to do: `cast_time` is not a delay yet; 37 verbs only change properties nothing
      reads yet (CLIMB, DIG, LISTEN, VOTE, POLISH...); `effect_target` held, companion, mount and
      touched (other than event properties) still land on the caster; SEND pulls its target to you
      instead of sending it away; an instant verb (HEAL) carries no adverb body effects
- [ ] Plurals of events, fields and sky words (FIRES, SUNS) are refused; decide what they do
- [x] Using objects: U (or Use in the I and L screens) eats, drinks or takes what you carry or
      what lies within 2 tiles, as a verb cast on yourself: `restores`, `effect_status` cures,
      ops for `duration`; `single_use` ones are gone after, one of a stack at a time
- [x] Radiating objects: a `field_radius` object gives off its field as a field word does (held:
      around the holder; on the ground: around itself; a creature: around itself); `luminosity`
      lights that many tiles (night vision), `fear_aura` lowers enemies' morale in sight, `heals`
      heals your side in reach. It ends when the thing is dropped (moves to the ground), destroyed
      or dies
- [x] Minds (shared `mind.ts`): morale falls at once (a drop scaled by 5 / courage; immune_fear
      is unshakeable) and climbs back half a point a second; below 3 aim is halved; at 0 a walker
      runs from its nearest enemy and does not strike. Cunning creatures (intelligence 7+) go for
      the weakest and pull back under a quarter of their health; dim ones (under 3) go for the
      nearest and re-route slowly. Only sentient creatures take orders; obedience under 3 (plus
      the master's authority) ignores some. Anyone commands 12 creatures, plus the
      `command_limit` of what they own and wear (KING 50, CROWN 10); the newest beyond it run wild.
      `recruit_rate` draws the nearest wild creature in sight. Wild creatures with aggression 5+
      attack whoever they see; the rest wander. THEFT takes a creature past its loyalty
- [x] Upkeep (shared `upkeep.ts`): each person has food, fuel and power stores (shown in the
      loadout). What they own supplies (`*_output`) and draws (`food_need`, `upkeep_*`) each
      minute; eating adds `nutrition`; gathering on grass, forest and swamp finds a little food.
      Short of it: a person starves (5% of health a minute), a living thing goes hungry and loses
      a loyalty a minute until it turns wild (a ridden DRAGON throws its rider), a machine stalls
      (no letters, no supply, no strikes). Notices say when something goes hungry or stops
- [ ] Minds still to do: morale shown only to its owner (others see "fleeing"); orders other
      than "fight that" (stay, guard, go there); `tamable`; wild creatures do not defend themselves
      when aggression is under 5; a pack's fear auras stack, so a big wild pack breaks a crowd
- [ ] Hunger: `toxicity` (eating ACID, DRUG) and `potency` are ignored
- [ ] Edible creatures (FISH, TURKEY, BASS) spawn as creatures that follow you, not food
- [ ] Creatures do not gather or work (`labor`)
- [ ] A wolf kills an unarmoured person in three bites (about two seconds); review creature
      damage against the 100 integrity of a human
- [ ] Weather and night cover the whole map; region-sized weather and per-tile quantities
      (temperature, moisture, light) are not built
- [ ] Sky and weather change only sight and speed so far; their other effects (wetness, growth,
      crop output) wait on the tile systems
- [x] Field words (120: LOVE, FEAR, HOPE, CHAOS, DISEASE, HEAVEN, PLANET, GALAXY...) are auras
      that follow their maker, fields where aimed, or conditions over a region or the whole map;
      every one is spelled in a test and every one does something
- [x] Statuses (shared `STATUS_RULES`): every strike, area, field and AMBUSH gives its
      `inflict_*` unless the body is `immune_*`; stun, root, freeze and sleep stop walking;
      fear makes you run; burn, poison and bleed hurt each second; silence (and SILENCE's
      `silences` radius) stops spelling; verbs, RESCUE and fields with `effect_status` end them.
      Shown under names and in the loadout. `sets_hostile` areas turn creatures inside on the
      nearest walker not on the maker's side; contagious DISEASE passes from carrier to carrier
- [ ] Statuses still to do: `contagion` on creatures and adjectives (RAT, ZOMBIE, SICK) does
      nothing; objects with `effect_status` (MEDICINE, CURE, HOSPITAL) cannot be used yet;
      SLEEP the verb ends sleep rather than causing it; CAP halves the blindness you inflict,
      not the blindness you take; `sets_hostile` does not move people, only creatures; damage
      over time is a flat amount a second, not scaled by what inflicted it
- [ ] Hidden or invisible players are still drawn for others; stealth against detection is not
      used for what a client is sent
- [ ] Right-click picking on a controller
- [ ] Terrain is laid where the speller stands and pushes everyone to the nearest ground; a
      destroyed lake or mountain marker cannot be removed, and terrain cannot be undone
- [x] Rounds end: the room locks, everyone sees who won with a countdown, then all clients
      join a fresh room with a new map. The dead watch until then
- [ ] Waiting for players: a round starts as soon as one person joins, and anyone can join
      mid-round until it ends
- [ ] Labels of adjacent players overlap; fix in the art pass
- [x] M6 (part): bots that play (gather, spell, fight) in the load test
- [x] Deploy-ready: one container serves the page and the game; Dockerfile, fly.toml and
      DEPLOY.md; image built and played locally
- [ ] M6 (rest): deploy to Fly.io; needs the user's account
- [x] Image slimmed from 891 MB to 435 MB: production dependencies only, without the unused
      uWebSockets.js transport
- [x] Tick spikes: caused by many route searches in one tick; capped at 12 a tick, worst tick
      in a 5-minute playing run is now 44 ms
- [ ] M7 in PLAN.md
- [ ] Map generator: cities, countryside, letter sources
- [ ] Demo: one map, the 351-word dictionary, a handful of players
