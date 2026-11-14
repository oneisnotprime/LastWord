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
- Maps have biomes (jungle, desert, tundra, savanna, badlands, volcanic ash, meadow, taiga,
  marsh, shore) in large regions; each forages its own letters, and most forage tries find
  nothing (12 to 35%, more with tools whose `harvest_sources` fit). Wild animals suit their biome.
- A hunt pays H and the animal's first letter (FOX: H F), plus bonuses from the body and the tools.
- J comes once per 64-tile region, to whoever is first there; X from eight one-X caches (dug at
  35% a try) and one ruin in four.
- Statuses and temporary effects last several times their word's seconds (`statusSeconds`,
  `effectSeconds`): stuns about three times, most twenty, damage over time twice.
- Nobody strikes past their sight: a weapon's reach is cut to its wielder's sight (TELESCOPE,
  RADAR and night change it). Threats coming from beyond sight are shown at the screen's edge.
- A click on something nobody owns claims it (walk there, take); Shift-click attacks it.

## Properties words use that the engine ignores

Properties set by at least 20 words in `data/demo.json` that nothing in `shared/src` or
`server/src` reads (searched for the id as a string, plus the `dmg_`, `res_`, `immune_`,
`inflict_` and `produce_` prefixes). Not counted: `counters` (read as `set.counters`), `stealth`
and `security` (read through THEFT's `contest_with` and `contested_by`). 68 properties,
by how many words set them (minds and upkeep took `sentient`, `intelligence`, `food_need`,
`authority`, `recruit_rate`, `command_limit`, `food_output`, `nutrition`, `upkeep_power`,
`upkeep_fuel` and `aggression` off this list):

  `speech` 229, `footprint` 143, `loudness` 139, `value` 118, `faction` 115, `flammability` 109,
  `diet` 108, `reputation` 107, `hardness` 102, `enterable` 102, `read_properties` 102,
  `occupants` 93, `claim_radius` 90, `storage_letters` 86, `labor` 86, `alarm` 85,
  `bind_penalty` 80, `trade_bonus` 77, `map_reveal` 77, `binds` 76, `beauty` 73, `blocks` 72,
  `movement_cost` 71, `cover` 69, `storage_objects` 68, `needs_foundation` 61,
  `lockable` 59, `craft_slots` 53, `density` 53, `shape` 49, `targets` 48, `state` 48,
  `placeable_on` 47, `build_speed` 47, `read_inventory` 47, `survives_death` 46,
  `grants_adjective_slots` 43, `detect_letters` 43, `grants_slots_to` 41, `seats` 39, `odor` 38,
  `color` 38, `attack_area` 37, `self_propelled` 36, `depth` 36, `camouflage` 34, `moisture` 34,
  `carry_capacity` 32, `temperature_delta` 32, `prevents_death` 31, `fertility` 30,
  `detect_stealth` 30, `container_slots` 29, `terrain_ignored` 28, `knockback` 28, `negates` 27,
  `water_output` 26, `copies` 24, `brittleness` 23, `reproduction` 23,
  `locks` 23, `conductivity` 22, `harvest_sources` 22, `teleport_range` 22, `burn_time` 21,
  `tamable` 20, `growth_time` 20, `elevation` 20

## High priority

- [x] Letter economy part 2 (PLAN.md): producers need their conditions (shared `produce.ts`).
      Every `produce_*` value now comes from `tools/producers.txt` by the plan's table (A crops,
      I livestock, P flora, W mills, M machines, C stations, B furniture, N labour, Y age; O, G, U
      wells, mines, fungus); `production_needs` says what each needs: tilled land (HOE, PLOUGH,
      FARM till it: `tile_type=tilled`), moisture, someone working it, wind, running water, a
      claim, a harvest cycle, running down, vowels or a letter used up. Nothing works near a fight;
      the hungry and the unpowered make nothing; crops and flora wear out the soil. Plan words
      added: HOE, PLOUGH, OX, GOAT, HEN, HEDGE, AIDE, KILN, PRESS, WINDMILL, ANVIL, WORKBENCH...
- [x] Letter economy part 3 (shared `territory.ts`): L per tile of land you alone hold (claims;
      contested where claims meet; claims tire), R per road tile you laid (LANE, ROAD, HIGHWAY lay
      a run the way you face; roads wear; map roads in your claim count at half), S per citizen of a
      city you rule (claim its middle, or CONQUEST, COUP, ELECTION, REVOLUTION; citizens leave a
      ruled city, faster while fighting goes on there; killing one is a K), N from workers hired at
      markets (a citizen leaves its city) who work their master's fields, stations and harvests,
      T per trade (a trade screen on T: market, hiring, transmuting, offers to players with
      accept, counter and decline; typed shortcuts kept), Z from three roaming bosses (data:
      wild-hearted creatures of 2,000 to 20,000 integrity) and transmuting ten common letters.
      Producers make letters while they belong to you, carried too; the HUD lists your income
- [x] Starting kits (PLAN.md "Starting kits", shared `kits.ts`, `data/kits.json`): pick one of
      three at round start: a job (100, worn as shared properties), a building at your spawn (100),
      a sealed legendary (16, each with an unlock condition and a counter-word, unsealed with a
      map-wide call and spelled free once) and eight letters leaning toward the job
- [ ] Starting kits: once the professions theme is merged, rebuild `data/kits.json` so the derived
      jobs come from its profession words; drop the 18 profession lines copied into
      `tools/demo_words.txt` if the theme's own are better; tune perks from playtests
- [ ] Starting kits: EXCALIBUR (WordNet knows it only as a name, and a weapon has no counter-word
      mechanic yet); legendaries bots aim at their counters; show other people's jobs
- [ ] Letter economy: tune rates from playtests (pacing table in the part 3 pull request)
- [ ] Replace the live "xxx" shortcut (999 of every letter, `CHEAT` in `WorldRoom.ts`) with a
      real debug server (its own app or a password), then take the shortcut off the live game.

- [x] Dictionary themes: broad concepts of a few hundred words each, built through shared
      systems. Batch 1 is done (1, 2, 8, 11, 15; README "Dictionary themes"): about 2,200 words,
      the core of each hand-written in demo_words.txt, the rest generated from it
      (`tools/themes/check.py` checks a generated theme file). Still to do for batch 1: worker art beyond the
      commonest, plants spreading on their own (`spread_rate`), cover from trees.
      Batch 2 is done (3, 4, 5, 6, 7): about 1,900 words through shared `home.ts` (comfort,
      storage and hoards, lockups), `craft.ts` (stations craft HANDMADE things out of carried
      materials), `tech.ts` (watching things on the minimap, automation) and `herd.ts`
      (breeding). Still to do for batch 2: food stored cold (a FRIDGE or CELLAR slowing rot), a
      power grid with reach (wires, pylons) instead of one pooled store, weather shelter indoors,
      per-word art for the generated buildings and animals.
      Batch 3 is done (9, 10, 12, 13, 14): about 1,900 words through shared `body.ts` (grafts:
      capabilities, extra hands, costs, severing), `wear.ts` (worn things lend, air temperature
      and cold or heat, disguise), `disease.ts` (the sick status, contagion between bodies,
      immunity, quarantine), `emotion.ts` (rage, charm wins creatures over, temper) and
      `sound.ts` (noise on threat arrows, deafness). Still to do for batch 3: bots dressing for
      the cold and using disguises, a disguised person's name tag showing their disguise to
      others, stealth hiding people from view (only theft reads it), shelter from cold indoors,
      per-word art for the generated body parts, clothes and instruments.
      Batch 4 is done (16 to 20): about 1,900 words through shared `money.ts` (pays, bribes,
      the debt status, foreclosure, bank interest), `crime.ts` (hidden traps that spring),
      `signal.ts` (the expose status, reading what someone holds, decoys on threat arrows and
      minimaps, jamming), `faith.ts` (faith as a store, miracles' faith cost, altars' offerings,
      bless and curse statuses on letters earned) and `weather.ts` (weather lays snow, floods,
      dries water and melts snow in patches). Still to do for batch 4: bots using money,
      traps, lies and faith; a player's own view of decoys as fakes once seen through; selling
      objects at markets for their `value`; jamming watching things (cameras) of the jammed;
      per-word art for the generated words.
      1. [x] Professions: hired NPC workers producing N; farm, guard, build, scout
      2. [x] Plants and botany: crops, trees, herbs, fungi; P and A; medicine and poison
      3. [x] Buildings and rooms: claims, shelter, storage, production
      4. [x] Furniture and household: B, comfort, base morale
      5. [x] Tools and crafting: crafting stations for C; turn materials into objects
      6. [x] Machines and technology: power, M, map reveal, automation
      7. [x] Animals by family: livestock, pets, predators, birds, fish; hunting, I, mounts, food
      8. [x] Food and cooking: food store, temporary boosts, cures, poisons
      9. [x] Body parts: graft wings, claws, eyes, horns onto yourself or creatures
      10. [x] Clothing: warmth, disguise, stealth, faction look
      11. [x] Materials and elements: adjectives that rewrite any object (GLASS SWORD, IRON DOG);
          inputs to transmutation for Z
      12. [x] Disease and medicine: spreading plagues, cures, hospitals
      13. [x] Emotions and mental states: fields that move morale, loyalty, aggression
      14. [x] Music and sound: morale, charm animals, give away position, deafen
      15. [x] Law and government: tax, ban, curfew, election, treaty; map or regional rules
      16. [x] Money and trade: prices, T, bribes, debt, auctions
      17. [x] Crime and deception: theft, disguise, traps, false information
      18. [x] Communication and information: see and fake what others know
      19. [x] Religion and myth: sacrifice for F, blessings, curses, faith as a store
      20. [x] Weather, climate and seasons: drive letter yields and terrain
      21. [x] Time: speed up or slow things, ageing gives Y
      22. [x] Space and astronomy: eclipses, comets, gravity; map-wide events
      23. [x] Sea and ships: naval travel, fishing for O, storms, ports
      24. [x] Sports and games: duels, races, wagers; low-risk challenges with stakes
      25. [x] Abstract ideas: truth, chaos, luck, fate, nothing; meta words that bend rules (batch 5:
          about 1,500 words; README "Dictionary themes"). All 25 done

- [x] Before the next art pass: research external tools that make per-word art faster and
      cheaper than writing it with Claude (image generation pipelines, pixel/paper-style
      generators, local models, asset packs). Art must scale to a few hundred thousand words,
      each with its own look; not base shapes per kind with modifiers on top
      (`docs/ART_TOOLS.md`: self-hosted Z-Image-Turbo + style LoRA, cut-out, palette snap,
      optional trace to `Silhouette`; ~$10-20 for 3,000 words, ~$300-450 for 300,000)
- [ ] Run the 50-word art pilot in `docs/ART_TOOLS.md` and pick the route and raster vs vector
- [x] Tooltips that show random words and how each one changes properties, to teach the game
      (shared `tips.ts`: word cards on the start screen, one tip in the idle spell window, word
      ideas in the Esc menu with a reroll; tips can be turned off in the menu)
- [ ] Tiered winners' rounds (for later, high importance): a round winner goes into a round of
      100 against 99 other winners; winners of those eventually join a round of 10,000 against
      other winners of rounds of 100. Each tier won earns a distinct avatar look (gold,
      diamond, and so on)
- [x] Dedicated loadout and inventory screens (L and I)
- [x] Loadout and inventory on a controller; item details (what a thing does) on hover or select

## Later: words drive every system (user's notes; not started)

Each word below is an example: build a whole dictionary around each concept, and search the
lexicon so every related word is captured.

- [ ] Brainstorm a few hundred cool systems, then search the dictionary for each one's words
- [ ] Every system and power has an opposing system and power
- [ ] Every mechanic is modifiable by words: player total HP, anything, maybe even graphics
- [ ] Meta words: TYPO makes something break (done in themes batch 5: `misspells` turns a thing
      into the word one letter off, or breaks it); DICTIONARY gives a full list of words (open)
- [ ] FAILED, BROKEN, PATHETIC, COWARDLY do what they say
- [ ] INVISIBLE does what it says
- [ ] Tiny things have uses (TINY and related adjectives, bugs, swirls): high stealth, slipping
      through defences, higher speed
- [ ] Decide what drives magic: intelligence, or something else
- [ ] OPEN opens doors, locks and walls; GONE, DEAD, BROKEN act on targets
- [ ] FAR moves something far away; abilities to place objects further than normal; teleporting
- [ ] Water, air and land vehicles
- [ ] THIRSTY and HUNGRY raise food needs, and fuel needs for vehicles
- [x] Technology has a purpose: COMPUTER, MONITOR, CAMERA and the like (themes batch 2: things that
      watch show their ground on your minimap; machines with labour work your producers)
- [ ] Ways to see more of the map: wider sight, or a zoomed-out view of the map
- [ ] Scales such as good and evil, smart and dumb, that words move players and things along
- [ ] Name ideas (both potential titles): a new word for war; "them's fighting words"
- [ ] Brainstorm alternative game modes
- [ ] Word idea: AI. AI and GENIE need something special of their own
- [ ] A lexicon of extremely powerful words: CTHULHU, GOLEM, BEAST, QUETZALCOATL and the like
      (mythic beings, legendary creatures, cosmic horrors), with matching counter-words
- [ ] WORD lets you substitute it into any other four-letter word; LETTER, BOOK and similar
      words do the same for their own length or kind

## Data

- [x] Odd producers in generated data: JOHN (a toilet) makes J, ARMY-like collectives make K.
      Only producers.txt sets `produce_*`; a generated word's `produce_*` additions are dropped
      (build_demo.py, listed in generated_problems.txt) and the prompt says so
- [x] Common nouns whose main sense the class misses (scan of the 2,000 commonest): ACT (a law),
      PROCESS (work goes faster), ISSUE (a dispute that confuses), DATE (charms), FALL (the
      season), STORY and STUDY (books), WON and SENT (verbs: overrides may now give a role
      WordNet lacks), TECHNICAL (an adjective). LEAD stays the metal the materials theme needs
      ZONE (a generated law against fighting over 200 m that never ended; bot rounds stalled in
      it) lasts five minutes and ANARCHY ends it
- [x] Kits report outliers: GARAGE healed its side 20 a second and HOSPITAL 50 (now none and 6;
      TEMPLE 2, SHRINE 3); derived jobs dermatologist, oncologist, quarterback and near-duplicates
      skipped for 16 hand-tuned trades (chef, tailor, potter, weaver, brewer, butcher, innkeeper,
      healer, monk, archer, mercenary, gardener, beekeeper, trapper, navigator, banker)

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
- [x] Pick an art style from the prototypes (client/styles.html): 4, Paper Diorama, now drawn
      in the game (client/src/art: terrain sheets, standees, per-word shapes in shapes.ts)
- [ ] Expand per-word art beyond the most common words, toward a shape for every word

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
- [ ] Map scales with player count (user wants to get a feel first; don't action yet)
- [ ] Minimap only through words (MAP, TELESCOPE, SPY, CAMERA...); no default minimap
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
- [x] Controller input: movement, and spelling by picking from held letters
- [ ] Spelled objects only sit on the ground; no equipping, placement rules or effects yet
- [x] Starting hand: eight letters drawn around a word that produces a letter the actions do not
      give (DOG, FARM, MILL, LANE...); no free SWORD
- [x] M4: gathering by hand, letter production from objects, giving letters to a nearby player
- [x] Letter economy part 1 (PLAN.md): the action letters. Gathering finds E anywhere, O by
      water, G in hills and at mountain feet, U by mountains, from 8-tile patches that run out and
      grow back slowly; H from hunting wild animals (30 a map), D from destroying (and X from 10
      broken ruins), K from killing people (V and K for someone's creature, H for a wild one),
      J from each new 32-tile region, X from 12 buried caches, Q from the one temple, T from
      trading at a market in every city (`trade eee for o`: 3 for 1, plus a T); F when fire
      destroys a thing, V from beating another player's things. A reachability check (shared
      `reachTable`) runs with the tests and prints the shortest chain to every letter
- [x] Spawns: people start at least 60 tiles apart where the map allows, out of cities
- [x] Bots keep the peace for 60 to 90 s, spell at most once every 5 to 10 s, build producers
      first, use the action sources, and only go for people within twice their sight
- [x] Trading is a typed command (give player2 abc); needs a real interface and two-way offers
      (letter economy part 3: the trade screen, T)
- [x] M5 (part): equipping, picking up and dropping, attacking players, death and knockout,
      last one alive wins
- [x] M5: terrain words reshape the map; things on the ground can be attacked and destroyed;
      D, K and V now have sources (destroying things, kills, beating another player's things)
- [x] M5: verbs act on the caster for their duration (RUN, FLY, HEAL, SNEAK, HIDE); THEFT takes a
      selected thing if your stealth meets its security; sky words set day, night and weather
- [x] Anything spelled that moves, is not ridden and is alive, sentient or self-propelled follows
      you: GHOST, ZOMBIE and ROBOT now fight for you and need no food (a ROBOT draws power)
- [x] M5: creatures you spell follow you, defend you and fight what you fight; ones you can
      ride are mounts instead; they outlive their master, ownerless
- [x] Events act through their properties: MURDER, RAID, REPAIR, RESCUE, TRADE, REVOLT, AMBUSH,
      and areas that damage or turn hostile (FIRE, WAR, EARTHQUAKE, FAMINE); WAR triples K
- [x] SIEGE: the besieged cannot trade or gather, and soldiers rally to the besieger
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
- [x] Places (shared `place.ts`): any area's `produce_*` and `harvest_bonus` operations act on
      letters earned inside (gathered, produced, kills, deeds, trades), plus `growth`,
      `deposit_factor`, `tax_rate`, `lode`, `trade_rate`, `law` and `summons`; 25 concepts built on
      them (README "Areas, places and concepts"). WAR's K ×3 is now one of these
- [x] Event chips at the top middle: weather, night and every zone you stand in, with time left;
      a click shows what it changes (shared `eventCard`) and the words that end it
- [ ] Places still to do: `tax_rate` and `law` on an object's claim
- [x] A law covers an area's harm as it covers a blow: damage, statuses and contagion from any
      area (FIRE inside a SANCTUARY, a TRUCE), the area's own law too, and events landing on a
      person (MURDER, ARREST) where a law stands; bots use the concept words on purpose
- [ ] Sky and weather change sight, speed, growth and letter yields so far; their other effects (wetness, growth,
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
- [x] Right-click picking on a controller (LT inspects, LB/RB cycle)
- [ ] Terrain is laid where the speller stands and pushes everyone to the nearest ground; a
      destroyed lake or mountain marker cannot be removed, and terrain cannot be undone
- [x] Rounds end: the room locks, everyone sees who won with a countdown, then all clients
      join a fresh room with a new map. The dead watch until then
- [ ] Waiting for players: a round starts as soon as one person joins, and anyone can join
      mid-round until it ends
- [ ] Labels of adjacent players overlap; fix in the art pass
- [x] M6 (part): bots that play (gather, spell, fight) in the load test
- [x] Server-side bots (`server/src/bots.ts`): people with no client who gather, spell useful
      words (weapons, armour, mounts, creatures, then verbs, fields and events), eat, fight and
      roam between cities; easy, normal and hard. Start screen: Play with bots, or join friends
- [x] Bots play every system (easy, normal, hard by `SKILL`): market trades, hiring, offers made
      and answered, picking up and claiming, adjective phrases and plurals, adjectives on foes and
      their own gear, aimed fields and events, area words by their place rules (plenty, taxes,
      laws, war, refuges, weather), roads, taking cities, crop land, cooking, counter-words to
      areas, weather and creatures, running when badly hurt; kits picked by difficulty, working
      toward their legendary's unlock, spelling it, countering enemies' legendaries. `loadtest/tournament.ts` reports it
- [ ] Bots still to do: use terrain words on purpose, form pacts
- [x] Carried or following things whose field forbids fighting (GAVEL, JUDGE, REFEREE, PEACEKEEPER):
      ruled in themes batch 5 (shared sport.ts): `peace` gives whoever takes one a `truce` status
      once, for 90 to 180 s (untouchable, cannot strike or spell); PROVOCATION and TAUNT end it
      (effect_status=truce); the same thing never gives a second truce, so bots need not put it down
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
