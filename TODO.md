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

## High priority

- [x] Dedicated loadout and inventory screens (L and I)
- [ ] Loadout and inventory on a controller; item details (what a thing does) on hover or select

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
- [ ] Plural rules, including irregular plurals; verb tenses
- [ ] Full property pass over the lexicon with a cheap model, using the demo set as examples
- [ ] Sanity checks on that pass: sibling ordering (pond < lake < sea < ocean), unit ranges
- [ ] Map every property to one of the shared systems; drop or merge any that touch none
- [ ] Tile-level quantities (temperature, moisture, fertility, light) so effects spread by adjacency
- [ ] Find a use for the inert bucket (states, communication, shapes, processes, days and months)
- [ ] Words that are not in WordNet (slang, new words)
- [ ] Sprite or icon per word; choose an asset pack or generation style

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
- [ ] Upkeep: food, fuel and power as the natural limit on large things
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
- [ ] Other events (WAR, FIRE, MURDER, RAID) do nothing yet
- [ ] Creatures: no pack sizes or plurals, no hunger or upkeep, no orders (stay, guard, go
      there), wild ones never act, and they do not gather or work
- [ ] A wolf kills an unarmoured person in three bites (about two seconds); review creature
      damage against the 100 integrity of a human
- [ ] Weather and night cover the whole map; region-sized weather and per-tile quantities
      (temperature, moisture, light) are not built
- [ ] Sky and weather change only sight and speed so far; their other effects (wetness, growth,
      crop output) wait on the tile systems
- [ ] Auras, knowledge, institutions and measures still spell into inert markers on the ground
- [ ] Hidden or invisible players are still drawn for others; stealth against detection is not
      used for what a client is sent
- [ ] Targeting: an event uses whatever you last clicked, which also starts an attack on it;
      needs a select-without-attacking control
- [ ] Terrain is laid where the speller stands and pushes everyone to the nearest ground; a
      destroyed lake or mountain marker cannot be removed, and terrain cannot be undone
- [x] Rounds end: the room locks, everyone sees who won with a countdown, then all clients
      join a fresh room with a new map. The dead watch until then
- [ ] Waiting for players: a round starts as soon as one person joins, and anyone can join
      mid-round until it ends
- [ ] Labels of adjacent players overlap; fix in the art pass
- [x] M6 (part): bots that play (gather, spell, fight) in the load test
- [ ] M6 (rest): public deploy; needs a host account from the user
- [x] Tick spikes: caused by many route searches in one tick; capped at 12 a tick, worst tick
      in a 5-minute playing run is now 44 ms
- [ ] M7 in PLAN.md
- [ ] Map generator: cities, countryside, letter sources
- [ ] Demo: one map, the 351-word dictionary, a handful of players
