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
