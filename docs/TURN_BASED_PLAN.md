# Last Word: turn-based PvP battles (plan, not built)

Status: a plan only. Nothing here is implemented. File and function names refer to the code as it
stands in `/home/user/lastword` (shared/src, server/src/WorldRoom.ts, client/src).

## 0. Summary

- **Recommended model:** a *battle ring on the map with its own battle view*. When one person
  engages another, both parties are pinned inside a ring drawn on the real map (an `Area`, like
  today's duel ring from `challenge`). The world keeps ticking at 10 Hz for everyone else. The
  people in the ring see a separate paper-theatre battle screen; everyone else sees the ring, the
  standees inside it and a round counter. Blows from outside do not land on the fighters; the
  storm wall, weather and areas over the ring still do. Others may walk in and join at a round
  boundary.
- **Turns:** simultaneous commit (everyone picks within a timer), resolved in speed order. One
  round plays one second of the existing fight, so `strike`, natures, armour layers, `FIGHT_PACE`
  and the tournament-tuned time to kill (about 6 s, so about 6 rounds before defending, healing
  and swapping stretch it) carry over unchanged.
- **Identity:** spelling a word is a move. The same `spellWord` path runs, letters are spent for
  good, counter-words become reactions, and long words are telegraphed letter by letter.
- **No new stats.** Every battle number is read from properties that already exist
  (`data/properties.json`), through the `Unit` the server already builds in `rebuild`.
- **Size:** prototype 3 agent batches, MVP 7 more, full 8 to 10 more.
- **Conflicts with two "Decided" lines in TODO.md** that only the user can change: "Combat is
  stat-based ... resolved in world ticks" and "about 100 players, constant PvP". See section 14.

---

## 1. Core loop and map integration

### 1.1 How an encounter starts

Today: a click on a person sends `attack` (WorldRoom `messages.attack`), which sets `Walker.foe`;
the combat loop in `update` walks the attacker into reach and strikes on a cooldown, with a
wind-up (`windupOf`) for heavy blows.

Proposed trigger rules:

| Rule | Detail | Existing code it leans on |
|---|---|---|
| Who | Person against person only (and their parties). Hunting wild animals, bosses, doors, ruins and lone creatures stay real time. | `Walker.master === null`, `kind` in `kill` |
| How | Lock-on click, as now. The attacker chases. When within `ENGAGE_TILES` (the smaller of the weapon's reach and 6 tiles) an **engage wind-up** of 2 s starts, drawn with the existing red closing ring (`windups` message, `onWindups`). | combat loop reach test, `Windup` |
| Forced, with an out | The target does not have to accept. They can run: if they are more than `ENGAGE_TILES` away, behind a wall (`walled`) or untouchable when the ring closes, no battle starts and the attacker cannot try again on them for 10 s. Speed on the map therefore still matters. | `DODGE_TILES` logic, `walled`, `hamper.untouchable` |
| Ambush | If the target cannot see the attacker when the wind-up would start (not in `Walker.seen`, hidden by stealth, disguise or a wall: `walkerHidden`, `fooled`), there is no wind-up. The battle opens at once and the ambusher's side gets a free round 0. A sprung trap of the attacker's within 8 tiles (`springTraps`) does the same and its status is already on the victim. | `seen`, `disguised`, `trapHidden` |
| Party pulled in | Each person's creatures within `PARTY_TILES` (8). Creatures farther off keep doing their jobs on the map and may arrive later (section 4). | `holdings`, `think` |
| Allies | People on the same side (`side()`, a pact) within 8 tiles get a 5 s prompt to join. | `pactOf`, `sameSide` |
| After | Everyone who leaves a battle alive is immune to engagement for 20 s, and to the same opponent for 60 s. The winner gets a second wind (heal 25% of body, as `restore`). | `Walker.reborn` precedent |
| Not during | The kit pick, a truce (`lawAgainst("attack")`), a sanctuary, stasis, the last closing of the storm (section 1.4). | `lawAgainst`, `picking` |

Opt-in versus forced: forced with an escape. Pure opt-in lets the weaker player refuse every
fight, which kills a battle royale. Pure forced makes the map irrelevant. The wind-up plus the
immunity timers is the middle. The existing opt-in duel (`challenge`, shared `sport.ts`: staked
letters, blows that cannot kill) stays as the friendly version and should use the same battle view.

### 1.2 What happens to the world meanwhile

- The room keeps ticking. Nothing pauses for the other players.
- Fighters are **pinned**: no walking, no gathering, no trading. Their `Walker.target` is cleared
  and a new field `Walker.battle` (the battle id) makes the real-time combat loop, `think`,
  `thinkBot`, `compel` and `stride` skip them.
- Fighters are **untouchable from outside**: a blow from a non-participant is refused the way a
  wall refuses it (`walled`). Their things on the ground and their buildings can still be attacked.
- **The world still reaches in**, once per round, scaled by the real seconds the round took:
  - the storm wall (`stormDamage(storm, max)` for whoever's ring centre is outside the wall);
  - weather and areas that already cover the ring (`burn`, `pulse`, `applyFields`);
  - hunger and upkeep (`upkeep`), production income (`produce`): your economy keeps paying
    letters into your rack while you fight, which is how property matters mid-battle.
- **Third parties.** Anyone may walk into the ring and click a fighter. They join at the next
  round boundary as a new side (or on a pact member's side), acting last in their first round.
  Cap: 4 sides, 12 active combatants. A full battle refuses more.
- **Bombing the ring.** In the full version, an outsider's area word aimed at the ring (METEOR,
  TORNADO, a sky strike) lands on everyone in it at the round boundary after its warning
  (`AREA_WARNING`, `CELL_WARNING`). In the MVP only the storm wall and what was already there count.
- **Time limits.** 10 s to choose (section 2.4); a hard cap of 15 rounds; from round 10 every blow
  is worth 25% more each round (fatigue). At the cap the ring dissolves and both get the immunity.
- **Spectators.** Anyone in sight sees the ring, the two lines of standees, health bars and a
  "ROUND 4" tag. Ghosts can watch a battle in the battle view (Tab, `watch`).

### 1.3 Integration models compared

| Model | How it works | For | Against |
|---|---|---|---|
| A. Frozen bubble on the map | Fighters and a patch of map freeze; turns play on the map itself with menus over it. | No second view to build. The place is plainly the place. | Top-down standees at map scale are small and already pile up (playtest: five bodies in one stack). No room for menus, party, turn order. Spectacle stays hidden. |
| B. Time-dilated simultaneous turns | The whole room alternates plan and resolve phases, or time slows near a fight (`Walker.time` exists). | One clock for everyone. | With 100 players a global pause is unbearable; local slow time is still real time and adds no menus. Kills gathering and exploring for everyone not fighting. |
| C. Separate battle screen, map ticking, fighters protected | Fighters are lifted out to an instanced screen; a marker stays on the map. | Best screen for depth, party and art. Simple to protect. | If the place does not matter (no storm, no third parties, no terrain), it stops being a battle royale and becomes a lobby game. |
| D. Real time with tactical pause | Fights stay on the map in real time; a command wheel queues moves on a 3 s cadence. | Smallest change. No protection rules. | Not turn-based in feel. Anyone can still pile in mid-thought. Does not deliver "Pokémon or RPG style". |
| E. Opt-in duels only | Extend `challenge`: turn-based only when both agree. | Tiny, safe. | Most fights stay as they are; goals (depth, play time) barely move. |

**Recommendation: C built on A's ring** (the first bullet of the summary). The ring is a real
`Area` at a real place, so biome, weather, night, claims, shelter, the storm and third parties
all feed the battle; the fight itself gets a proper screen. E ships first as the prototype
because the duel ring, stakes and non-lethal blows already exist.

### 1.4 The end of the round

The wall closes to nothing at 12 minutes (`STORM_END`, 720 s). A typical battle is 60 to 90 s, so
a 12-minute round holds two to four battles per survivor. Two proposals, both for the user:

- Stretch the schedule when turn-based is on (every `wait` and `shrink` in `STORM_STAGES` times
  1.5: an 18-minute round).
- During the last closing (stage 5, the final 45 s) no new battle starts; whoever is left fights
  one last battle together, with fatigue from round 1.

---

## 2. Turn structure

### 2.1 A round

1. **Plan** (up to 10 s, simultaneous, hidden): each person picks one action for themselves and
   may give one order to one creature.
2. **React** (up to 4 s, only if someone can): counter-words (section 3.3).
3. **Resolve** (2 to 4 s of animation): actions play in initiative order.
4. **End of round:** damage over time, regeneration, healing auras, world effects (1.2), morale,
   loyalty, status timers, fuel and food draw, reinforcements and joiners enter.

Simultaneous is recommended over sequential. Sequential turns with three or four sides and timers
means waiting most of the time; simultaneous keeps every human busy every round and keeps a round
near 10 s. It also creates the reads that make this kind of combat interesting (defend into a
telegraphed blow, swap into a resist).

### 2.2 Initiative

Order within Resolve:

1. Defend and Brace (they cover the whole round).
2. Swap and Dismount.
3. Flee attempts.
4. Everything else by **speed**, fastest first: the speed the server already computes in
   `rebuild` (`Walker.speed`: the mount's or vehicle's `speed_land` or `speed_air`, times
   `Walker.time`, times the status tempo). Ties: higher `agility`, then a luck roll (`luckyRoll`).
5. A ranged weapon (`attack_range` over 5 m) acts before melee in round 1 only (first volley).

Haste (`time` 2) acts twice a round; slow (`tempo` 0.5) acts every other round; stasis, stun,
freeze and sleep skip (`hamper.acts`).

### 2.3 How often a weapon strikes

One round is one second of the old fight. Each attacker keeps a charge: `charge += attack_rate ×
tempo` each round; while `charge ≥ 1` it strikes and loses 1.

- SWORD (rate 1): one strike a round. WOLF (1.2): one, and a second every fifth round.
  TABBY (2): two. BOW (0.6): three rounds in five. DRAGON (0.5): every other round.
  TANK (0.15): every seventh round. TREBUCHET (0.08): every thirteenth.
- A weapon that is charging shows it: "TANK loading 3/7". This is the telegraph.
- A **heavy blow** (`windupOf` > 0: likely damage at least `HEAVY_SHARE`, a quarter of the
  target's health, or the weapon's own `attack_windup`) is announced the round before it lands,
  with its target. `WINDUP_SECONDS` and `DODGE_TILES` become: Defend that round and it misses.

This keeps damage per second, and so every balance number, identical to the real-time game.

### 2.4 The action menu

| Action | What it does | Read from |
|---|---|---|
| **Attack** | Strike a chosen enemy with what you would strike with now (`Unit.attack`: the vehicle's weapon if it has one, else the hand). One entry per weapon held. | `strikeUnit`, `strikesWith` |
| **Defend** | All blows on you this round land at half (`FIGHT_PACE` 0.25 for you); a telegraphed heavy blow misses; `block` +0.3 with a shield in hand. Next round your word costs less (as `spell_cost` 0.8: the rarest fifth of its letters free). | `landed`, `block`, speech.ts cost rule |
| **Abilities** | Moves your gear, mount, creatures and ground give you (section 5). | properties |
| **Spell a word** | Opens the spell window. The word is cast as on the map. | `spellWord`, `describeWord` |
| **Items** | Use (U) something carried: POTION, BANDAGE, BEER, COFFEE, GRENADE. | `use`, `usable` |
| **Swap / Command** | Bring a benched creature forward, send one back, mount or dismount; or give an order. | `equip`, `dismountWalker`, `Walker.order` |
| **Forage** | One gathering try at the ring's biome odds, with your luck and rerolls. A desperate move for a letter. | `deposits.gather`, `luckyChance` |
| **Parley** | Offer a draw. If every side accepts, the ring ends and all get `truce` for 30 s. | `inflict_truce`, `hurtWith` |
| **Flee** | Section 7. | `runFrom`, `FLEE_TILES` |

### 2.5 Timers

- Plan: 10 s (15 s in round 1). Nothing picked: Defend. Two timeouts in a row: the bot mind plays
  for you until you act (`BotMind` already exists for every difficulty).
- Disconnect: the existing 20 s window (`RECONNECT_SECONDS`); the bot mind plays meanwhile.
- All-bot battles use a fixed 2 s a round so bots are not faster through the world than people.

---

## 3. Spelling as moves

Spelling in battle is the same act as on the map, through the same code, costing the same
letters. That is the point: the rack is your mana and your move list at once.

### 3.1 What each kind of word does in a battle

`parsePhrase().kind` already sorts a spelling into object, verb, event or sky:

| Spelling | In battle |
|---|---|
| Weapon, armour, gear | Equipped at once (`equip`). The old piece drops in the ring. Your turn. |
| Creature | Joins your bench, or the line if there is room and command allows (`addCreature`, `command`). |
| Mount or vehicle | You mount it: it becomes your outer layer and your attack (`Unit` layers). |
| Consumable | Goes to Items; using it is a later action (or U now, if the word is `single_use` food). |
| Verb (cast on self) | A buff for `effectSeconds(duration)` turned into rounds (section 7.3). |
| Adjective alone | `describeWord` on a target in the battle: your gear, a creature, an enemy (HUGE, TINY, HOLY, BLIND). |
| Event with a target | Lands on the chosen combatant (BLINDNESS, LIGHTNING, THEFT). |
| Area, field, weather, sky | A **battle field effect** for its rounds, and the same `Area` on the map over the ring. Friendly fire as its data says (`friendly_fire`, `field_targets`). |
| Building or claim | Raised in the ring: cover, shelter, a door between you and them (section 5.5). |
| Spelling rules (`ban_letters`, `spell_cost`, `word_limit`...) | Bind the other side exactly as `bindSpeech` does now. |

Because the area also exists on the map, a FIRE spelled in battle burns the forest round the ring
after the battle ends. No private mechanics.

### 3.2 Cost and tempo

- Letters: unchanged (`spellPrice`, `spend`). No letters come back.
- A word of five letters or fewer is one action.
- A longer word, or a grand one (`grand(p)`: grandeur at least `GRAND_FROM`), takes a **spelling
  round**: you announce it this round and it lands at the start of the next. The other side sees
  the tiles go down one by one, the first three face up: "D R A _ _ _". If you are stunned,
  silenced or killed before it lands the letters are lost.
- A word with its own `cast_time` or `attack_windup` (NUKE: 10 s) takes that many seconds over
  three, rounded up, in rounds: a NUKE is announced four rounds ahead and everyone can flee.

### 3.3 Counter-words as reactions

Counters are already data: 2,392 of the 18,101 words carry `counters` (RAINBOW counters STORM, MIRROR
counters MEDUSA, SCISSORS end a leash, SOBER ends drunk), the server has `countered`, `counter`
and `withCounters`, and bots have `botCounter`.

- After Plan, the server checks every announced or just-cast word against each opponent's rack.
  If an opponent can afford a word that counters it, a React phase of 4 s opens for them only:
  "MEDUSA is coming. MIRROR? (M I R R O R)". With insight 2 or more (`read_properties`,
  `countersShown`) the prompt names the counters; without, it only says a counter exists and the
  player must know it.
- Spelling the counter spends its letters, cancels the word (its letters are still lost to the
  caster) and, if the counter is a thing, leaves it in your hands.
- A reaction does not use your action, but you act last next round.
- Words that end statuses (`effect_status`: COFFEE ends drunk, GLASSES give sight back) work as
  normal actions, as now (`cure`).

### 3.4 Letters inside a battle

- No gathering except the Forage action (one try, the ring's biome).
- Production income keeps arriving (section 1.2): a player with farms and roads out-spells one
  without over a long battle.
- A kill pays as now: K for a person, V for a creature, the commoner half of the fallen's letters
  (`graveSplit`), the rest in a GRAVE in the ring.
- Fleeing drops two letters (section 7.1). Stakes in a duel are as `challenge` has them.
- The best-words strip (`bestWords`) is passed a battle `Situation`, so it suggests what the rack
  can do to this opponent ("PIKE · weak! vs HORSE").

---

## 4. Party

- **You** are always on the line. If you fall, your side loses (creatures go wild, as now).
- **Line:** you plus up to 2 creatures. One more slot for every 4 points of `authority`
  (`authorityOf`: a CROWN is 6), to a line of 5.
- **Bench:** every other creature of yours within `PARTY_TILES`, up to the command limit that
  already exists (`commandLimit`: 12 plus `command_limit` from crowns, banners, leaders, kits).
- **Mount or vehicle:** not a separate member while ridden. It is your outer layer and your
  attack, exactly as `Unit` has it. Dismount is an action: a living mount becomes a creature on
  your line; a machine is left parked in the ring (and can be stolen or broken).
- **Swarms:** one body with `count` (`massed`), as now.
- **Who controls creatures.** They act by themselves each round with the mind they already have
  (`chooseTarget(intelligence, candidates)`, `retreats`, `aggressive`). You get one free order a
  round (attack that, guard me, hold). A creature obeys as now: it must be sentient and not deaf,
  and `ignoresOrder(obedience, authority, rng)` may refuse. This keeps a round to one decision
  and makes obedience, authority and loyalty worth building.
- **Loyalty and morale in battle.** `fear_aura` on the other side lowers morale (`moraleGoal`);
  at 0 a creature routs and leaves the ring (`routed`). Hunger wears loyalty (`HUNGER_LOYALTY`);
  MUTINY and BRIBERY (`mutiny`, `mutiny_joins`) spelled as moves turn thin-loyalty creatures
  loose or over to the caster, as `mutiny()` does now.
- **Swapping:** a swap is your action. The creature that comes forward acts next round.
  A leashed, rooted or magnet-held creature cannot be swapped.
- **Reinforcements:** a creature of yours that walks to the ring from elsewhere joins the bench
  at a round boundary.
- **Followers that revive** (`revives`: MEDIC 0.5): if you fall and one is alive on your side,
  you stand again at that share once (`revive`, `REVIVE_COOLDOWN`).

---

## 5. Abilities from gear, vehicles and property

Rule: an ability is never authored. It is a property pattern. A new word gets its battle moves
the moment its data has the properties.

### 5.1 Mapping rules (property → battle)

**Attacks**

| Property | Battle meaning |
|---|---|
| `dmg_<type>` (24 types) | A strike move of that type; several types on one weapon land together (`strike` sums them). The move card shows the matchup against the chosen target from `damageShare`: "weak!" at ×1.25 or more, "resists" at ×0.75 or less, "immune" at 0. |
| `attack_rate` | Strikes a round (2.3). |
| `attack_range` > 5 m | Ranged: reaches the back line and flyers; first volley in round 1. |
| `targets` (land, air, water, underground) | What it can reach: a SWORD cannot hit a rider on a GRIFFIN in the air; a BOW can. |
| `attack_area` | 3 m or more: also hits the bodies beside the target. 10 m or more: the whole enemy line. |
| `attack_windup`, heavy blows | Telegraphed a round ahead; Defend dodges. |
| `single_use` | One use, then gone (GRENADE, a trap). |
| `siege` | Multiplies damage on doors, walls and cover (5.5). |
| `armor_pierce`, `ignores_resistance` | As `strike` reads them. |
| `knockback` | Pushes the target to the back line (it loses its next melee strike); 10 or more ejects a creature from the ring. |
| `lifesteal`, `thorns`, `reflect` | Heal on hit; harm to the striker; share of a blow returned. |
| `inflict_<status>` (35) | Put on a landed blow (`inflicts`, `hurtWith`); duration in rounds (7.3). |
| `friendly_fire`, `self_damage` | Hits your own line too; the spell preview already warns (`selfRisk`). |
| `strength`, `training` | Scale swung and all weapons (`armed`). |

**Defence**

| Property | Battle meaning |
|---|---|
| `integrity` | HP of each layer: vehicle, then each piece of protection, then the body. Shown as stacked paper bars, in felt numbers (`shown`). |
| `armor` | Flat off each hit. |
| `res_<type>`, `nature`, material make-up | `damageShare`; listed on every card (`affinityText`). |
| `block`, `evasion`, `accuracy`, `critical` | The hit roll, as `strike` has it. |
| `shield_pool`, `shield_regen`, `regeneration` | Absorb first; refill at end of round. |
| `immune_<status>` | Never takes it (HELMET: stun; GLASSES: blind). |
| `prevents_death`, `last_stand` | Extra lives; fighting on past death (7.4). |
| `cover`, `enterable` (roof) | Share of area and sky harm kept off (`shelterShare`). |
| `anchored` | Cannot be knocked back, pulled or dragged. |
| `stealth`, `camouflage`, `disguise` vs `detect_stealth` | Ambush on entry; a stealthy creature cannot be chosen as a target until it has struck (`unmasked`). |

**The four combat dimensions**

| Dimension | Property | Battle meaning |
|---|---|---|
| Luck | `luck`, `rerolls` | Already folded into accuracy, critical and evasion (`luckOps`, `rerolled`). Also: flee rolls, forage, resisting a status, initiative ties. `gamble`: a Gamble move, letters double or nothing against an opponent (`settleGamble`). |
| Size | `size`, stature | Reach and hitbox as `sizeOps` and `hitbox`: a giant is hit more easily (+10% to hit per point of stature over 1) and reaches the back line; a body under `SLIP_STATURE` gains the TINY evasion and cannot be chosen by a giant's melee. Over `DOOR_STATURE` it cannot follow through a door (5.5). `rideProblem` and `carries` decide mounts. |
| Control | `wobble` | Each point: 8% chance your chosen target is swapped for a random one (cap 60%). |
| | `reversed` | Your menu is mirrored: the action you pick resolves as its opposite pair (Attack and Defend swap, Flee and Advance swap). Shown, so it can be played round. |
| | `inflict_hypnosis` | The caster picks the victim's action for the status's rounds; it never targets the caster (`spares`). |
| | `inflict_leash` | The victim cannot flee, swap or be pushed back; SCISSORS carried cut it (`effect_status`). |
| | `magnetism` | Pulls metal-wearers (`isMetal`) to the front line each round. |
| Screen | `blind`, `amnesia`, `illiterate`, `censor`, `sleep` | The battle view obeys `SCREEN_RULES` as the HUD does: blind hides enemy bars and names (and accuracy ×0.3); amnesia hides move cards and the best strip; illiterate scrambles move names; censor blanks the battle log. `restores_panels` gives them back. |
| Knowledge | `read_properties` | 2: counters named in React. 5: the enemy's rack and gear shown. 8: what they can spell now, and whether their committed action is a word. Your SPY or ORACLE reads for you. |
| Speech | `ban_letters`, `spell_cost`, `word_limit`, `wild_letters`, `double_letters`, `misspell_ok`, `free_speech`, `silence`, `gag` | As `speechFor` now. Silence and gag: no spelling this round (`hamper.spells`). |

**Movement and upkeep**

| Property | Battle meaning |
|---|---|
| `speed_land`, `speed_air`, `speed_water`, `agility` | Initiative; flee chance; catching a fleer. |
| `speed_air` > 0, `hover` | Airborne row: only weapons whose `targets` include air reach it. |
| `upkeep_fuel`, `upkeep_power`, `food_need` | Drawn by real time. A stalled machine cannot fire (`stalled`); a hungry creature loses loyalty. |
| `seats` | A vehicle carries that many of your line inside its layer. |

**Auras and helpers**

| Property | Battle meaning |
|---|---|
| `heals` | End of round: that much to each of its side in the battle (`auras`). |
| `fear_aura` | Enemy creature morale down by it. |
| `luminosity` | Night does not halve your side's sight and accuracy. |
| `field_*`, `effect_*` | The word's own field or buff, in rounds. |
| `command_limit`, `authority`, `obedience`, `loyalty`, `courage`, `morale` | Bench size, line size, orders obeyed, routs. |
| `revives`, `raises` | Standing up a fallen master; the dead rising on the killer's side (`rise`). |
| `counters` | Reactions (3.3); door counters (KEY, RAM). |

**Property stats (buildings and claims)**

| Property of what you own | Battle meaning |
|---|---|
| `claim_radius` + shelter | If the ring is on your claim: `shelterOf` keeps that share of area and sky harm off your side. |
| `comfort` | On your claim: morale and regeneration (`homeComfort`). |
| Building fields | CHAPEL heals 2 a round and gives unholy resistance; STADIUM training +1; TAVERN morale +3, accuracy −0.1 for all. Already applied by `applyFields`. |
| Walk-in room (`interiorOf`) | Engaged inside your own building: a **siege battle**. The door (`DOOR_SHARE` of the building) stands as a shared layer in front of your whole side; `siege` multiplies on it; KEY, THIEF, RAM open it at a touch (`opensDoors`). |
| `storage_letters`, `entombs` | If you die, the rarest letters stay in your stores, not with the killer (`keepSafe`). |
| `produce_*` | Income continues during battle. |
| `command_limit`, `authority` on things you own | Count from anywhere on the map (`sources`), as now. |
| `sees_through`, `alarm`, `detect_*` | No ambush on you within its reach. |

### 5.2 Worked examples (values from `data/demo.json`)

Numbers use `landed`: what lands is `0.5 × felt(damage)`, where `felt` is the number itself up to
100 and `100 × √(x/100)` past it; bars show felt HP.

1. **SWORD** (`dmg_slash` 40, `attack_rate` 1, `attack_range` 1.5, nature metal).
   Move *Slash*: melee, one strike a round, lands 20 on a bare person (100 HP: five rounds).
   Against someone in ARMOR (`armor` 30, `res_slash` 0.6, metal ×0.75 to slash): 40 × 0.4 × 0.75 =
   12, less 30 armour: nothing, shown "resists". The card says so before you pick it.
2. **SHIELD** (`integrity` 300, `block` 0.6, `armor` 10, `res_blast` 0.5, `res_pierce` 0.4, wood).
   A layer of 173 felt HP in front of the body with a 60% block while it stands. Defend with it
   raises block to 0.9. Wood: fire lands ×2.5 on it ("weak!", as its card says now).
3. **BOW** (`dmg_pierce` 35, rate 0.6, range 60, `targets` land and air, two hands).
   Move *Shoot*: ranged, reaches the back line and flyers, strikes three rounds in five, first
   volley in round 1. Two hands: no shield.
4. **TANK** (vehicle: `integrity` 12,000, `armor` 200, `res_slash` 1, `res_pierce` 0.9,
   `dmg_blast` 1,200, rate 0.15, `attack_area` 6, `siege` 4, `speed_land` 18, `upkeep_fuel` 1,
   natures metal and machine).
   Outer layer of 1,095 felt HP that a sword cannot scratch. Move *Fire*: loads for seven rounds
   (shown "loading 3/7"), then a telegraphed blast that lands 173 on a person (a kill unless they
   Defend) and splashes the bodies beside the target. Weak to electric (×1.5 or more) and acid (×1.9). No
   fuel: it cannot fire. Initiative 18.
5. **HORSE** (mount: `integrity` 400, `speed_land` 18, `dmg_blunt` 60, rate 0.5, beast).
   Layer of 200 felt HP; initiative and flee speed 18 against a walker's 8; *Kick* every other
   round for 30.
6. **DRAGON** (`integrity` 60,000, `armor` 120, `dmg_fire` 2,500 + `dmg_slash` 900, rate 0.5,
   range 40, area 10, `speed_air` 45, `fear_aura` 9, `res_fire` 1, nature fire, `food_need` 5).
   Layer of 2,449 felt HP, airborne (melee without `targets` air cannot reach it). *Breath*
   every other round, telegraphed, whole enemy line. Fear 9 routs ordinary creatures in a
   round or two. Cold and water land ×2. It eats 5 food a minute; in the playtest it was starving
   within a minute of being spelled, and a starving mount turns wild.
7. **KNIGHT** (follower: `integrity` 700, `armor` 30, `block` 0.4, `dmg_slash` 60,
   `last_stand` 10, `loyalty` 9, `courage` 9, `command_limit` 6).
   265 felt HP, lands 30 a round, obeys orders, does not rout, fights four rounds past death
   (10 s over 3, rounded up), and adds six to the bench.
8. **MEDIC** (follower: `heals` 6, `field_radius` 10, cures sick and bleed, `revives` 0.5).
   End of each round: 6 HP to each of your side and those statuses ended; if you fall while it
   lives, you stand at half once.
9. **LASSO** (`inflict_leash` 10, range 12, rate 0.5, `command_limit` 4, cloth).
   Move *Rope*: ranged, every other round; on a hit the target is leashed for
   `statusSeconds("leash", 10)` = 26 s (nine rounds, capped at eight): it cannot flee or swap. SCISSORS carried by the
   victim end it.
10. **CLOVER** (`luck` +4) and **DICE** (`luck` +2, `rerolls` +1, `gamble` 6).
    Clover: +12% to hit, +12% critical, +8% evasion (`luckOps`), +12% to flee and forage. Dice add
    a reroll of each failed hit, critical and dodge roll, and a *Gamble* move: six letters, double
    or nothing.
11. **CHAPEL** (property: a claim with 25% shelter, `heals` 2, `comfort` 2, morale +2, unholy
    resistance +0.4, walk-in, door 800).
    Fought on its ground: your side heals 2 a round, keeps a quarter of sky and area harm off,
    and holds morale. Fought inside: a siege battle behind an 800 HP door.
12. **GIGANTIC WOLF** (adjective: `integrity` ×8, `size` ×3, `fear_aura` +4, `stealth` −10).
    335 felt HP (playtest preview), reach ×3 (hits the back line), easier to hit, cannot follow
    anyone through a door, no ambush.

### 5.3 Where the code goes

One pure function in a new `shared/src/battle.ts`:

```ts
movesOf(dict, unit: Unit, gear: Stats[], ground: GroundStats, statuses: Affliction[]): Move[]
```

It reads the tables above and nothing else. The battle view, the bots and the tournament all
call it. `inspect.ts` (`cardOf`, `leadStats`, `behaviours`) already turns the same properties
into card text and is reused for move cards.

---

## 6. Stats

Nothing is added to the data. The sheet a player sees for each combatant:

| Battle stat | From | Notes |
|---|---|---|
| HP (per layer) | `integrity` of vehicle, each protection, body; shown as `shown()` | `Unit.layers`, outermost first; what a broken layer did not absorb is lost |
| Attack | Σ `dmg_*` of `Unit.attack` × (1 + `training`/10) × (`strength`/5 if swung) | `armed` |
| Defence | `armor`, `res_*`, natures, make-up | `strike`, `damageShare` |
| Speed | `Walker.speed` (mount or body, land or air) × `time` × tempo | initiative, flee |
| Accuracy | `accuracy` (default 0.9) + luck; × `moraleAim` when shaken; − blind, drunk, curse | `strike` |
| Evasion | `evasion` + luck × 0.7; TINY +0.3 | `strike` |
| Block | `block` of the outer layer | `strike` |
| Critical | `critical` + luck; ×2 damage | `strike` |
| Rate | `attack_rate` × tempo | charge (2.3) |
| Reach | `attack_range`, `targets`, size | rows and air |
| Morale | `morale`, `courage`, enemy `fear_aura` | rout at 0 |
| Command | `commandLimit`, `authorityOf`, `obedience` | bench, line, orders |
| Insight | `read_properties` | what you are shown |
| Luck | `luck`, `rerolls` | every roll |
| Size | `size`, stature | reach, hitbox, doors, mounts |
| Lives | `prevents_death`, `last_stand` | section 7.4 |

Math reused as is: `strike` (hit roll, resistance, make-up, natures, armour, critical, felt and
`FIGHT_PACE`, shield, integrity), `strikeUnit` (layers), `windupOf`, `inflicts`, `afflict`,
`hampered`, `statusEffects`, `luckOps`, `sizeOps`, `massed`. The only new numbers are battle
constants: `ENGAGE_TILES`, `PARTY_TILES`, the round timers, the status seconds-to-rounds divisor,
the Defend factor, the flee curve and the fatigue ramp.

---

## 7. Flee, defend, statuses, outcomes

### 7.1 Flee

- Chance = `0.5 + 0.4 × log2(yourSpeed / fastestEnemySpeed)`, clamped 10% to 95%, plus 3% a point
  of luck, rerolled per `rerolls`, plus 15% for each failed try.
- Impossible while stunned, frozen, asleep, rooted, leashed, magnet-held, in a lockup
  (`holds`), or inside a ring whose door you do not own.
- Success: your whole side leaves, placed `FLEE_TILES` (6) away from the enemy (`runFrom`), with
  the engagement immunity. You drop two random letters in the ring (`takeLetters`). Creatures of
  yours slower than the fastest enemy stay behind and turn wild.
- Failure: you lose your action and take the round's blows without Defend.
- Flying or riding something fast makes fleeing easy, as it should; a LASSO or NET is the answer.

### 7.2 Defend

Section 2.4. It is the answer to telegraphed blows and to long words being spelled, and it
discounts your next word. A side that only defends loses to fatigue from round 10.

### 7.3 Statuses across rounds

- Duration: `statusSeconds(status, base)` (the stretch table in `status.ts`) divided by 3,
  rounded up. Blind 40 → 96 s → 32 rounds would outlast any battle, so: cap every status at 8
  rounds inside a battle; what is left when the battle ends continues on the map in seconds.
- Helpless statuses (stun, freeze, sleep, stasis): cap 2 rounds, then 2 rounds of immunity to
  that status. Sleep still breaks on a hit (`breaksOnHit`).
- Damage over time: the `dot` table per round (burn 8 fire, poison 5, bleed 6, sick 3), through
  resistances, not armour, as `sufferStatuses` does.
- Everything else is `STATUS_RULES` unchanged: slow halves tempo, rage adds strength and picks
  the nearest target for you, fear makes a creature rout and a person lose their action
  (resisted by `courage`), charm spares the charmer, confuse randomises the action, void nulls
  gear, doom takes `DOOM_SHARE` when it runs out, curse and bless move luck, debt pays letters.
- Buffs from verbs and consumables: `effectSeconds(duration)` over 3, cap 8 rounds.

### 7.4 Outcomes

- **Death** runs the existing `kill()`: extra lives first (`cheatDeath`, `useLife`: stand at full,
  untouchable for one round), then a last stand (`lastStandOf` seconds over 3 in rounds, enraged,
  unable to fall), then the fall.
- **The fallen** leave a GRAVE in the ring with the rarer half of their letters; the killer
  takes the commoner half, K or V, and their stores; gear drops in the ring; creatures go wild;
  `raises` raises them for the killer. All as now.
- **Ghost:** as now. A ghost may haunt a battle: its `haunts` words (BOO, CURSE) land as moves on
  a side, one every 12 s (`GHOST_GAP`), never harming.
- **Revive:** `revives` words and followers, as now.
- **Winner:** second wind (25% of body), 20 s immunity, the ring's loot at their feet.
- **Draw** (Parley or the round cap): no loot; everyone gets the immunity.
- **Duel** (`challenge`): cannot kill (`RING_FLOOR`); the pot goes to the winner.

---

## 8. Bots

Bots already choose by use (`bots.ts`: `Use`, `SKILL`), counter (`botCounter`), cure
(`botCure`), dodge (`botDodge`), flee (`botFlee`) and pick words from their rack (`botWord`).
A battle policy `botMove(state, me, skill, rng)` in `server/src/bots.ts` scores `movesOf`:

| Difficulty | Policy |
|---|---|
| easy | Attacks the nearest; uses the first weapon; never defends or swaps; flees never (`flee` 0); spells only when it has no weapon. |
| normal | Picks weapon and target by `damageShare`; defends against a telegraphed blow with chance `dodges` (0.65); counters with chance `counters` (0.6); flees under 25% HP; spells a better weapon or a creature when its rack allows. |
| hard | Expected-damage search one round deep over its moves and the visible enemy moves; always defends telegraphs (0.9); counters always; swaps into resistances; uses statuses and speech rules; flees at 35% if its speed allows. |

- Bot-only battles: 2 s a round.
- A bot's opening peace (it only defends early) stays: it does not engage before it would attack now.
- Tournaments (`server/loadtest/tournament.ts`) call `resolveRound` with no delay.

---

## 9. Netcode and server authority

**Stays:** Colyseus, one `WorldRoom` per map, 10 Hz tick, server authority, intents only,
sight-based views, the word data shipped as a static file.

**Changes:**

- **Battles live inside `WorldRoom`**, not in a second room. They need the walkers, letters,
  areas, dictionary and RNG, and a second room would have to copy all of it. A
  `battles: Map<string, Battle>` is stepped from `update` (a state machine: engage, plan, react,
  resolve, end). Cost is trivial: no path-finding, a handful of strikes a round.
- **`shared/src/battle.ts`**: pure and seedable, like the rest of `shared/`:
  `startBattle(sides, ground, rng)`, `movesOf(...)`, `legal(state, who, action)`,
  `resolveRound(state, choices, rng) → BattleEvent[]`, `fleeChance(...)`. Vitest covers it without
  a server; the client imports it for move cards and previews, never for outcomes.
- **Walker:** `battle?: string`, `engageUntil?: number`, `engagedBy?: Map<string, number>`.
  The real-time combat loop, `think`, `thinkBot`, `compel`, `walk` and `startGather` skip a walker
  with `battle` set. `strikeThing` and outside blows on it are refused.
- **State (`state.ts`):** a small `Battle` schema in the room state so spectators draw the ring:
  `x, y, radius, round, phase, deadline, sides` (names and HP percentages only). Fighters' own
  detail goes by private message, like `loadout`:
  - `battle` (full sheet: combatants, layers, statuses in rounds, moves, timers) on change;
  - `battleEvents` (the resolved round as an ordered list for the client to animate);
  - `battleReact` (the counter prompt).
- **Intents:** `battleAct { move, target?, text? }`, `battleOrder { creature, order, target? }`,
  `battleReact { text | null }`. Each is validated with `legal`; an illegal one is refused and the
  default (Defend) stands. A hidden commit is never sent to the other side before Resolve; at
  insight 8 the server sends only the category.
- **Spelling in battle** calls `spellWord` and `describeWord` with the walker pinned, so every
  word still acts through the shared systems; the battle wraps the result into events.
- **Timers** are the server's. Clients show the deadline from the state.
- **Reconnect:** `onReconnect` resends `battle`. Until then the bot mind plays.
- **Views:** fighters keep their map view (`refreshViews`) so the storm, threats and the minimap
  stay live under the battle screen.
- **Flag:** room option `combat: "realtime" | "turns"` read in `onCreate`, so both modes can be
  played and compared, and tests keep running in real time by default.

---

## 10. UI and art

### 10.1 Layout (Paper Diorama, 1280 × 800)

```
+--------------------------------------------------------------------------------+
| STORM closing 1:04   ROUND 4   order: [you][wolf][BOT3][tabby]      minimap     |
|--------------------------------------------------------------------------------|
|   torn-paper backdrop of the ring's biome (night tint, weather, your claim)     |
|                                                                                |
|   [bench tags]   WOLF   YOU+HORSE        ||        BOT3   TABBY   [bench tags] |
|                  bars   layered bars     ||        bars   bars                  |
|                                                                                |
|--------------------------------------------------------------------------------|
| log: BOT3's TABBY slashes you  -3     | move cards: ATTACK  DEFEND  ABILITIES   |
|      "weak!"  KNIGHT stands firm      |             SPELL   ITEMS   SWAP  FLEE  |
|--------------------------------------------------------------------------------|
|  best moves: PIKE weak!  ·  ADE heals      rack: [B][C][H][S][S][W]     0:07    |
+--------------------------------------------------------------------------------+
```

- A paper theatre: a proscenium of torn sheets, two wings, the stage floor in the ring's ground.
- The letter rack and the best strip stay where they are on the map HUD. Enter opens the same
  spell window. This is deliberate: it is still Last Word.
- Move cards reuse the kit-pick card look (`kits.ts`): a name, numbers first (`leadStats`), one
  line of what it does, and the matchup tag against the highlighted target.
- Layers are stacked paper strips over a standee, outermost on top: RIDE, ARMOR, body.
- Statuses are the existing badges (`paper.ts` `badge`), with rounds left.
- A telegraphed blow is the existing red closing ring on its target, with the striker's "!".
- The other side's spelling round shows face-down tiles flipping.
- Keys: 1 to 7 pick an action, arrows or a click pick a target, Enter spells, Esc backs out.
  Controller: the `pad.ts` scope pattern (one more `Scope`).

### 10.2 Reuse

- **Standees:** `renderStandee(lookOf(dict, phrase, count), opts)` drawn at 2.5 to 3 times map
  scale, facing in (`Placed.flip`). Generated word images (`raster.ts`, 2× source) are used where
  they exist, the drawn shape otherwise. Size, burning, frozen, ghost and count come from
  `look.ts` as on the map. No new art per word.
- **Backdrop:** the `terrain.ts` palette and sheet painter rendered as a side-on strip per biome;
  `sky.ts` for night and weather; `zones.ts` tissue for areas in force; `rooms.ts` planks for an
  interior.
- **Numbers and calls:** `fx.number` (crit!, weak!, resists, immune), `fx.luck`, `entrance` for a
  grand word, `RecapView` for the result.
- **Map side:** the ring is a `Zone` with a new kind; `main.ts` draws fighters inside it in two
  facing lines and hides their individual tags (which also fixes the tag pile there).

### 10.3 Animations (all code, tweens on canvases)

Lunge and recoil; ranged tracer; paper-tear flash on a hit; confetti burst on a critical; layer
strip ripping off when a layer breaks; wobble for drunk (`View.wobble`); flames (`paperFlame`);
frost and stone tints; a tile-flip for spelling; a curtain for the start and end.

### 10.4 Art budget

| Item | Count | How |
|---|---|---|
| Stage frame, wings, floor | 1 set | code |
| Biome backdrops | 12 biomes × day and night (tint) + interior | code, from the terrain palette |
| Hit effects by damage family | 8 (physical, fire, cold, electric, toxic and acid, blast, light and holy, dark, psychic and magic) | code |
| Status overlays | reuse the 35 badges; 6 body overlays (burn, freeze, sleep, root, leash, stun) | code |
| Move cards, turn-order chips, bars | 1 set | HTML and CSS, as the HUD |
| Larger portraits for common battlers | optional, top 200 creatures and mounts at 2× | `tools/art` pipeline, ahead of time |

No model call at runtime. The optional portraits are the only generated art and can be cut.

---

## 11. Balance risks and testing

| Risk | Why | Mitigation | Test |
|---|---|---|---|
| Third-partying the winner | Winner leaves hurt | Second wind, 20 s immunity, joiners act last | Tournament: share of winners killed within 30 s of a battle |
| Stalling | Heals, shields, Defend loops | Round cap 15, fatigue from round 10, timers | Share of battles reaching the cap (target under 5%) |
| One-shots | DRAGON lands 292 on a 100 HP body | Heavy blows always telegraphed; Defend dodges; long words take a spelling round | Share of person deaths in round 1 or 2 (target under 10%) |
| Flee too easy or too hard | Mounts and flight | Flee curve on speed; leash, root, net; two letters dropped | Flee success by speed ratio; share of battles ended by flight (target 10 to 25%) |
| Armour walls | SWORD does 0 to ARMOR | Matchup shown before you pick; Forage and income for a new word; fatigue | Share of rounds with zero damage both ways |
| Helpless locks | Stun 9 s, freeze | 2-round cap and immunity after | Longest run of skipped turns per battle |
| Screen statuses unfun | Blind for 96 s | 8-round cap; `restores_panels` words | Player survey; rate of cures spelled |
| Ambush too strong | Free round 0 | Only a round; `detect_stealth`, `alarm`, `sees_through` cancel | Win rate of ambusher at equal gear (target under 65%) |
| Letter snowball | Kills pay letters | Unchanged from today; grave keeps the rare half | Winner's rack against the median |
| Round too short for battles | 12-minute storm | Section 1.4 | Battles per survivor per round |
| 100 players wait on each other | Rings block paths | Rings are small (4 tiles); walk round them | Load test with 100 bots |
| Speech and counter abuse | Ban the letter they need | Already bounded by `free_speech`, counters, duration cap | Share of rounds where a side could spell nothing |
| Real-time PvE vs turn-based PvP seam | A wild animal attacks a pinned fighter | Wild creatures within 8 tiles of an engagement join as their own side for 3 rounds, then leave | Scripted tests |

Testing ladder:

1. **Unit tests** on `battle.ts` (Vitest): each mapping rule, each status cap, flee curve, order.
2. **Golden duels:** the existing `duel()` in `combat.ts` against `resolveRound` for 200 word
   pairs: damage per round must equal damage per second within rounding.
3. **Bot tournaments** (`loadtest/tournament.ts`, extended): 200 rounds of 8 and of 100 bots,
   mixed difficulty, real time against turns. Record rounds per battle, actions used, deaths by
   round number, win rate by kit job and by word archetype, hard-against-easy win rate (target
   70% or more, as a skill test), and the tables above.
4. **Matchup matrix:** every pair among the 300 most-spelled weapons, armours, mounts and
   creatures as a 1v1 battle with a fixed policy; flag any word winning over 90% of matchups and
   any pair that cannot hurt each other.
5. **Playwright sessions** with a human-like policy, as the playtests are run now, for feel and
   timers; screenshots of every phase.
6. **People.** Three to five friends for an hour, with a short form. Bots cannot report boredom.

---

## 12. Roadmap

Sizes are in agent batches (one branch and pull request each, as in `docs/EXPANSION_LOG.md`).

### Prototype: 3 batches. Goal: is a turn-based round fun at all?

1. `shared/src/battle.ts`: state, `movesOf` for Attack, Defend, one weapon, layers; charge and
   telegraphs; `resolveRound`; flee curve; golden-duel tests. No server.
2. Server behind `combat: "turns"`: battles only through the existing duel words (`challenge`),
   1v1, no creatures; `battle`, `battleEvents`, `battleAct`; a plain HTML battle panel over the
   map (bars, four buttons, the spell window).
3. Spelling as a move (objects and verbs), a bot policy at normal, and a tournament column.

Decision point: play it. If a duel with spelling is not better than the real-time fight, stop.

### MVP: 7 batches. Goal: every PvP fight in a round is a battle.

4. Engagement on lock-on: engage wind-up, ring `Zone`, pinning, protection from outside,
   immunity timers, round cap and fatigue.
5. Party: line and bench, creatures acting by themselves, one order a round, swap, mount and
   dismount, morale and rout.
6. Words in battle in full: events, adjectives, fields and weather as battle fields, spelling
   rounds for long words, the React phase.
7. Statuses in rounds, items, death, lives, last stand, graves, loot, ghosts watching, revive.
8. Battle view art pass 1: stage, backdrops, standees, bars, move cards, eight hit effects,
   telegraph, log, timers; map-side ring drawing.
9. Bots at three difficulties; storm damage in rings; the end-of-round rule; third parties joining.
10. Tournaments, the matchup matrix, tuning, controller scope, a tutorial tip set (`tips.ts`).

### Full: 8 to 10 batches.

- Siege battles and interiors; buildings raised in the ring.
- Control and screen dimensions in the battle view; knowledge tiers; speech rules shown.
- Outside areas landing in rings; wild creatures joining.
- Allies and pacts, Parley, mutiny words.
- Ghost haunting in battles; spectators' battle view.
- Art pass 2: optional portraits, per-biome set dressing, entrances for grand words, curtain.
- Recap of a battle (round by round), metrics, more tournaments.
- Longer rounds and 100-player tuning.

### What to cut if scope must shrink (first to go at the top)

1. Outside areas landing in rings; wild creatures joining.
2. Third parties joining (rings become closed).
3. The React phase (counters become ordinary moves on your own turn).
4. Orders to creatures (they only act by themselves).
5. Siege battles (a fighter indoors cannot be engaged until the door is broken in real time).
6. Parley, Forage, Gamble.
7. Art: portraits, per-biome dressing; one backdrop tinted by biome colour.
8. Rows and air (everyone can hit everyone).

Do not cut: spelling as a move, telegraphed heavy blows with Defend, the ring on the real map
under the storm. Without those it is a generic RPG battle.

---

## 13. Success metrics

All from the server, logged per round and printed by the tournament tool; the human numbers
from a small event log (no accounts needed: per session).

| Goal | Metric | How measured | Target |
|---|---|---|---|
| Play time | Median minutes a person survives; minutes per session | `dead` and `roundover` times; session length from join to leave | Survival median up by half against real time; session up by a third |
| | "Start new round" rate after death | `playAgain` clicks over deaths | Up |
| | Time to first battle; battles per person per round | battle log | First within 4 minutes; 2 or more |
| Meaningful builds | Win rate spread by kit job and by gear archetype | tournament | No job over 20% or under 5% in 8-player rounds; no archetype over 60% in the matrix |
| | Share of battles won by the side with less total felt HP | battle log | 25 to 40% (build and play beat bulk) |
| | Distinct words spelled in battle per round | spell log | Up against real-time fights |
| | Share of battles where a "weak!" or "resists" matchup decided the damage lead | events | 30% or more |
| Strategy and depth | Action mix: share of actions that are not Attack | battle log | 35% or more for people, 25% for hard bots |
| | Entropy of actions per battle | battle log | Rising with difficulty |
| | Defends that dodged a telegraphed blow; counters spelled | events | Each in a third of battles |
| | Hard bots against easy bots | tournament | Hard wins 70% or more of battles at equal gear |
| | Rounds per battle | battle log | Median 6 to 10; under 5% at the cap |
| Health | Timeouts per round; flee share; deaths in round 1 or 2 | battle log | Under 5%; 10 to 25%; under 10% |

Compare every number between `combat: "realtime"` and `combat: "turns"` on the same seeds.

---

## 14. Open questions for the user

1. **Replace or coexist?** Should turn-based battles replace real-time PvP entirely (this plan),
   or exist only as duels at first? TODO.md "Decided" says combat is resolved in world ticks.
2. **Forced or opt-in?** The plan forces battles with a 2 s chance to run. Is that right for you?
3. **Round length and lobby size.** Battles add about a minute each. Stretch the storm to about
   18 minutes? Is 100 players with "constant PvP" still the aim, or are 8 to 20 better for this?
4. **The finale.** One last shared battle for whoever is left, or real time for the last circle?
5. **Third parties.** May others join a battle in progress (battle royale chaos), or are rings
   closed (cleaner, fairer)?
6. **Death.** Keep full wipe and knock-out on losing a battle, or allow yielding for a price?
7. **Art ambition.** Code-drawn only, or a budget for generated larger portraits?
8. **Hunting and bosses.** Stay real time (the plan), or also become battles later?

---

## 15. What the same day's playtest means for this plan

Four things seen in play on the live build would carry straight into battles, because battles
reuse the same rules. Settle them before or during the prototype:

1. **Layers swallow any blow.** "Whatever a destroyed layer did not absorb is lost" (`Unit`):
   in play a NUKE at ground zero cost its speller one ARMOR and nothing else, and a bot two tiles
   off survived in a BEANIE. In a battle every hat would be a free dodge of the biggest blow.
   Proposal: what a broken layer did not absorb carries on at half.
2. **Helpless statuses refresh without limit.** A bot with an ELBOW (stun 1 s, stretched to 3 s,
   one blow a second) held a player stunned for 140 s; a worn HELMET (`immune_stun`) did not help,
   because immunities on worn things are not lent to the body (`wear.ts` `LENT_ADD`). Section 7.3's
   two-round cap and immunity window fix it in battle; the map needs the same rule.
3. **Ghosts.** Six bot ghosts kept the last living player under nine to twelve statuses for
   minutes. In battles a ghost's word should land on one combatant, cap at two rounds, and never
   be a helpless status.
4. **Sky words.** One STORM at 0:15 killed all seven bots (round over at 5:30). A battle ring
   under such a word needs the shelter and per-strike cap the map needs too (no single area strike
   over a third of a person's health).

---

## 16. Fork decisions (the `turn-based` branch)

The fork is built on these defaults. The user may overrule any of them; each is one constant or
one branch in the code.

| # | Question | Fork default | Why |
|---|---|---|---|
| 1 | Replace or coexist? | Coexist. A room option `combat: "realtime" \| "turns"`; the fork defaults to `turns`, `main` stays real time. Duels first (prototype), every PvP fight from MVP batch 4. | Both modes run on the same seeds, so the numbers in section 13 can be compared. |
| 2 | Forced or opt-in? | Forced, with the 2 s engage wind-up to run from and the immunity timers after. | Pure opt-in lets the weaker player refuse every fight; that kills a battle royale. |
| 3 | Round length and lobby size | The storm schedule runs 1.5 times as long in `turns` (18 minutes); tune for 8 to 20 players. | A battle adds about a minute; 100 players waiting on rings is not this game. |
| 4 | The finale | One last shared battle: no new battle in the final closing, whoever is left fights together with fatigue from round 1. | The dramatic option, and it cannot stall. |
| 5 | Third parties | Open rings: others join at a round boundary as a new side, acting last; cap 4 sides. | Battle royale chaos over tidy duels; second wind and immunity protect the winner. |
| 6 | Death | Full wipe and knock-out, as now. No yielding for a price: Flee is the way out, and duels (`challenge`) stay the non-lethal fight. | Keeps "Decided": death is a full wipe. |
| 7 | Art ambition | Code-drawn only. No generated portraits. | No paid API; standees and the terrain palette already exist. |
| 8 | Hunting and bosses | Stay real time. | PvE is the map game; battles are for people. |

Prototype rulings (smaller points the plan left open, settled while building):

- **Charge.** Starts at 0 and gains `attack_rate × tempo` at the start of every round; a strike
  spends 1. Unspent charge is kept up to one round's worth. This gives exactly the cadences of
  section 2.3 (WOLF's second strike every fifth round, TANK on the seventh).
- **Heavy blows.** Announced in the round they are chosen, land in the next at the striker's turn,
  whatever else the striker does that round; no charge is gained while one hangs (the wind-up's
  second). Defend in the landing round and it misses.
- **Statuses** pass at 3 s a round with one round's damage over time (section 7.3's divisor); the
  diminishing returns that `main` now has (`Walker.resist`) stand in for the helpless cap until
  MVP batch 7.
- **Fleeing a duel** gives up the pot (as `forfeit`); the two dropped letters are for battles
  that are not duels.
