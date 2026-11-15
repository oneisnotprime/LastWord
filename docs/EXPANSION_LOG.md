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

## Frequency batch 3: the next eleven hundred most common words

- Added 1,091 words, every missing word from wordfreq rank 11,920 to 15,808 (NEEDLESS, NERD,
  NOVELTY, OPTIMIZATION, PINT... to DISRUPTIVE, ENDLESSLY): 495 nouns, 415 adjectives, 109 verbs,
  72 adverbs; the dictionary is now 15,777 words. Twelve core words are hand-written in
  demo_words.txt (PARACHUTE, AMMO, WATERFALL, STAIRCASE, CHIMNEY, BLITZ, MELTDOWN, DEMOLITION,
  PLATOON, GIGANTIC, SUMMON, WITHSTAND); the rest went through chunk files and `generate_words.py
  merge`. New producers: hired hands pay N (APPLICANT, PLANNER, ORGANIZER, HANDLER); a gas BURNER is
  a station (C) that burns G.
- Gap after this batch (`tools/freq_gap.py`): top 10k 0, top 20k 1,268 (626 n, 99 v, 462 adj, 81
  adv; was 2,439), top 30k 4,099 (1,972, 351, 1,498, 278; was 5,270).
- Left out on purpose and not counted: names WordNet also lists lower-case (LEONE, MALIK, BENNY,
  WEBER, DEXTER, BOOKER, CHEVY, JONAH, DICKENS, WATERLOO, THATCHER, SKINNER, MERCER, COCO...:
  `freq_gap.py` NAMES), abbreviations and misread forms (VAR, DIVERS, MEG, ALA, WEN, AIN, RBI, RPM:
  NOT_WORDS), crude words added to tools/crude.txt (POOP, FART, PISSING, PRICK, DUMBASS, CRAPPY,
  ERECTION, TIT, FANNY and two slurs), and words about groups of people, religion, politics,
  sexuality or atrocities added to `EXCLUDED` (APARTHEID, CASTE, SEGREGATION, GYPSY, APACHE, NORDIC,
  BRIT, ARGENTINE, ATHEIST, PAGAN, SECT, SHARIA, JIHAD, LAMA, FASCISM, LIBERALISM, LEFTIST,
  LIBERTARIAN, SEXIST, HOMOPHOBIC, VIRGINITY, BONDAGE, PUBERTY, BIPOLAR, SCHIZOPHRENIA...).
- Notable effects, all through shared systems: BLITZ drops a dozen bombs on a region; MELTDOWN
  burns, irradiates and lays lava (CONTAINMENT ends it); DEMOLITION, SMASHING and OVERLOAD destroy a
  building, a thing or a machine outright; RESONANCE and VIBRATION are sonic siege; GUNSHOT,
  CONCUSSION, CHOKING and SWIPE are blows aimed at someone; EXECUTING is a 900-damage sentence
  against courage; PLATOON (8 soldiers), VANGUARD (4 knights), CARAVAN (camels), HAMLET (peasants)
  and SLAIN (ghosts) muster where they land; GRAVEYARD raises wild zombies against enemies;
  OVERTHROW takes the city and ends fealty; ABOLITION and DISSOLUTION end laws and pacts; REVERSAL
  swaps your most valuable thing with someone's; RETROSPECTIVE rewinds 20 s; SHUTDOWN and MALWARE
  jam; SECRECY hides a side from exposure. Adjectives by meaning: GIGANTIC (mass ×12) and TITANIC
  (×20) tower, POWERLESS strips damage and power, STATIONARY and WRECKED stop a ride, NEEDLESS needs
  no food or fuel, MYRIAD is twenty of anything, SUICIDAL is a blast that hurts its owner. Adverbs
  bend verbs from DRASTICALLY and RIDICULOUSLY (×2.5) to INDEFINITELY and ENDLESSLY (six times as
  long). Fields last at most six minutes in one place, so no new lasting area lacks an ender; no
  word seals a fate; no object radiates past 200 m. Counter-words were checked for direction
  (`counters` names what a word ends): MEDIATION and RECONCILE end FEUD, CONTAINMENT a MELTDOWN,
  LEGITIMACY a USURPATION, SANITATION a PLAGUE.
- Pitfalls (shared CLAUDE.md): a terrain-class word with a `field_radius` and no `tile_type` is an
  object, not a field (ROOFTOP, SKYLINE, LATITUDE moved to attribute); `summons` acts only on areas
  (fields and events), so a verb or an object that names one summons nothing (SUMMON recruits
  instead); `summons` must name a creature or person (SKELETON is the key).
- Drawn: a WORDS shape for each of the 142 new concrete words without one (CHIMNEY had one; people as bipeds by what they do, a
  crowd for KIN and FOLLOWER, a mannequin DUMMY, a green MUTATION; new shapes for a parachute, a
  pile of rounds, a waterfall and cascade, stairs, a stage curtain, a gas burner, a cog, a tea cosy, a
  mosaic, a rotor, a slab, scaffolding, a chevron stripe, a tyre, a vase, a wicket, a wrapped present,
  a tooth, an antibody, a timber frame, a pedal and a tor; landforms as signs), checked in the
  gallery with headless Playwright.
- Tournament (48 rooms, 8 mixed bots, 30 min cap, same seeds; main's dictionary against this
  batch's): mean round 8.6 -> 8.4 min; median first death 153 -> 145 s; rounds at the time cap 0 -> 0
  (longest 25.7 and 24.8 min). Bots spelled new words 110 times (29 different; PEP 16, NAN 15, SIC
  13, FOE 12, AVAIL 7, MONO 6), 1.8% of 5,989 spellings, from about 0.9% of racks.
- Remaining: `tools/freq_todo.txt` (3,000 words, rank order) starts at ENTHUSIAST (rank 15,809),
  EPILEPSY, ESTIMATION, EXCAVATION, EXTREMIST, FEEDER, FLATTERING, FORCIBLY.

## Frequency batch 4: the next eleven hundred most common words

- Added 1,188 words, every missing word from wordfreq rank 15,809 to 20,087 (ENTHUSIAST, ESTIMATION,
  EXCAVATION, FEEDER, FLATTERING... to DECIMAL, DEFENSIVELY): 557 nouns, 450 adjectives, 98 verbs, 83
  adverbs; the dictionary is now 16,987 words. Twelve core words are hand-written in demo_words.txt
  (ZEPPELIN, CHARIOT, REVOLVER, LAUNCHER, ROACH, WILDFIRE, BONFIRE, CARNAGE, NEMESIS, MONSTROUS,
  APOCALYPTIC, UNLEASH); the rest went through chunk files and `generate_words.py merge`. The todo list
  was rebuilt first: the concept batches had already given DIZZY, RUMOUR, COLOSSAL, AWAKEN and AMNESIA
  data. New producers: hired hands pay N (PROPRIETOR, SUBORDINATE, TRAINEE, CAMERAMAN, BREEDER,
  EXPORTER, UNIONIST), a CONVERTER and a BINDER make M, MAIZE is a crop (A).
- Gap after this batch (`tools/freq_gap.py`): top 10k 0, top 20k 0 (was 1,262: 623 n, 98 v, 460 adj,
  81 adv), top 30k 2,802 (1,332 n, 251 v, 1,025 adj, 194 adv; was 4,092). `--todo` now reads the top
  40k, so the list holds 3,000 words though fewer than that are left in the top 30k.
- Left out on purpose and not counted: names WordNet also lists lower-case (BARTLETT, HOBBIT,
  LANGLEY, PHOEBE, DIXIE, RUTHERFORD, MEDINA, NAPA, KELVIN, SIEMENS...: `freq_gap.py` NAMES), Roman
  numerals and misread forms (XIII, XIV, XVI, LIV, CPS, ELVES, CONN, MIDI, RETREATED: NOT_WORDS), crude
  and sexual words added to tools/crude.txt (MASTURBATION, OBSCENE, NIPPLE, the genital and pelvic
  anatomy, BLOWJOB, THREESOME, PERVERT, PEDOPHILE, SHITE and four slurs), and words about groups of
  people, sexuality, illness, religion's offices or atrocities added to `EXCLUDED` (DIASPORA,
  UNDOCUMENTED, MULTICULTURAL, INTERRACIAL, RACIALLY, SEGREGATED, BOURGEOIS, BOOMER, COLLEEN, WELCH,
  HETEROSEXUAL, HOMOPHOBIA, MASCULINITY, ADULTERY, INCEST, CHILDBIRTH, UNBORN, MISCARRIAGE, EPILEPSY,
  AUTISTIC, DIABETIC, SCLEROSIS, LUNATIC, PSYCHOTIC, PSYCHOPATH, DEPRESSIVE, HANDICAPPED, PAPAL,
  EPISCOPAL, SYNOD, PRIESTHOOD, SHIVA, OBI, AMIR, BEY, RAJA, INQUISITION, COLONIALISM, BIGOTRY,
  EXTREMIST, EXTREMISM). Political and religious ideas kept, acting only through ordinary systems and
  aimed at no group: CONSERVATISM (a field that fines spelling, stretches durations and ends
  REVOLUTION and REFORM), IMPERIALISM (claims and taxes ground), POPULIST (a leader whose mutinies
  join him), UNIONIST, BIPARTISAN (a pact), COLONIZATION (settlers and a claim), HOLINESS, DIVINITY,
  HALLELUJAH, OCCULT, SINNER and REPENT.
- Notable effects, all through shared systems: WILDFIRE burns and spreads over a 25 m region and ends
  forests and meadows; CARNAGE cuts down everyone in a 12 m circle (400 slash, 300 blunt, bleeding);
  BLOODSHED raises the slain as ghosts; MANPOWER musters 8 workers, COHORT 6 soldiers, OVERRUN 10 and
  takes the city, CIVILISATION 6 peasants under a law; ANNEXATION, ACCESSION and CONQUERING take a city;
  OVERFLOW floods, SATURATION drenches a region and puts out fire, OXIDATION rusts steel and iron,
  SHATTERING breaks glass and ice, WRECKING levels a building; GLITCH misspells a thing, SUBSTITUTION and
  LIEU swap owners, REPLICATION copies, RETRIEVAL hauls a thing 150 m to you; NEMESIS is a hunting
  spirit, DIVINITY a healing god, INCARNATION and SURROGATE cheat death once; KICKOFF moves the storm on
  30 s, OUTSET, TIMETABLE and MIDTERM hold it; VOWEL gives a blank and doubles vowels, ACRONYM and
  SYLLABLE are stand-ins; MAVERICK has free speech. Adjectives by meaning: MONSTROUS (size ×3, mass ×8),
  JUMBO, OVERSIZED, MOUNTAINOUS; MICROSCOPIC (size ×0.05) slips out of reach; PARALYZED and TOTALED stop
  a body or a ride; ARMOURED, FORTIFIED, FLAMING; APOCALYPTIC doubles fire and blast; UNPROTECTED strips
  armour, cover and shields; VACCINATED and SANITARY end sickness. Adverbs bend verbs from MILDLY (×0.6) to
  EXPONENTIALLY (×2.5 and a copy) and FATALLY (no revival). Counter-words, checked for direction:
  LEGALIZATION ends a BAN and PROHIBITION, FREEING a PRISON, CAGE or SHACKLE, PAX a WAR or FEUD,
  ANTITRUST a MONOPOLY, CORRECTNESS a TYPO, CONFIDENTIALITY a LEAK, INTERCEPTION a MISSILE or ROCKET,
  OVERRIDE a ROBOT or DRONE, MODERATOR a MELTDOWN, SWAT a FLY or WASP. Areas laid at a place last at
  most five minutes (pacts up to eight), the map-wide GLOBALIZATION 1.5, and MIDDAY's and MERIDIAN's day is
  ended by any night word, so no new lasting area lacks an ender; no word seals a fate; no object
  radiates past 200 m.
- The build's meaning rules gave the new words their dimensions with no hand work: natures (139
  words: people flesh, machines metal, a ZEPPELIN aluminium), their materials' melting points, burning,
  conducting and shattering (47 things), size from meaning (17: ELONGATED ×2, FLATTENED ×0.1), last stands (GRITTY,
  GUERRILLA, DAREDEVIL, FRENZY...), haunting acts for ghosts (21), screen, knowledge and comms
  (JAMMING censors, KAPPA, TAU and ETA restore panels). Two the rules got wrong were set by hand:
  HIPPIE and HIPSTER do not fight on (`last_stand=0`).
- Pitfalls (shared CLAUDE.md): acts aimed at someone written in an affliction, knowledge, feeling or
  possession archetype (MIGRAINE, PERSUASION, PARANOIA, APPROPRIATION) and self fields written as places
  with no tile (SOLITUDE, AFTERLIFE, BEDSIDE) parsed as lone objects; they are now `act`/`event` and
  `attribute`. An object with `haunts` (OBITUARY) fails the ghosts test: only acts on others may haunt.
- Drawn: a WORDS shape for each of the 180 new concrete words without a generated image (people as
  bipeds by what they do, a crowd for FODDER; new shapes for a zeppelin, a chariot, a revolver, a rocket
  launcher, a wavy kris, a prism, a windshield, a mudguard, a hinge, an electrode, a lattice, a
  pedestal, a piling, a strip light, a wristband and a particle; landforms as signs), checked in the
  gallery with headless Playwright (the chariot's rider and the horseback saddle were redrawn).
- Tournament (48 rooms, 8 mixed bots, 30 min cap, same seeds; main's dictionary against this
  batch's): mean round 8.5 -> 8.7 min (longest 11.4 -> 13.1); median first death 128 -> 142 s; median
  time to kill a person 7.6 -> 6.2 s; rounds at the time cap 0 -> 0. Bots spelled new words 83 times
  (23 different; ODE 18, POL 12, ARIA 11, DUN 8), 2.0% of 4,216 spellings.
- Remaining: `tools/freq_todo.txt` (3,000 words, rank order) starts at DEFUNCT (rank 20,088),
  DEGRADE, DIFFUSE, DIGNIFIED, DISOBEDIENCE, DREAMER, ESTEEMED, ETHERNET.

## Frequency batch 5: the next eleven hundred most common words

- Added 1,114 words, every missing word from wordfreq rank 20,088 to 24,223 (DEFUNCT, DEGRADE,
  DIFFUSE, DIGNIFIED, DISOBEDIENCE... to JUSTIFIABLE, LECTURING): 500 nouns, 416 adjectives, 123 verbs,
  75 adverbs; the dictionary is now 18,101 words. Twelve core words are hand-written in demo_words.txt
  (AEROPLANE, OMNIBUS, BAYONET, GOLIATH, WIGHT, HORDE, SHELLING, DEFORESTATION, VENDETTA, TOWERING,
  BLINDING, SHATTER); the rest went through chunk files and `generate_words.py merge`. New producers:
  hired hands pay N (RECRUITER, HOMEOWNER, TESTER, INTERMEDIARY, SCREENWRITER, THEORIST, COUNCILMAN), a
  leaf BLOWER makes M, a POLYTECHNIC is a station (C), BLUEGRASS is planted flora (P).
- Gap after this batch (`tools/freq_gap.py`): top 10k 0, top 20k 0, top 30k 1,602 (765 n, 126 v, 592
  adj, 119 adv; was 2,802), top 40k 4,167 (2,054 n, 333 v, 1,495 adj, 285 adv; was 5,367).
- Left out on purpose and not counted: names WordNet also lists lower-case (LIZA, GRANGER, HELLER,
  FITCH, MARSEILLE, RITZ, RUDD, FUJI, GAGE, KALI, LAGUNA, LEVANT, SALAH, BRITT, CICERO, FIRTH, FABIAN,
  TOD, HOGG, LEV, DAK: `freq_gap.py` NAMES), foreign words and abbreviations (NEE, SOM, OTC, CCC, MASSE,
  PCT: NOT_WORDS), crude and sexual words and slurs added to tools/crude.txt (SPANKING, ORGY, PEEING,
  FECES, TURD, BONER, KINK, LEWD, PERVERTED, PORNOGRAPHIC, MASTURBATE, SADISTIC, INDECENT, the groin
  anatomy, MIDGET, CRIPPLE, SISSY, POM, DICKHEAD), and words about groups of people, sexuality, illness,
  religion's offices or atrocities added to `EXCLUDED` (SECTARIAN, SUPREMACIST, FUNDAMENTALIST, QUAKER,
  APOSTOLIC, CIRCUMCISION, MARTYRDOM, ANTISEMITISM, BIGOT, PUEBLO, PATRIARCHAL, CONTRACEPTION, CONSENSUAL,
  SEDUCTION, CHASTITY, HET, PRENATAL, MENOPAUSE, INFERTILITY, PSYCHOSIS, MADMAN, MANIAC, LOCO,
  NARCISSISTIC, TIC, ANOREXIA, ANEMIA, AUTOIMMUNE, CANCEROUS, FIBROSIS, DIALYSIS, INPATIENT, JUNKIE,
  TRAMP, ABUSER, EUTHANASIA). Political and religious ideas kept, acting only through ordinary systems:
  TOTALITARIAN (a leader whose field censors and bans trade and spelling), IMPERIALIST (claims, taxes,
  takes a city), REACTIONARY (rewinds, ends REFORM and REVOLUTION), CENTRIST (a peacemaker), SUBVERSIVE
  (mutiny that joins him), DEREGULATION (ends bans and embargoes), ORTHODOXY, CONSECRATED, DEVOTIONAL,
  WORSHIPPED, YOGI.
- Notable effects, all through shared systems: SHELLING rains 14 shells over a 20 m region from 300 m off
  and ends bunkers and trenches; HORDE pours 16 of its speller's barbarians over the land, PARAMILITARY 8
  rebels, CORDON 6 guards who root and close trade, ENTOURAGE 4 bodyguards, TROUPE 4 jesters, PEACEKEEPING
  4 soldiers under a law against fighting that ends wars and riots; DEFORESTATION fells a 15 m circle to
  bare field and ends forests and jungles; VENDETTA hunts one foe for five minutes; FRAGMENTATION,
  BOMBSHELL, OUTBURST, HAMMERING and MUTILATION (severs two grafts) are blows; LEVELING and DISMANTLING
  raze a building; GOLIATH is a three-metre warrior with a 15 m knockback, WIGHT an undead that freezes,
  CUPID a flying archer whose arrows charm; EXTRADITION hauls someone 150 m and captures them; COERCION
  and HYPNOSIS take control, GUNPOINT roots and robs, INSOLVENCY puts 20 debt on a rival, ULTIMATUM
  stakes five letters; NIGHTTIME brings night for a minute and a half and day ends it; ENDGAME brings
  sudden death and moves the storm on 30 s for a minute; DISARMAMENT negates blades, guns and blasts and
  ends weapons; CIRCUMVENT walks through walls and fences. Adjectives by meaning: TOWERING (size ×4, mass
  ×6), WHOPPING, SIZEABLE; BLINDING, IGNITED, CONSECRATED (holy ×1.6, ends demons and zombies), LIFELESS
  and DEFUNCT stop a body or a machine, INFLATABLE floats, BEHEADED raises a zombie, INTERCONTINENTAL
  carries ten times as far, LIMITLESS stores five times as much. Adverbs bend verbs from MISERABLY (×0.6)
  to DOUBLY (×2 and a copy), PERPETUALLY (five times as long) and MIRACULOUSLY (×1.8 and a life).
  Counter-words, checked for direction: PEACEKEEPING ends RIOTING, RECONCILED a VENDETTA and a FEUD,
  DEREGULATION and LEGALIZE a BAN, PUNCTURE and BLOWOUT a tyre or a balloon, SHATTER glass, ice and
  shields, TERMINATOR pests. Areas laid at a place last at most five minutes, the map-wide NIGHTTIME and
  ENDGAME 1.5 and 1, so no new lasting area lacks an ender; no word seals a fate; no object radiates past
  200 m.
- The build's meaning rules gave the new words their dimensions: natures (146 words), their materials'
  melting points (31), burning (25), conducting (20) and shattering (13), size from meaning (19), haunting acts for
  ghosts (33: COERCION, HYPNOSIS, BANE, TORTURING...), last stands (DEFIANT, AUDACITY, IMPERIALIST),
  spelling rules (EASING, RICHNESS cheaper; CHORE, FORMALITY dearer; DUPLICATION doubles letters),
  storm holds (CESSATION, MEDITATE, SLUMBER) and sudden death (ULTIMATUM, RAPTURE). Four the rules got
  wrong were set by hand: ADMIRER and FAD do not fight on (`last_stand=0`), a FLOPPY disk and a TAPING
  are not magnets (`magnetism=0`).
- Pitfalls (shared CLAUDE.md): a self field written with an operation on `field_radius` and no
  `field_radius` of its own parses as an object (EXPANSE, caught and fixed); a word with `binds` 2 or more
  that is not physical is a pact (SORORITY, CLIQUE), whatever its archetype. A 60 kg CARCASS was the
  first raw food bots chose and too heavy to carry, which broke the bots' cooking test: it is now 15 kg.
- Drawn: a WORDS shape for each of the 173 new concrete words without a generated image (people as
  bipeds by what they do, a three-metre GOLIATH, a pale WIGHT, a winged CUPID, a mounted EQUESTRIAN; new
  shapes for a bayonet, a tripod, a helix, a floppy disk, a moustache, an orb, a leaf blower, a grating,
  a coulter, a splinter, a hamper, an oculus, a pulpit, a castor, an embroidery hoop and a pencil for
  EYELINER; landforms as signs; quantities keep their archetype's look), checked in the gallery with
  headless Playwright (EMBROIDERY and EYELINER were redrawn: they read as a cloak and a torch).
- Flaky test (batch 4 saw server `economy.test.ts` "people start with eight letters" fail once with 5):
  a room's clock runs in real time while a test client connects, and a bot's first spelling was due at
  `elapsed + rng × 10 s`, as early as 0.68 s on that test's seed. On a loaded machine the connect took
  longer than that, the bot spelled its three-letter starter word, and the check saw 5 letters. Now a
  bot's first spelling waits a whole spell gap like every later one (5 to 10 s,
  `BOT_SPELL_GAP`), and a new test checks every bot's first spelling is at least that far off and that
  none has spelled after four and a half seconds of ticks (it fails on the old code).
- Tournament (48 rooms, 8 mixed bots, 30 min cap, same seeds, this branch's bots; main's dictionary
  against this batch's): mean round 8.7 -> 8.7 min (longest 12.4 -> 11.7); median first death 106 ->
  123 s; median time to kill a person 5.7 -> 5.4 s; rounds at the time cap 0 -> 0. Bots spelled new
  words 71 times (23 different; ANI 18, DEB 12, YOGI 5, CERT 4), 1.8% of 4,051 spellings; 954 of the
  new words were within some rack's reach.
- Remaining: `tools/freq_todo.txt` (3,000 words, rank order) starts at LINKAGE (rank 24,224), LOUVRE,
  LOVINGLY, MASONIC, NEWFOUND, NOSED, OBSERVATIONAL, PARLOUR.

## Frequency batch 6: the next eleven hundred most common words

- Added 1,107 words, every missing word from wordfreq rank 24,224 to 28,594 (LINKAGE, LOVINGLY, MASONIC,
  NEWFOUND, NOSED... to INANIMATE, INEXPLICABLY): 500 nouns, 423 adjectives, 93 verbs, 91 adverbs; the
  dictionary is now 19,208 words. Twelve core words are hand-written in demo_words.txt (GLIDER, STREETCAR,
  BOOMERANG, SHIV, SCARECROW, CROSSFIRE, DETONATION, MANHUNT, NIGHTFALL, SUPERHUMAN, MERCILESS,
  EXTINGUISH); the rest went through chunk files and `generate_words.py merge`. New producers: hired
  hands pay N (PRENTICE, SPOKESWOMAN, LOBBYIST, IMPORTER, CARTOONIST, PUBLICIST, GROWER, FITTER), an
  ALLOTMENT is a crop field (A), a CATCHMENT holds water (O), a FURNISHING is furniture (B).
- Gap after this batch (`tools/freq_gap.py`, which now also prints the top 40k): top 10k 0, top 20k 0,
  top 30k 402 (187 n, 37 v, 151 adj, 27 adv; was 1,602), top 40k 2,967 (1,476 n, 244 v, 1,054 adj, 193
  adv; was 4,167). Fewer than 3,000 are left in the top 40k, so `--todo` now reads the top 50k.
- Left out on purpose and not counted: names WordNet also lists lower-case (SARATOGA, DOBSON, LOUVRE,
  BENNET, ARGUS, MERLE, FLINDERS: `freq_gap.py` NAMES), an abbreviation the lexicon does not hold (KHZ:
  NOT_WORDS), crude and sexual words and slurs added to tools/crude.txt (REDNECK, COON, the genital and
  pelvic anatomy, VIBRATOR, PEDOPHILIA, HICKEY, BUSTY, BOSOM, FECAL, DIARRHOEA, EROTICA, FOREPLAY, PETTING,
  SPANK, SHAG, BITCHY, BOLLOCKS, FINGERING, GROPING), and words about groups of people, sexuality, illness,
  religion's offices or atrocities added to `EXCLUDED` (MIDWESTERN, CREOLE, GENTILE, ETHNICALLY, YAKUZA,
  GANGSTA, HOBO, DERELICT, UNTOUCHABLE, ALBINO, MULTICULTURALISM, XENOPHOBIA, XENOPHOBIC, BIGOTED,
  PREJUDICED, FEMININITY, PATRIARCHY, HAREM, POLYGAMY, AMOUR, CONTRACEPTIVE, CONSENTING, PLACENTA,
  NEONATAL, DEVIANT, DEVIATE, SCHIZOPHRENIC, NEUROTIC, SOCIOPATH, UNHINGED, BONKERS, PHOBIA,
  INSTITUTIONALIZED, HOSPITALIZATION, INCURABLE, ANEURYSM, LESION, ULCER, CYSTIC, DYSLEXIA, RHEUMATOID,
  BLACKWATER, DEGENERATIVE, PASHA, SHEIK, MAHATMA, SWAMI, CURATE, ARCHDIOCESE, CONGREGATIONAL, HEATHEN,
  BOHEMIA, HAJJ, JOSS, SERVITUDE, LYNCHING, CRUCIFIXION, CANNIBAL, CANNIBALISM, ATROCITY). Political and
  religious ideas kept, acting only through ordinary systems: ANARCHISM (a field that strips authority
  and command and breeds mutiny), POPULISM (mutinies that join its speller), SEPARATIST and DISSIDENT
  (mutiny that joins them), HEGEMONY (claims, taxes, command), NATIONALISTIC, FEDERALIST, EGALITARIAN,
  PACIFIST (whoever takes him gets a truce), PIETY, SANCTITY, LITURGICAL, ATONEMENT.
- Notable effects, all through shared systems: DETONATION levels a 12 m circle (500 blast, 200 fire, a
  20 m knockback); CROSSFIRE rains 12 volleys over a region from 150 m off; FISSION is a 15 m nuclear blast
  that sickens and blinds; FLAK shreds a region of sky and ends AIRLINER, GLIDER, ZEPPELIN, HELICOPTER and
  DRONE; MANHUNT hunts one person for four minutes, exposed, with four of its speller's bloodhounds, and
  captures them; FORAY raids a region and steals letters; ROUT breaks a region's morale; CREMATION burns a
  person past revival; DISINTEGRATION is a 300-magic ray; HUMANKIND musters 10 people, CADRE 4 soldiers,
  SUBGROUP 3, MINION comes three at a time; URBANIZATION paves a 10 m circle and ends forests and meadows,
  RECLAMATION turns wasteland, desert and swamp to fertile field, EVAPORATION dries water to sand;
  MORATORIUM holds the storm 40 s, SOLSTICE 20 s; NIGHTFALL brings night for a minute and a half and
  DAYBREAK ends it; YAWN puts everyone near to sleep; APPREHEND arrests and SUBDUE captures; DISSECTION
  severs a graft; PRIVATISATION, TENANCY and GENTRIFICATION take a building against its security; the
  AEGIS is 40 armour, a 200 shield and fearlessness; a TOON shrugs off blunt and crushing blows; the BLOB
  is an acid slime. Adjectives by meaning: SUPERHUMAN (strength +6, integrity ×3, carry ×4), INNUMERABLE
  (count ×6), GALORE (×4), TEENY (size ×0.15), SENTIENT makes a thing alive and walking, VEHICULAR makes
  it ridable, NOMADIC makes a house portable, INANIMATE stills a creature, EVAPORATED turns a thing to gas
  that walks through walls, SUBTERRANEAN burrows, IMPENETRABLE, UNBREAKABLE, MERCILESS (×1.6 and no
  revival), BLINDFOLDED, INCAPACITATED. Adverbs bend verbs from MINIMALLY (×0.5) to SUPREMELY (×1.8),
  SPECTACULARLY (×1.8, louder and wider), THRICE (×1.5 and two copies) and TERMINALLY (no revival).
  Counter-words, checked for direction: EXTINGUISH ends fire, flame, wildfire and torches; FLAK aircraft;
  DAYBREAK night; MEDIATE an ALTERCATION, TIFF, BICKERING or STANDOFF; DISPEL fog, mirage and curses;
  REFUTE lies and propaganda; ROUSE sleep; DERAIL trains and streetcars; MOW grass and hay; REQUIEM
  ghosts; REMEDIATION pollution and SMOG; STERILIZATION and ANTIMICROBIAL germs and plague; SCARECROW crows
  and their kin. Areas laid at a place last at most five minutes, map-wide and sky words at most a minute
  and a half (SMOG, a region's fog, counts as map-wide), so no new lasting area lacks an ender; no word
  seals a fate; no object radiates past 200 m.
- The build's meaning rules gave the new words their dimensions: natures (150 words), their materials'
  melting points (36), burning (37), conducting (26) and shattering (20), size from meaning (13), haunting
  acts for ghosts (37: DURESS, SHOCKER, WAILING, CROSSFIRE...), last stands (RESOLUTE, CHIVALRY, MAINSTAY),
  deaths absorbed (TENACITY, TENACIOUS, UNBREAKABLE), revivals (DELIVERANCE, ACUPUNCTURE, REINSTATE),
  spelling rules (FLUENCY, BRAILLE cheaper; EXCLAMATION and AMPLIFICATION double letters; SCRABBLE a blank;
  RANTING free speech), storm holds (BREATHER, MEDIATE, POISE) and a storm push (INCITE), amnesia from
  blunt blows (BRUNT, FASTBALL, BOOMERANG). Ones the rules got wrong were set by hand: an INCENDIARY bomb
  commands no one (`command_limit=0`), a VIDEOTAPE is no magnet (`magnetism=0`), WIZ, REFORMER and
  DIAGNOSING do not fight on (`last_stand=0`), CUDDLING, SNUGGLE and STROKING are not haunting acts,
  SPOKESWOMAN and BIOGRAPHER give no blank, CONDENSATION no amnesia, ELITIST, EGALITARIAN and UTILITARIAN
  read no racks, and a TOON is fae.
- Drawn: a WORDS shape for each of the 186 new concrete words without a generated image (people as bipeds
  by what they do, wizards for WIZ and CASTER, a big-headed TOON, a demon-red FIEND; new shapes for a
  boomerang, a glider, a scarecrow, a blob, a jukebox for NICKELODEON, a pallet and a cork for STOPPER;
  landforms as signs), checked in the gallery with headless Playwright (STREETCAR, STUB and IRONING were
  redrawn: they read as a steam train, a speck and a robe).
- Slow tests: two shared tests that walk the whole dictionary passed the 5 s default when the suite
  ran in parallel (every verb with every adverb, about a million casts; and the tip ideas). The tip
  weight now counts missing letters without building a string (tips.ts `shortfall`, half the time),
  and both tests get the explicit 30 s timeout the other whole-dictionary tests already had.
- Tournament (48 rooms, 8 mixed bots, 30 min cap, same seeds; main's dictionary against this batch's):
  mean round 8.7 -> 8.6 min (longest 11.7 -> 14.4); median first death 123 -> 132 s; median time to kill
  a person 5.4 -> 4.4 s; rounds at the time cap 0 -> 0. Bots spelled new words 95 times (30 different; HAP
  13, JIG 11, SHAY 9, EBB 7, HOY 7), 2.3% of 4,121 spellings; 825 of the new words were within some
  rack's reach.
- Remaining: `tools/freq_todo.txt` (3,000 words, rank order) starts at INFIELD (rank 28,595), INFLATE,
  INNOVATOR, IRREPLACEABLE, KILOGRAM, LANDLINE, LINGO.

## Concept: screen, knowledge and communication

- Not a word batch: three shared systems (shared `screen.ts`, `knowledge.ts`, `comms.ts`) and meaning
  rules (`tools/meaning.py`) that give their properties across the whole dictionary by WordNet sense
  and gloss, applied by how each word acts (weapon, event, field, carried thing, verb, adjective).
- Screen: new statuses AMNESIA, ILLITERATE, CENSOR and GAG; BLIND, SLEEP, CONFUSE and CHAOS also take
  panels. About 1,040 words touch the screen: 80 inflict amnesia (clubs, hammers, knockouts,
  CONCUSSION), 105 blind, 412 confuse, 102 sleep, 25 censor (every jammer, REDACTION, CENSORSHIP), 6
  illiterate (BABEL, JARGON, NONSENSE); 129 restore panels (GLASSES and goggles, MAP, CHART, COMPASS,
  every book and reference work, schools, diaries and notebooks, news and broadcasting).
- Knowledge: `read_properties`, which about 500 words already set and nothing read, is now insight:
  790 words; 358 give 2 or more (counters), 156 give 5 or more (racks: spies, detectives, libraries,
  scholars), 32 give 8 or more (what others can spell: ORACLE, SEER, PROPHET, ASTROLOGER, TRUTH).
- Communication: pings and spells said aloud; about 1,560 words touch it, mostly through `loudness`
  (1,240: a voice carries farther), `hearing_range` (97: RADIO, PHONE, TELEPATHY), lies' `decoys`
  (165 now also send made-up calls and DANGER pings), and the deaf, silenced and gagged.
- Pitfall: GAG and BLINDFOLD were artifacts (objects on the ground) though their data read as events;
  GAG is now an act in demo_words.txt. Check `parsePhrase(...).kind` for any word meant to land on someone.
## Concept batch: combat (damage natures, luck, scale, control)

- Four dimensions as shared systems, given by meaning across the whole dictionary by generator
  rules (`tools/derive.py`, run by `build_demo.py` after the hand-written and generated words are
  read; class, archetype, first material, own properties, WordNet hypernyms and glosses; a rule never
  overrides what a word sets). PLAN.md "Concept batch: combat" has the rules.
- Damage natures (shared `affinity.ts`): 24 natures, an explicit matrix over the 24 damage types.
  Natures on 5,984 nouns: every creature (992), person (1,403, flesh: no weakness of their own) and
  plant (417), 89% of artifacts; by nature flesh 1,675, metal 825, stone 691, beast 586, wood 520,
  plant 411, cloth 409, machine 207, plastic 180, insect 171, paper 148, reptile 100, glass 99, fire
  64, fish 57, water 46, spirit 32, holy 28, fae 18, ice 16, demon 15, fungus 11, bone 7, undead 5.
  Things now take their first material's flammability (1,292 words), conductivity (947),
  brittleness (697) and melting point (1,306): a wooden FENCE burns, a steel SWORD conducts. 4,746
  of 7,224 bodies have a weakness, resistance or immunity on their card. A HAMMER passes through a
  GHOST ("immune"), a TORCH burns a ZOMBIE ×1.5 ("weak!"), a SWORD on a stone WALL "resists".
- Luck (shared `idea.ts`): 268 words move luck (CLOVER, HORSESHOE, AMULET, TALISMAN, JUJU, LUCKY,
  SERENDIPITY up; JINX, MISFORTUNE, DISASTER, CURSE's status down), 14 reroll or gamble (DICE
  rerolls and gambles 6 letters, FATE throws 8 letters between two people, ROULETTE, CASINO,
  LOTTERY, RAFFLE, SWEEPSTAKES). Luck reaches a hunt's rare letter, a ruin's X, gathering misses
  (rerolled), hidden traps (the lucky step over) and gambles.
- Scale (shared `scale.ts`): 262 words change size, from what they do to height, length or mass
  (GIGANTIC ×3, COLOSSAL ×8, TITANIC ×10, HUGE ×4, GROWTH ×2 for your side, TINY and MINIATURE ×0.1,
  SHRINK and SHRINKAGE ×0.25, potions and the geological ages alike). Stature: a GIANT (8 t) or a
  GIGANTIC person cannot enter a house, a MOUSE or a SHRUNK person slips under an enemy's door, a
  GIGANTIC rider cannot ride a HORSE, a SHRUNK one rides their own WOLF.
- Control (shared `control.ts`): 133 words steer bodies (49 alcoholic drinks and DIZZY sway;
  REVERSAL, IRONY, MIRAGE reverse controls; HYPNOTIZE, MESMERIZE, HYPNOTISM, ENCHANTMENT, DOMINATION,
  MANIPULATION, POSSESSION, PUPPET hypnotize; LASSO, ROPE, CHAIN, HARPOON, OCTOPUS, VINE, KUDZU,
  NOOSE, HALTER, MARIONETTE leash instead of rooting; MAGNET, LODESTONE, DYNAMO pull metal) and 115
  end it (SOBER, COFFEE, TEA, SOBRIETY; AWAKEN, REVEILLE and whatever ends sleep or charm;
  SCISSORS, SHEARS, HACKSAW, SEVER).
- Judgement calls: GIANT, TITAN and MOUSE stay creatures (big or small by their own mass) rather
  than becoming adjectives; frequency batch 3's GIGANTIC (×3) was kept over this batch's (×4).
  MINIATURE became an adjective (it was a painting). REVERSAL now reverses controls instead of
  swapping owners. BLACK CAT is two words; nothing was made of it. Holy damage still hurts the holy
  (a god must fall to it, TODO.md "Decided").
- Tournament (24 rooms, 8 mixed bots, 30 min cap, same seeds; main against this batch, both on the
  frequency batch 2 dictionary): mean round 8.4 -> 8.5 min; median first death 158 -> 137 s; median
  time to kill a person 5.5 -> 5.5 s (p25 1.3 -> 1.8, p75 13.7 -> 11.4, under 2 s 52 -> 43 of 168);
  creatures 0.0 -> 1.9 s; no round at the cap either way.
