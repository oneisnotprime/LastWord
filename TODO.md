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
- Desktop only: keyboard and mouse, or a controller. No touch or phone layout.
- On a controller, spelling is done by picking from the letters you hold.
- All assets and word data are generated ahead of time; no model at runtime.
- Every word feeds the same shared systems (PLAN.md); no private mechanics per word.
- The game lives in its own repository.

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

- [ ] Confirm: an attack absolute cancels INDESTRUCTIBLE and absolute resistances, but things whose
      own integrity is absolute (mountain, sun, god) still cannot be damaged
- [ ] Equipment: how a held weapon, worn armor and grafts combine with the character's own stats
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
- [ ] Repeat the load test once objects exist (thousands of entities in the state)
- [ ] Path-finding: walkers stop at water and mountains instead of going around
- [ ] M3 to M7 in PLAN.md
- [ ] Map generator: cities, countryside, letter sources
- [ ] Demo: one map, the 351-word dictionary, a handful of players
