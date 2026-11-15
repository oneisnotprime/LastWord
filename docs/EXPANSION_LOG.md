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
