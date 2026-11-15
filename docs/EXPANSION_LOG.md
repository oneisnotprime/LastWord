# Dictionary expansion log

Each batch adds themes the 25 dictionary themes and the existing words do not cover well, through
the pipeline in README.md (core words in `tools/demo_words.txt`, the rest as theme files merged
into `tools/generated_words.txt`, letters in `tools/producers.txt`). Art is drawn by hand in
`client/src/art/shapes.ts`, no paid image API.

## Batch 1: bugs, grubs and swarms; stone and ore

- Themes: 26 bugs, grubs and swarms (179 words: flies, beetles, sap-suckers, moths and their
  caterpillars, worms and parasites, many-legged things, bug works and bug killers); 27 stone and
  ore (245 words: rocks, minerals, gems, ores, landforms, workings and diggers). 424 words in all;
  the dictionary is now 12,054 words.
- New shared rules: `bug.ts` growing up (`matures_into`: a swarm of MAGGOTS becomes a swarm of
  BLOWFLIES, METAMORPHOSIS and CENTURY hurry it) and boring (`bores`: TERMITES eat a wooden HOUSE
  from inside, a STONE HOUSE is safe; SHIPWORMS sink wooden hulls); food.ts `heatNeeded` (ores are
  raw with a `smelts_at`: HEMATITE becomes IRON by a FORGE, not a CAMPFIRE, then an ANVIL makes an
  IRON SWORD). Existing words gained the rules: LARVA, MAGGOT, GRUB, PUPA, CHRYSALIS, CATERPILLAR,
  TADPOLE grow up; TERMITE and MOTH bore; ORE, HEMATITE, MAGNETITE, MALACHITE, GALENA, CINNABAR and
  BAUXITE smelt.
- Interactions through existing systems: radioactive ores (PITCHBLENDE, URANINITE) are fields that
  sicken everyone near, holder too, against LEAD and BARITE; landforms stamp terrain (GORGE, MESA,
  SCREE, SANDBAR over water, CALDERA lava); SINKHOLE, GEYSER and STALACTITE strike a spot;
  QUICKSAND, FLYPAPER and ANTLION are hidden traps; pollinators and sap-suckers move crop yields;
  bots spell borers beside enemies' wooden things (`borer`).
- Drawn: every new creature and object. The `bug` builder gained fly, moth, beetle, mantis, worm
  and centipede kinds; new lumps (rock, ore, cut gem, crystal cluster, mica sheet, pebbles, geode,
  stalagmite) and bug works (cocoon, anthill, honeycomb, spray, swatter). Events, verbs and
  landforms keep their badges.
- Display: cards and the best-words strip show damage and HP felt (shared `shown`: NUKE 27k dmg,
  not 7.5M); a claim's tag hangs at the south rim of its ground, clear of its building's bar.

## Batch 2: medieval siege and arms; mythic beasts and prehistoric giants

- Themes: 28 medieval siege and arms (128 words: siege engines, polearms, swords, maces, early guns,
  armour by slot, fortifications, door guards, the soldiers and smiths, siege acts); 29 mythic beasts
  and prehistoric giants (152 words: about 70 myth beasts, 75 dinosaurs, sea reptiles and megafauna,
  young birds and beasts, the slayers and counter-words). About 280 words; the dictionary is now
  12,334 words. Existing words gained rules: EGG hatches into a CHICK that grows into a HEN,
  HATCHLING grows into a DINOSAUR; MIRROR, SILVER, MONGOOSE, ROOSTER, BRIDLE and METEOR counter the
  new beasts; RAM is now held (it was 600 kg with no slot, so nobody could carry it to a door).
- New shared rules: interior.ts door guards (a PORTCULLIS or DRAWBRIDGE put down in or beside your
  walk-in building adds its integrity to the door and bolts it against what it counters: a RAM or a
  KEY no longer opens it at a touch; a PETARD, which counters the guard, still does, and the guard
  breaks with the door); breaching events (BREACH, ESCALADE, UNDERMINING: `counters` door, aimed at a
  building, break the doors in their reach); bug.ts hatching (a thing that `matures_into` a creature
  hatches where it lies or is carried: this also fixed COCOON, PUPA and CHRYSALIS, which cannot move
  and so never grew up); borers reach a walk-in building from its wall, not its middle.
- Interactions through existing systems: siege engines are mountable weapons with `siege` and long
  reach (a ridden TREBUCHET breaks a HOUSE's door from 20 tiles); MACHICOLATION is a damaging field
  at its foot, CRENELLATION and ARROWSLIT cover fields for their side; SALLY and SORTIE haste their
  side and end a SIEGE; COUNTERMINE wipes out sappers. Beast counters go through `exterminate`
  (EXTINCTION wipes out dinosaurs and hatchlings for 100 tiles); dinosaurs have `temp_min` so
  WINTER and BLIZZARD hurt them; grown beasts that go hungry turn wild.
- Drawn: every new concrete word. New builders `engine` (trebuchet, catapult, ballista, tower, ram,
  gun), `dino` (eleven body plans) and `polearm`; myth beasts are built from quad, biped, bird, snake
  and dragon with wings, beaks, horns, stingers and extra heads.
- Bots (finding): batch 1's `borer` never fired because a bot had to stand within 2.5 tiles of an
  enemy's thing made of what its borer eats, and in a tournament the enemy things bots see are mostly
  brick, rubber or steel (wood 23 of 450 sightings) while wood-borer words (TERMITE, WOODWORM) are
  rarely affordable: the watched new words could each be spelled from about 1 to 5% of racks. Fixes,
  by word data only: borers are chosen for any enemy thing in sight (then the bot goes for it and its
  borers follow), a target it cannot yet afford a word for becomes what it trades toward (`wants`);
  `siege` and `guard` uses; young beasts score by what they grow into; a bot gives up a door it
  cannot dent. Tournament (8 rooms, 8 mixed bots, 30 min cap, same seeds), before and after: growing
  up 0 -> 29 (mostly easy bots' EGGs), new words spelled 35 of 973 spellings -> 50 of 792, raids
  6 -> 3 (fewer hopeless doors), siege 0 -> 0 (1 in a 4-room run), borer 0 -> 0. Siege and borers stay rare for the same reason: few enemy walk-in or
  wooden buildings in sight when a bot is not fighting, and long words with rare letters.

## Batch 3: traps and dungeons; heraldry, courts and fealty

- Themes: 30 traps and dungeons (69 words: re-arming and capturing traps, restraints and torture
  passed on a person, small lockups, earthworks, gaolers and prisoners, breakouts); 31 heraldry,
  courts and fealty (79 words: oaths and fealty pacts, betrayals, court sentences and laws, a
  challenge, knighthood, banners and charges, nobles, vassals and rebels, heraldic adjectives). 148
  words in all; the dictionary is now 12,481 words. Existing words gained rules: SNARE is now a trap
  (it had no trigger); DISARM breaks the new traps; REBELLION and REVOLUTION end fealty pacts; VETO,
  REPEAL and REVOLUTION end UKASE, INTERDICT and ASSIZE.
- New shared rules: crime.ts `rearms` (a trap with no `single_use` stays set and re-arms 20 s after
  it springs, shown to everyone meanwhile: MANTRAP, MINEFIELD, BARBWIRE, CRUSHER, QUICKSAND) and
  `capturesInto` (new property `captures`: a sprung MANTRAP or CHUTE, or INCARCERATION, INTERNMENT,
  CAPTIVITY, REMAND passed on a person, drops the victim into its owner's nearest walk-in lockup
  within 40 tiles); interior.ts `holds` (a walk-in lockup, home.ts `holdFactor`, keeps enemies inside
  until its door is broken, and their blows from inside land on the door; a KEY or a LIBERATOR still
  opens it at a touch, JAILBREAK and BREAKOUT break it round their speller). law.ts `tribute` (a pact
  word with `tax_rate` makes its speller the liege: FEALTY 30%, VILLEINAGE 40%, FEUDALISM binds six
  at 15%; every letter the others earn, a city's S included, pays the liege its share) and `endsPact`
  (a word whose `counters` names the pact's word frees its speller with no penalty: BETRAYAL,
  TREACHERY, PERFIDY, REBELLION, USURPATION). Attacking a member still breaks a pact with its penalty.
- Interactions through existing systems: a CHALLENGE is a duel with stakes; KNIGHTHOOD summons four
  knights; USURP and USURPATION take a city; ATTAINDER, OUTLAWRY and AMERCEMENT fine, expose and curse
  through events on a person; INTERDICT, UKASE and ASSIZE are laws over an area; DISLOYALTY buys a
  creature against its loyalty; nobles carry their own levy; PANOPTICON sees through walls.
- Drawn: every new concrete word. New shapes: steel jaws, wire on posts, a minefield, an abatis, a
  crusher in its frame, a trapdoor, cuffs, a garrote, a scourge, a thumbscrew, a muzzle, a blindfold,
  a straitjacket, a gibbet, stone lockups with barred windows, earthworks, a foxhole, a maze, a sewer's
  mouth, a hooded headsman with his axe, striped prisoners, banners with a charge (BLAZON, ORIFLAMME,
  TRICOLOR, SALTIRE, ROUNDEL, QUARTERING), a sceptre, a dais and nobles; rosettes for oaths, betrayals
  and breakouts.
- Bots: `antiair` (weapons and creatures whose blows reach the air, armed mounts that fly): a bot with
  a flyer coming for it, or one of the last left, that it cannot strike spells anti-air first, saves
  up for it, and gets off a mount whose guns cannot reach the flyer to use what it carries; a bot with
  anti-air now sees flyers as foes (before, every bot on the ground ignored them). `target` (the
  general affordability change): a bot keeps one word it is two or three letters short of (anti-air
  first, then a theme word it wants, a weapon if unarmed, armour, a creature, a mount, a producer) for
  up to two minutes, walks to the nearest market to trade for its missing letters, keeps the letters it
  needs out of trades, and spells it first once it can. `fealty` and `rebel` (a vassal ends its pact
  with a counter-word), `held` and `breakout` (a captured bot breaks out or batters the door).
- Stalemates (TODO): the time-up rounds had four causes, none of them the rules leaving no answer:
  bots on the ground ignored flyers; easy or unarmed bots never sought anyone out; a bot standing in
  its own walk-in building dropped a foe outside instead of walking out to it; and a far beast's fear
  aura (CERBERUS saw 600 m, PTERODACTYL 2 km) broke every bot's nerve for the rest of the round, so
  they stood frozen. Fixes: anti-air above; the endgame (with two left, or after 25 minutes, every
  bot fights whoever it finds and goes after the nearest person, breaking the door if they hide
  indoors, past any disguise); a bot indoors walks out after its foe; a bot with broken nerve and
  nothing near to run from goes on thinking; and by data, the three beasts' sight is 100 to 200 m.
- Tournament (32 rooms, 8 mixed bots, 30 min cap, same seeds, batch 3 dictionary; main's bots against
  this batch's): rounds that hit the time cap 4 -> 0; mean round 13.3 -> 8.0 min; anti-air spelled
  0 -> 159 times; words saved up for and spelled 24. Watched words (batches 1 to 3, 846) spelled:
  172 of 4,519 spellings (3.8%) -> 103 of 3,448 (3.0%); a paired run without saving up gave 146 of
  3,737 (3.9%) with the same bots otherwise. Saving up did not lift the share of long new words: bots
  mostly save for armour, weapons and producers, which they spell a few seconds sooner, and the share
  of racks that can spell a watched word is about 1% in rounds that are now half as long (4.5% before,
  inflated by the time-up rounds' big racks). Traps sprang once; fealty was sworn 2 to 3 times a
  tournament; no bot was captured (they rarely own a lockup and a capturing trap together).

## Frequency batch 1: the most common words that had no data

- The gap (`tools/freq_gap.py`: wordfreq's English ranking; a dictionary headword in lexicon.tsv or
  inert.tsv with no data in demo.json; function words, names, proper nouns, words WordNet only
  knows capitalized, crude words and `EXCLUDED` left out; plurals and degrees of a word with data
  count as implemented). Before, by part of speech:

  | wordfreq top | missing | nouns | verbs | adjectives | adverbs |
  |---|---|---|---|---|---|
  | 10,000 | 1,668 | 782 | 212 | 573 | 101 |
  | 20,000 | 4,694 | 2,262 | 477 | 1,664 | 291 |
  | 30,000 | 7,526 | 3,609 | 729 | 2,700 | 488 |

  After this batch: top 10k 613 (282 n, 67 v, 234 adj, 30 adv), top 20k 3,639 (1,762, 332, 1,325,
  220), top 30k 6,471 (3,109, 584, 2,361, 417).
- Added 1,056 words, every missing word down to wordfreq rank about 7,800 (YEAR, NIGHT, BELIEVE,
  REMEMBER, QUESTION, HEALTH... to EXPLICIT, CONTINENTAL): 498 nouns, 341 adjectives, 146 verbs, 71
  adverbs; the dictionary is now 13,537 words. Twelve core words are hand-written in demo_words.txt
  (YEAR, NIGHT, MORNING, ANIMAL, KNOWLEDGE, HEALTH, QUESTION, FREEDOM, BELIEVE, REMEMBER, LEARN,
  UNDERSTAND); the rest went through chunk files and `generate_words.py merge`. New producers: hired
  people pay N (DEVELOPER, CONTRACTOR, WORKFORCE...), FARMING lays a crop field, a MANUFACTURER makes
  M, a WORKPLACE C.
- How abstract words act, through shared systems only: time words set daylight (NIGHT, MORNING,
  EVENING, AFTERNOON, NOON: map-wide, and day and night end each other) or stretch durations
  (YEAR, WEEK, ERA, SEMESTER, as HOUR does); an act aimed at someone is an event (QUESTION confuses
  and reads them, THREAT frightens, INFECTION sickens and spreads, POEM charms, LITIGATION and
  SUBSCRIPTION put debt on them, BOMBING drops impacts, FLOODING lays water, OCCUPATION claims ground
  and forbids gathering); states, feelings and ideas are fields (KNOWLEDGE, FREEDOM ends root, stun
  and charm; STRESS, POVERTY, IGNORANCE, CULT charms enemies, TENSION sets everyone hostile, CLIMATE);
  RELATIONSHIP, FRIENDSHIP, PROPOSAL, MERGER are pacts; verbs are cast on the speller (SURVIVE
  cheats death once, DISAPPEAR, PREDICT, SHOUT deafens, ATTRACT pulls, ADOPT takes a creature);
  adjectives are operations (OVERWHELMING doubles, MIGHTY, BRUTAL, EXPLOSIVE, MICRO, ABSENT phases out,
  TRANSPARENT, UNLIMITED) and number words are counts (FORTY, FIFTEEN, ELEVEN); adverbs bend verbs
  (REPEATEDLY duplicates, UTTERLY and DESPERATELY ×2 to ×2.5 with self-harm, SIMULTANEOUSLY, PRIVATELY).
  Each lasting area has an ender: the polish2 test passes. No new word seals a fate (polish test:
  ten at most).
- Pitfalls for the next batch: a noun's archetype decides how it acts (`phrase.ts` `kindOf`). An
  event aimed at someone in a non-event archetype (knowledge, attribute, document, place) is parsed
  as an object or a field and its event properties do nothing; a field in a non-event archetype
  uses `field_duration` (none lasts for ever), not `event_duration`. Abstract "documents" (SPEECH,
  MYTH, SOFTWARE) belong in knowledge, or they become paper objects. `counters` is read backwards:
  W ends L when W's counters name L.
- Data audit (batch 3's CERBERUS and PTERODACTYL): objects and creatures whose aura or field
  reached most of the 1 km map, now local: HELL (fear and fire field 500 m -> 120), FLOOD (500 ->
  200), RAINFOREST (400 -> 160), CREATOR and GODDESS's healing fields (500 and 300 -> 60), CARILLON,
  BELFRY, MINARET (400, 400, 300 -> 80), FLAGSHIP (400 -> 60), the map-wide fields of NEWSPAPER,
  PUBLICATION, MAGAZINE, INTERNET, PUBLISHER, NEWSCASTER (40 to 80 m), LIFEGUARD and LIFESAVER's
  healing by sight (200 -> 100 m). `freq1.test.ts` fails if any object or creature radiates fear,
  healing or a field past 200 m (weather and sky words excepted).
- Drawn: a WORDS shape for each of the 131 new concrete words without a generated image (people as
  bipeds by what they do, crowds for INFANTRY and WORKFORCE, a ceiling, plug, gas cylinder, doll,
  skirt, picture, radiator, grave, pipeline, cart, drain; landforms as signs), checked in the gallery.
- Tournament (48 rooms, 8 mixed bots, 30 min cap, same seeds; main against this batch): mean round
  10.6 -> 8.3 min; median first death 130 -> 131 s; rounds at the time cap 2 -> 1 (each time two bots
  left riding vehicles with no foe in sight: TODO). Bots spelled new words 138 times (41 different;
  CAB 59, MYTH 8, PAL 7, ALLY 7), from about 1.3% of racks.
- Remaining: `tools/freq_todo.txt` (3,000 words, rank order) starts at CONSIST (rank 7,781), OVERHEAD,
  PIERCE, PRONE, READILY, REFLECTING, REGIMENT, REUNION. Left out on purpose and not counted: names
  WordNet also lists lower-case (`freq_gap.py` NAMES), inflections it misreads (NOT_WORDS: LIED,
  SHOOK...), crude words added to tools/crude.txt (BULLSHIT, SHITTY...), and words about groups of
  people or sexual violence added to `EXCLUDED` (WELSH, INDIGENOUS, LESBIAN, IMMIGRANT, SLAVERY...).

## Frequency batch 2: the next thousand most common words

- Added 1,149 words, every missing word from wordfreq rank 7,781 to 11,916 (CONSIST, OVERHEAD,
  PIERCE, PRONE, READILY... to MATERNITY, MISCONDUCT): 523 nouns, 440 adjectives, 120 verbs, 66
  adverbs; the dictionary is now 14,686 words. Twelve core words are hand-written in demo_words.txt
  (AIRPLANE, BOMBER, PICKUP, SHOTGUN, REGIMENT, PIERCE, EXPLODE, DAYTIME, HARMLESS, AIRBORNE,
  PROSPERITY, REDEMPTION); the rest went through chunk files and `generate_words.py merge`. New
  producers: hired hands pay N (RESEARCHER, SUPPLIER, APPRENTICE, a TEMP while his lifespan lasts),
  a RIG and an AUTOMATION make M, an APPARATUS and SEWING are stations (C), SEATING is furniture
  (B), a RESERVOIR and a BROOK give O, VEGETATION P.
- Gap after this batch (`tools/freq_gap.py`): top 10k 0 (was 613), top 20k 2,439 (1,188 n, 211 v,
  886 adj, 154 adv; was 3,639), top 30k 5,270 (2,534, 463, 1,922, 351; was 6,471).
- Left out on purpose and not counted: names WordNet also lists lower-case (JENNY, MOLLY, DONNA,
  TUCKER, MAXWELL, SURREY's neighbours SILVA and DELL...: `freq_gap.py` NAMES), inflections and
  foreign words it misreads (DUG, TORE, PARA, MIL, DAS, SOL, COMP: NOT_WORDS), crude words added to
  tools/crude.txt (CUNT, FUCKER, RETARDED, XXX, and the anatomy VAGINA, SPERM), and words about
  groups of people, sexuality, religion's offices or atrocities added to `EXCLUDED` (HOLOCAUST,
  GHETTO, NEGRO, ORIENTAL, ABORIGINAL, MIGRANT, NATIONALITY, ETHNICITY, HOMOSEXUAL, BISEXUAL, QUEER,
  PROSTITUTION, PROTESTANT, CALIF, FASCIST, MORON).
- Notable effects, all through shared systems: military units muster where they land (REGIMENT 12
  soldiers, BRIGADE 24, BATTALION 30, LEGION 40, CAVALRY and SQUADRON cavalrymen, MILITIA rebels,
  CLERGY three priests, MANKIND and TURNOUT a wild crowd); BOOKING captures its victim into your
  lockup; REJECTION severs every graft; REDEMPTION ends doom, curses and debt; REPLAY rewinds 20 s of
  harm; VARIANT brings chaos; COMPRESSION shrinks; BANNING forbids spelling in an area, PROM and
  NEUTRALITY forbid fighting, EXCLUSION trade and spelling for enemies; TAKEOVER takes a city;
  EXPLOITATION strips the ground for a burst of G and U; DRAINAGE ends floods and swamps; HEMISPHERE
  brings night for a minute and a half and DAYTIME day for four (night and day words end each
  other); METAPHOR, ANALOGY and VERB are stand-ins (any 7- or 5-letter word, any movement verb);
  ATLAS is a minimap; PROTAGONIST cheats death once; TODDLER grows into a BOY. Counter-words by
  meaning: HARMLESS and UNARMED take a weapon's teeth, PARKED and IMPRISONED stop a ride or a
  creature, SUNK a boat, UNLOCKED a lock, STRIPPED armour, DISCHARGED anything electric, FINITE an
  indestructible thing, UNCHANGED resists chaos and shrinking, SANE confusion; AIRBORNE makes
  anything fly, AUTONOMOUS and CHARTERED drive themselves, BARRED locks a door, INSURED refunds
  letters when it breaks. Fields are short (at most 10 minutes in one place, 1.5 minutes map-wide)
  or follow their speller, so no new lasting area lacks an ender; no word seals a fate; no object
  radiates past 200 m.
- Drawn: a WORDS shape for each of the 164 new concrete words (people as bipeds by what they do, a
  ghostly DEPARTED, a green HULK, crowds for OFFSPRING and CLONE; new shapes for a sphere, a traffic
  cone, a saddle, a coil, a drawer, a sculpture, an oil rig, a robot arm, a shotgun, a quad bike,
  carriages, a stage flat, a sticker, a pixel, a runway, a pentagon; landforms as signs), checked in
  the gallery with headless Playwright.
- Stalemate (TODO: rounds at the time cap with the last two bots riding vehicles, no foe in sight):
  a ridden machine that runs out of fuel or power has speed nothing, so the endgame hunt's route
  never got anywhere. Now, late in a round (after 20 minutes, or with two left), a riding bot whose
  ride has stopped dead, or made no headway for 30 s toward where it is going, gets off and goes on
  foot (`BotMind.ride`). Scenario test (`server/src/freq2.test.ts`: the last two bots in dry CABs
  119 tiles apart, a minute of play): before, both still riding and still 119 tiles apart; after,
  both on foot and 15 tiles apart. Tournaments with this batch's dictionary did not hit the cap
  either way: 0 time-ups in 96 rooms before and after; bots got off a dead ride 9 times.
- Tournament (8 mixed bots, 30 min cap, two sets of 48 rooms: the usual seeds and `SEED_BASE=500000`,
  main's bots against this batch's): mean round 8.4 -> 8.6 min and 7.5 -> 7.5 min; median first
  death 153 s and 125 s, unchanged; rounds at the time cap 0 -> 0 (batch 1's run had 1 in 48).
- Remaining: `tools/freq_todo.txt` (3,000 words, rank order) starts at NEEDLESS (rank 11,920), NERD,
  NOVELTY, OPTIMIZATION, PINT, POOP, PREVALENCE.
