#!/usr/bin/env python3
"""Write ../data/properties.json, archetypes.json, letters.json, operators.json.

Run after build_lexicon.py (letters.json and operators.json read lexicon.tsv).
Property rows are  id | type | default | unit | meaning.
Types: num (real-world unit), scale (0-10), frac (0-1), bool, enum, tags, text.
Any num/scale/frac may also hold "ABS" (absolute: infinite / total).
"""
import os, json, collections
from build_lexicon import ANCHORS, ARCH_CLASS, NOUN, VERB, ADJ

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

DAMAGE = ("blunt slash pierce crush fire cold electric acid poison radiation blast sonic light dark "
          "water wind earth psychic holy unholy disease magic suffocation hunger").split()
MEDIA = "land water air underground space".split()
STATUS = "stun slow blind fear burn freeze poison bleed sleep charm silence root confuse shrink".split()

GROUPS = {}
GROUPS["physical"] = """
mass|num|1|kg|weight; drives carrying, knockback, crushing
length|num|1|m|longest dimension
height|num|1|m|vertical size; blocks sight above 2
footprint|num|1|tiles|ground area occupied
volume|num|0|m3|interior or bulk volume
integrity|num|10|hp|damage it takes before it is destroyed
hardness|scale|3||resists cutting and piercing
sharpness|scale|0||cutting ability of its edges or points
brittleness|scale|2||chance to shatter from blunt or crush damage
elasticity|scale|1||bounces or absorbs impact
density|num|1000|kg/m3|sinks above 1000
buoyancy|scale|0||floats and carries load on water
temperature|num|20|C|its own temperature
melting_point|num|1000|C|destroyed or liquefied above this
freezing_point|num|-100|C|frozen solid below this
flammability|scale|1||how easily it ignites
burn_time|num|0|s|how long it burns once lit
conductivity|scale|1||passes electricity to whatever touches it
magnetism|scale|0||pulls or is pulled by metal
radioactivity|scale|0||radiation damage per tick to things nearby
toxicity|scale|0||poison damage when touched or eaten
corrosiveness|scale|0||dissolves what it touches
wetness|scale|0||douses fire, conducts electricity
stickiness|scale|0||slows what touches it
slipperiness|scale|0||makes movers slide
transparency|frac|0||fraction of sight that passes through
luminosity|scale|0||light it gives off
reflectivity|scale|1||bounces light and light damage
loudness|scale|0||noise it makes; reveals position
odor|scale|0||smell it gives off; reveals position
state|enum|solid|solid,liquid,gas,plasma,energy,none|state of matter
material|tags|||what it is made of (wood, steel, flesh, stone ...)
shape|enum|irregular|irregular,flat,round,long,hollow,pointed,sheet,pile|rough form
color|text|||dominant color
edible|bool|false||can be eaten
nutrition|num|0|food|food value when eaten
potency|scale|0||strength of its drug, medicine or alcohol effect
decay_rate|num|0|hp/min|integrity lost per minute on its own
age|num|0|min|time since it was spelled
beauty|scale|3||attracts and pleases; raises NPC attitude
value|num|1|coins|price NPC markets pay
"""
GROUPS["mobility"] = "\n".join(
    [f"speed_{m}|num|0|m/s|top speed moving through {m}" for m in MEDIA] + """
acceleration|scale|3||how fast it reaches top speed
agility|scale|3||turning and dodging while moving
climb|scale|0||crosses cliffs and walls
jump|num|0|m|gap or height it can leap
flight_ceiling|num|0|m|maximum altitude
dive_depth|num|0|m|maximum depth under water
hover|bool|false||can stay still in the air
phase|bool|false||passes through solid objects
teleport_range|num|0|m|instant relocation distance
range|num|0|km|distance before it needs refuelling or rest
carry_capacity|num|0|kg|load it can move
seats|num|0||riders or passengers it holds
tow_capacity|num|0|kg|load it can pull
mountable|bool|false||a character can ride it
self_propelled|bool|false||moves without being carried or pushed
requires_runway|bool|false||needs flat open tiles to take off
requires_road|bool|false||moves only on routes
requires_pilot|bool|true||needs a rider to act
terrain_ignored|tags|||terrain types that do not slow it
portable|bool|true||can be picked up and carried
""".strip().split("\n"))
GROUPS["offence"] = "\n".join(
    [f"dmg_{d}|num|0|hp|{d} damage per hit" for d in DAMAGE] +
    [f"inflict_{s}|num|0|s|seconds of {s} applied on hit" for s in STATUS] + """
attack_rate|num|0|hits/s|how often it strikes
attack_range|num|1|m|reach of its attack
attack_area|num|0|m|blast or sweep radius around the target
attack_windup|num|0|s|delay before the first hit
accuracy|frac|0.9||chance a hit lands before evasion
critical|frac|0||chance of a double-damage hit
armor_pierce|frac|0||fraction of armor ignored
siege|num|1|x|damage multiplier against structures
knockback|num|0|m|distance targets are pushed
targets|tags|land||layers it can hit (land, water, air, underground)
multi_target|num|1||separate targets hit per strike
ammo_per_hit|num|0||ammunition used each strike
ammo_type|text|||word class it fires
single_use|bool|false||destroyed when it attacks
self_damage|frac|0||fraction of its damage dealt to itself or its user
friendly_fire|bool|false||area damage also hits its owner's things
lifesteal|frac|0||fraction of damage returned as integrity
lingering|num|0|min|how long its damage stays on the tile
ignores_resistance|bool|false||attack absolute: bypasses res_* and armor
""".strip().split("\n"))
GROUPS["defence"] = "\n".join(
    [f"res_{d}|frac|0||fraction of {d} damage ignored (ABS = immune)" for d in DAMAGE] +
    [f"immune_{s}|bool|false||cannot be affected by {s}" for s in STATUS] + """
armor|num|0|hp|flat damage removed from each hit
evasion|frac|0||chance to avoid a hit entirely
block|frac|0||chance to stop a hit from the front
shield_pool|num|0|hp|absorbs damage before integrity
shield_regen|num|0|hp/s|shield_pool restored per second
regeneration|num|0|hp/s|integrity restored per second
reflect|frac|0||fraction of damage sent back
thorns|num|0|hp|damage dealt to melee attackers
stealth|scale|0||how hard it is to see
camouflage|tags|||terrain types where stealth doubles
cover|frac|0||damage reduction it gives things behind or inside it
untargetable|bool|false||cannot be chosen as a target
indestructible|bool|false||defence absolute: integrity cannot reach 0
""".strip().split("\n"))
GROUPS["perception"] = """
sight_range|num|10|m|how far it sees
hearing_range|num|10|m|how far it detects loudness
smell_range|num|0|m|how far it detects odor
night_vision|bool|false||sees without light
sees_through|tags|||things its sight ignores (walls, fog, water)
detect_stealth|scale|0||cancels this much stealth
detect_underground|bool|false||sees burrowed and buried things
detect_letters|num|0|m|range at which it shows letter sources
detect_life|num|0|m|range at which it shows living things
read_properties|scale|0||how much of another player's stats it reveals
read_inventory|bool|false||shows letters another player holds
map_reveal|num|0|tiles|radius of map uncovered around it
tracking|scale|0||follows targets that left sight
alarm|bool|false||warns its owner when enemies enter sight
"""
GROUPS["life"] = """
alive|bool|false||is a living thing
sentient|bool|false||can follow orders and use words
intelligence|scale|0||quality of its own decisions
loyalty|scale|5||resists being charmed, bribed or stolen
aggression|scale|0||attacks without being told to
courage|scale|5||resists fear
obedience|scale|5||how reliably it follows orders
diet|enum|none|none,herbivore,carnivore,omnivore,scavenger,photosynthesis,fuel,power|what it must consume
food_need|num|0|food/min|food it eats
water_need|num|0|l/min|water it drinks
sleep_need|frac|0||fraction of time it must rest
lifespan|num|0|min|dies of age after this (0 = never)
growth_time|num|0|min|time to reach full size
reproduction|num|0|/hour|copies of itself it makes when fed
tamable|bool|false||a wild one can be claimed
trainable|scale|0||gains ability from use
pack_size|num|1||how many arrive when one is spelled without a plural
venomous|bool|false||its bite or sting poisons
nocturnal|bool|false||active at night
habitat|tags|||terrain where it thrives
temp_min|num|-10|C|takes cold damage below this
temp_max|num|40|C|takes fire damage above this
breathes|enum|air|air,water,both,none|what it needs to breathe
hands|bool|false||can hold tools and weapons
speech|bool|false||can trade, negotiate and command
heals|num|0|hp/s|integrity it restores to allies in reach
morale|scale|5||fights worse when low; flees at 0
"""
GROUPS["economy"] = "\n".join(
    [f"produce_{chr(c)}|num|0|/min|letter {chr(c)} it generates" for c in range(65, 91)] + """
production_needs|tags|||inputs it must be supplied to produce
harvest_bonus|num|1|x|multiplier on letters gathered by hand nearby
harvest_sources|tags|||source types the bonus applies to
upkeep_food|num|0|food/min|food to keep it working
upkeep_fuel|num|0|fuel/min|fuel to keep it working
upkeep_power|num|0|kW|power to keep it working
food_output|num|0|food/min|food it supplies
fuel_output|num|0|fuel/min|fuel it supplies
power_output|num|0|kW|power it supplies
water_output|num|0|l/min|water it supplies
storage_letters|num|0||letters it holds safely
storage_objects|num|0|kg|objects it holds
security|scale|0||resists theft and raiding of its contents
reclaim_rate|frac|0||fraction of letters returned from objects destroyed in reach
reclaim_range|num|0|m|reach of reclaim_rate
transmute_in|num|0||common letters consumed per rare letter made
trade_bonus|frac|0||better prices at NPC markets
labor|num|0|work/min|work it performs for stations and fields
build_speed|num|1|x|multiplier on placing structures
craft_slots|num|0||stations or processes it can run at once
""".strip().split("\n"))
GROUPS["spatial"] = """
tile_type|enum|none|none,water,deep_water,hill,mountain,pit,forest,field,sand,snow,swamp,lava,road,floor,wall|terrain it creates
radius|num|0|tiles|size of the terrain or area it creates
elevation|num|0|m|height it raises the ground
depth|num|0|m|depth it lowers the ground or holds water
blocks|tags|||what cannot pass (land, water, air, sight, projectiles)
movement_cost|num|1|x|slowdown for things crossing it
fertility|scale|0||growth multiplier for flora on it
moisture|scale|0||water it adds to tiles around it
placeable_on|tags|land||terrain it can be spelled onto
needs_foundation|bool|false||must sit on floor or flat ground
enterable|bool|false||characters can go inside
occupants|num|0||characters and creatures it shelters
lockable|bool|false||only its owner may enter or open it
stackable|bool|false||can be placed on top of another structure
spread_rate|num|0|tiles/min|how fast it grows into neighbouring tiles
persistence|num|0|min|how long it lasts (0 = permanent)
claim_radius|num|0|tiles|territory it claims for its owner
placement|enum|self|self,target,sky,region,map|where it appears: at the speller, on a chosen target, overhead, over an area, everywhere
placement_range|num|0|m|how far from the speller a target or area may be
"""
GROUPS["social"] = """
authority|scale|0||NPCs and lesser units obey its owner
command_limit|num|0||units it lets its owner control
fear_aura|scale|0||lowers enemy morale in sight
charm|scale|0||raises NPC attitude and trade prices
intimidation|scale|0||makes NPCs yield letters or territory
recruit_rate|num|0|/min|NPCs it draws to its owner
tax_rate|frac|0||share of NPC letter income it collects
law|tags|||acts it forbids inside its claim
binds|num|0||players it can hold to an agreement
bind_penalty|tags|||what breaking the agreement costs
faction|text|||group it belongs to or creates
reputation|num|0||standing change with NPCs while owned
"""
GROUPS["slots"] = """
adjective_slots|num|1||adjectives it can carry
grants_adjective_slots|num|0||extra adjective slots it gives its owner's nouns
grants_slots_to|tags|||noun classes that receive the extra slots
equip_slot|enum|none|none,head,face,neck,body,back,hands,feet,finger,held,graft,mount,companion|where a character wears or uses it
hands_required|num|0||hands needed to wield it
grants_equip_slots|tags|||extra equip slots it gives its wearer
companion_slots|num|0||extra companions it lets its owner keep
container_slots|num|0||objects it can hold inside itself
plural_count|num|3||how many appear when the plural is spelled
"""
GROUPS["meta"] = """
is_absolute|bool|false||sets a property to ABS instead of scaling it
absolute_side|enum|none|none,attack,defence|attack absolutes beat defence absolutes
specificity|num|0||depth in the word tree; specific beats general among absolutes
counters|tags|||words, classes or properties it specifically defeats
strips_adjectives|num|0||adjectives it removes from a target
copies|bool|false||becomes a copy of its target
negates|tags|||properties it resets to default on a target
silences|num|0|m|radius in which verbs cannot be cast
letter_refund|frac|0||fraction of its own letters returned when it is destroyed
letter_steal|num|0||letters taken from a target's stores per hit
duplicates|num|0||extra copies made of the next word spelled
extends_duration|num|1|x|multiplier on durations of timed words
on_owner_death|enum|drop|drop,vanish,explode,pass_to_heir,revive_owner|what it does when its owner dies
survives_death|bool|false||stays with a successor instead of becoming loot
prevents_death|num|0||deaths it absorbs before it is used up
locks|bool|false||its target cannot be dismantled, moved or stolen
"""
GROUPS["field"] = """
field_radius|num|0|m|reach of the aura or condition (ABS = whole map)
field_targets|enum|all|self,owned,allies,enemies,living,objects,all|what it affects
field_property|text|||property it changes on everything in reach
field_delta|num|0||amount added to that property
field_multiplier|num|1|x|multiplier applied to that property
field_duration|num|0|min|how long it lasts (0 = while the word exists)
light_delta|scale|0||change to light level
temperature_delta|num|0|C|change to ambient temperature
visibility|num|1|x|multiplier on all sight ranges
growth|num|1|x|multiplier on flora and creature growth
contagion|frac|0||chance per minute it spreads to a neighbour
sets_daylight|enum|none|none,day,night|forces day or night in its field
sets_weather|text|||weather it starts in its field
clears_weather|tags|||weather it ends in its field
"""
GROUPS["event"] = """
event_target|enum|object|object,creature,character,structure,tile,region,faction,map|what the event is dropped on
event_radius|num|0|m|area around the target it also affects
event_duration|num|0|min|how long the event runs (0 = instant)
transfers_ownership|bool|false||the target becomes the speller's
destroys_target|bool|false||the target is destroyed outright
contest_with|text|||speller's property that powers the event
contested_by|text|||target's property that resists it
sets_hostile|bool|false||everything in the area fights everything not its own
frees_target|bool|false||the target stops belonging to anyone
moves_target|num|0|m|distance the target is carried toward the speller
"""
GROUPS["effect"] = """
cast_time|num|0|s|delay between spelling and effect
duration|num|0|s|how long the effect lasts (0 = instant)
effect_target|enum|self|self,held,mount,companion,touched|what a verb acts on
effect_property|text|||property it changes
effect_delta|num|0||amount added to that property
effect_multiplier|num|1|x|multiplier applied to that property
effect_status|tags|||status effects it applies or removes
restores|num|0|hp|integrity restored
"""

# Which property groups an archetype class normally fills in. Everything else stays at default.
CLASS_GROUPS = {
    "artifact": "physical mobility offence defence perception economy spatial slots".split(),
    "creature": "physical life mobility offence defence perception economy social slots".split(),
    "person": "physical life mobility offence defence perception economy social slots".split(),
    "flora": "physical life economy spatial".split(),
    "terrain": "physical spatial economy".split(),
    "material": "physical economy".split(),
    "consumable": "physical effect".split(),
    "bodypart": "physical slots mobility offence defence perception".split(),
    "world_state": ["field"], "aura": ["field"], "affliction": ["field", "offence"],
    "knowledge": ["economy", "meta"], "institution": ["social", "economy", "meta"],
    "event": ["event", "offence", "field"], "measure": ["meta"], "modifier": ["meta"], "spell": ["effect"], "verb_modifier": ["effect"],
}

# All 26 letters: class and how each is generated.
LETTERS = {
    "E": ("vowel", "foraged anywhere"), "A": ("vowel", "crop fields on tilled land"),
    "I": ("vowel", "livestock and pets"), "O": ("vowel", "water: wells, lakes, fishing"),
    "U": ("vowel", "caves and fungus"), "Y": ("vowel", "age of surviving objects"),
    "L": ("core", "per tile of land held"), "S": ("core", "per NPC citizen in controlled cities"),
    "T": ("core", "per completed trade"), "R": ("core", "road and route segments held"),
    "N": ("core", "hired NPC labour"),
    "B": ("made", "base furniture"), "C": ("made", "crafting stations"),
    "M": ("made", "machines that convert vowels"), "G": ("made", "quarries and digging"),
    "D": ("made", "destroying objects and structures"), "F": ("made", "burning objects"),
    "H": ("made", "hunting wild creatures"), "P": ("made", "planted flora, harvested on a cycle"),
    "W": ("made", "windmills and watermills, varying with weather"),
    "V": ("made", "winning fights against player-owned objects"),
    "K": ("made", "kills of NPCs or players"),
    "J": ("rare", "exploring undiscovered tiles"), "X": ("rare", "buried caches and ruins"),
    "Q": ("rare", "one unique site per map"), "Z": ("rare", "boss drops and transmutation"),
}

# Seed absolutes: adjective -> (side, property it sets to ABS). Checked against the lexicon.
ABSOLUTES = {
    "irresistible": ("attack", "ignores_resistance"), "unstoppable": ("attack", "ignores_resistance"),
    "unerring": ("attack", "accuracy"), "inescapable": ("attack", "accuracy"),
    "lethal": ("attack", "critical"), "omnipotent": ("attack", "ignores_resistance"),
    "indestructible": ("defence", "indestructible"), "invincible": ("defence", "indestructible"),
    "invulnerable": ("defence", "indestructible"), "unbreakable": ("defence", "indestructible"),
    "impenetrable": ("defence", "armor"), "impregnable": ("defence", "armor"),
    "immortal": ("defence", "lifespan"), "undying": ("defence", "lifespan"),
    "invisible": ("defence", "stealth"), "undetectable": ("defence", "stealth"),
    "untouchable": ("defence", "untargetable"), "intangible": ("defence", "evasion"),
    "immovable": ("defence", "mass"), "fearless": ("defence", "courage"),
    "tireless": ("defence", "sleep_need"), "incorruptible": ("defence", "loyalty"),
    "fireproof": ("defence", "res_fire"), "waterproof": ("defence", "res_water"),
    "bulletproof": ("defence", "res_pierce"), "shockproof": ("defence", "res_electric"),
    "soundproof": ("defence", "res_sonic"), "bombproof": ("defence", "res_blast"),
    "rustproof": ("defence", "res_acid"), "airtight": ("defence", "res_suffocation"),
    "infinite": ("none", "integrity"), "endless": ("neutral", "persistence"),
    "eternal": ("none", "persistence"), "bottomless": ("neutral", "storage_letters"),
    "limitless": ("none", "range"), "omniscient": ("neutral", "read_properties"),
    "omnipresent": ("none", "field_radius"), "weightless": ("neutral", "mass"),
    "instant": ("none", "cast_time"), "silent": ("neutral", "loudness"),
}
# Comparative and superlative forms reuse the base adjective's operations at a higher degree:
# a multiplier f becomes f ** degree and an added amount a becomes a * degree. Absolutes do not grade.
DEGREES = {"positive": 1, "comparative": 1.5, "superlative": 2}
OPERATIONS = {
    "mul": "multiply a numeric property", "add": "add to a numeric property",
    "set": "set a property to a value", "abs": "set a property to ABS",
    "tag": "add a tag", "untag": "remove a tag", "reset": "return a property to its default",
}

def main():
    props, seen = [], set()
    for group, text in GROUPS.items():
        for line in text.strip().split("\n"):
            pid, typ, default, unit, desc = line.split("|")
            assert pid not in seen, pid
            seen.add(pid)
            p = {"id": pid, "group": group, "type": typ, "desc": desc}
            if typ == "enum":
                p["values"] = unit.split(",")
            elif unit:
                p["unit"] = unit
            if typ in ("num", "scale", "frac"):
                p["default"] = float(default) if "." in default else int(default)
            elif typ == "bool":
                p["default"] = default == "true"
            elif typ == "tags":
                p["default"] = [default] if default else []
            else:
                p["default"] = default
            props.append(p)
    for _, target in ABSOLUTES.values():
        assert target in seen, target
    by_group = collections.Counter(p["group"] for p in props)

    rows = [l.rstrip("\n").split("\t") for l in open(os.path.join(OUT, "lexicon.tsv"))][1:]
    arch_n = collections.Counter((r[2], r[3]) for r in rows)
    archetypes = [{"class": c, "archetype": a, "words": n, "groups": CLASS_GROUPS[c]}
                  for (c, a), n in sorted(arch_n.items(), key=lambda kv: (kv[0][0], -kv[1]))]

    words = {r[0] for r in rows}
    share = collections.Counter(ch for w in words for ch in w.upper())
    total = sum(share.values())
    letters = [{"letter": L, "class": c, "source": s, "lexicon_share": round(share[L] / total, 4)}
               for L, (c, s) in sorted(LETTERS.items(), key=lambda kv: -share[kv[0]])]
    assert len(letters) == 26

    adj = {r[0] for r in rows if r[1] == "adjective"}
    absolutes = [{"word": w, "side": s, "property": p} for w, (s, p) in ABSOLUTES.items() if w in adj]
    missing = [w for w in ABSOLUTES if w not in adj]
    proof = sorted(w for w in adj if w.endswith("proof") and w not in ABSOLUTES)

    dump = lambda name, obj: json.dump(obj, open(os.path.join(OUT, name), "w"), indent=1)
    dump("properties.json", {"count": len(props), "groups": dict(by_group), "damage_types": DAMAGE,
                             "media": MEDIA, "status_effects": STATUS, "properties": props})
    dump("archetypes.json", archetypes)
    dump("letters.json", letters)
    dump("operators.json", {"operations": OPERATIONS, "degrees": DEGREES, "absolutes": absolutes,
                            "unassigned_proof_adjectives": proof})
    print(len(props), dict(by_group)); print("archetypes", len(archetypes))
    print("absolutes", len(absolutes), "missing:", missing, "| other -proof:", proof)
    print(" ".join(f"{l['letter']}{l['lexicon_share']*100:.1f}" for l in letters))

if __name__ == "__main__":
    main()
