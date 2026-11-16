#!/usr/bin/env python3
"""Generator rules: properties a word gets from what it already is, across the whole dictionary.

build_demo.py calls `derive(out, wordnet_dir)` after reading demo_words.txt, generated_words.txt
and producers.txt, before writing data/demo.json. Every rule reads only a word's class, archetype,
its own properties and its WordNet meaning (hypernyms and gloss), never its name, and never
overrides a value a word already sets: hand-written and generated words keep what they say.

The four concept dimensions (TODO.md "Concept batch: combat"):

- nature: what kind of body a noun is for damage (shared affinity.ts holds the matrix). From the
  class and archetype (a mammal is a beast, a fern a plant), the materials it is made of (steel
  is metal, oak wood), its own properties (phase or no mass: a spirit; holy damage: holy; 600 C:
  fire) and WordNet (an evil spirit is a demon, a zombie undead). Adjectives whose meaning names
  a nature (FIERY, GHOSTLY, HOLY, UNDEAD) add it to what they describe; aura words with a
  protective meaning (holiness, warmth) give resistances to whoever they reach.
- size: any word whose operations scale height, length or mass (TINY, HUGE, GROW, SHRINK,
  a potion) scales `size` by the same factor (height first, then length, then mass^(1/3)).
- luck: words meaning good or bad fortune move `luck`; games of chance give `rerolls` (held) or
  a `gamble` (spelled acts and verbs).
- control: alcoholic drinks and drunken adjectives `wobble`; disorienting words that mean turning
  around reverse controls; mind control that charms hypnotizes; cords, ropes and tentacles that
  bind leash their victim to the striker; magnets pull metal; cures by meaning (sobering,
  waking, cutting cords).

`python derive.py <wordnet dict dir>` (or build_demo.py --audit) prints what each rule hooked in.
"""
import os, re, sys, json, collections
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "..", "data")
sys.path.insert(0, HERE)

# --- natures ------------------------------------------------------------------------------------

# Material tags (the `material` property, and material nouns' own WordNet meaning) by family.
MATERIAL_NATURE = {
    "metal": "steel iron brass gold copper aluminum aluminium silver bronze tin lead nickel titanium wire metal chrome "
             "chromium zinc platinum pewter mercury tungsten cobalt magnesium uranium plutonium alloy",
    "wood": "wood oak pine cedar bamboo straw thatch cork wicker timber log ebony mahogany birch willow maple teak plank",
    "paper": "paper cardboard parchment papyrus",
    "stone": "stone brick concrete marble earth clay tile asphalt sand mud dirt granite rock gravel cement plaster chalk "
             "slate flint mortar sandstone limestone basalt obsidian",
    "glass": "glass porcelain ceramic crystal gem diamond fiberglass ruby emerald sapphire quartz",
    "cloth": "cloth cotton wool silk nylon canvas felt linen lace velvet denim fabric fiber leather fur feather down "
             "hemp jute satin rope string twine yarn polyester burlap",
    "plastic": "plastic rubber resin vinyl latex polymer silicone foam",
    "ice": "ice snow frost",
    "bone": "bone ivory shell horn tooth antler",
    "flesh": "flesh meat skin",
    "plant": "plant flower grass leaf leaves moss vine hay petal",
    "water": "water",
    "fire": "magma lava ember",
}
TAG_NATURE = {t: n for n, ts in MATERIAL_NATURE.items() for t in ts.split()}

# WordNet hypernyms (lemmas on the noun's ancestor chain) that name a nature.
ANCESTOR_NATURE = [
    ("undead", {"zombie", "zombi", "vampire", "ghoul", "lamia", "revenant", "lich"}),
    ("spirit", {"ghost", "spook", "apparition", "specter", "spectre", "phantom", "wraith", "poltergeist"}),
    ("demon", {"evil_spirit", "devil", "demon", "daemon", "fiend", "incubus", "succubus"}),
    ("holy", {"angel", "deity", "divinity", "god", "goddess", "saint", "archangel", "seraph", "cherub"}),
    ("fae", {"fairy", "faery", "faerie", "elf", "sprite", "pixie", "brownie", "gnome", "leprechaun", "nymph", "hob", "goblin"}),
    ("insect", {"arthropod", "insect", "arachnid", "centipede", "millipede", "crustacean"}),
    ("machine", {"machine", "engine", "motor", "robot", "automaton", "computer", "electrical_device", "motor_vehicle",
                 "self-propelled_vehicle", "aircraft", "electronic_equipment"}),
    ("plant", {"plant", "vascular_plant", "tree", "shrub", "herb", "flower"}),
    ("fungus", {"fungus"}),
    ("fire", {"fire", "flame", "blaze"}),
    ("ice", {"ice", "snow"}),
]
CLASS_NATURE = {
    ("creature", "mammal"): "beast", ("creature", "bird"): "beast", ("creature", "amphibian"): "beast",
    ("creature", "reptile"): "reptile", ("creature", "fish"): "fish", ("creature", "insect"): "insect",
    ("creature", "creature"): "beast", ("flora", "fungus"): "fungus", ("bodypart", "bodypart"): "flesh",
}
CLASS_DEFAULT = {"person": "flesh", "flora": "plant"}

# Adjective glosses that name a nature: FIERY WOLF burns like fire, a GHOSTLY one is a spirit.
ADJ_NATURE = [
    ("fire", r"\b(on fire|burning|flaming|fiery|ablaze|aflame|molten)\b"),
    ("ice", r"\b(frozen|icy|ice-cold|frosty|glacial)\b"),
    ("undead", r"\b(undead|zombie|reanimated|risen from the dead|vampir)"),
    ("spirit", r"\b(ghostly|spectral|phantom|incorporeal|disembodied|ghost)\b"),
    ("holy", r"\b(holy|sacred|divine|sanctified|saintly|godly|consecrated|hallowed|angelic|heavenly)\b"),
    ("demon", r"\b(demonic|devilish|diabolic|diabolical|infernal|hellish|unholy|satanic|fiendish|demon)\b"),
    ("machine", r"\b(mechanical|robotic|mechanized|automated)\b"),
    ("stone", r"\b(petrified|stony|turned to stone)\b"),
    ("plant", r"\b(leafy|verdant|overgrown)\b"),
]
# Aura words (feelings and attributes) with a protective meaning: what they lend to whoever they reach.
AURA_RES = [
    ("res_unholy", 0.4, r"\b(holy|holiness|sacred|divine|saint|sanctity|grace|piety|blessed)\b"),
    ("res_holy", 0.4, r"\b(evil|wicked|sin|sinful|unholy|demon|devil|damnation|depravity)\b"),
    ("res_cold", 0.4, r"\b(warm|warmth|heat|hot|fire)\b"),
    ("res_fire", 0.4, r"\b(cold|chill|frost|cool)\b"),
    ("res_psychic", 0.4, r"\b(calm|composure|resolve|willpower|sanity|concentration|focus|discipline)\b"),
]

# --- luck, control: WordNet meaning ---------------------------------------------------------------

GOOD_LUCK = r"\b(good luck|good fortune|lucky|auspicious|talisman|amulet|lucky charm|serendipit|fortunate)\b"
BAD_LUCK = r"\b(bad luck|misfortune|ill luck|unlucky|jinx|inauspicious|ill-omened|luckless|hex|unfortunate|accursed)\b"
CHARMS = {"charm", "good_luck_charm", "amulet", "talisman", "fetish", "juju", "mascot"}
CHANCE = {"gambling", "game_of_chance", "lottery", "wager", "bet", "dice", "die", "casino", "roulette"}
CHANCE_GLOSS = r"\b(game of chance|gambl|lottery|betting|dice|roulette|wager)"
ALCOHOL = {"alcohol", "alcoholic_drink", "alcoholic_beverage", "intoxicant", "liquor", "wine", "beer"}
DRUNK = r"\b(drunk|intoxicat|tipsy|inebriat|dizzy|giddy|unsteady|reeling|staggering|befuddled)"
SPIN = r"\b(spin|spinning|whirl|dizz|drunk|intoxic|reel|stagger|vertigo|giddy|twirl|rotat)"
REVERSE = r"\b(revers|backward|invert|inverse|upside down|opposite|contrar|topsy|inside out|mirror|irony|ironic|paradox)"
MIND = r"\b(puppet|marionette|control|dominat|manipulat|enchant|trance|hypno|mesmer|fascinat|possess|suggest|bewitch|captivat|command|thrall|beguil|compel|spellbind|spell)"
CORD = r"\b(rope|cord|line|chain|cable|string|thread|tether|leash|lasso|lariat|noose|vine|tentacle|harpoon|rein|halter|whip|lash|tendril|web)"
CORDS = {"rope", "string", "thread", "cord", "leash", "chain", "net", "twine", "line", "cable", "tether", "lasso", "web", "rein"}
SOBER = r"\b(sober|caffein|coffee|clear-headed|clearheaded|abstain|temperan)"
WAKE = r"\b(wake|waken|awake|rouse|alert|conscious|lucid|vigilant|arouse)"
MAGNET = r"\bmagnet"


# Properties a thing takes from its first material when it sets none of its own (shared material.ts `susceptibility` reads them).
MADE_OF = ("flammability", "conductivity", "brittleness", "melting_point")


def load_wordnet(dict_dir):
    from wn import WordNet
    return WordNet(dict_dir)


class Meaning:
    """A word's WordNet meaning: the synset lexicon.tsv chose, its gloss and its hypernym lemmas."""
    def __init__(self, wn, lex):
        self.wn, self.lex = wn, lex

    def synset(self, w):
        s = self.lex.get(w)
        if not s or s == "-":
            return None
        return self.wn.syn.get((s[0], s[1:]))

    def gloss(self, w):
        s = self.synset(w)
        return s.gloss.split(";")[0].lower() if s else ""

    def ancestors(self, w):
        s = self.synset(w)
        if not s or s.pos != "n":
            return set()
        return {x.lower() for a in [s] + self.wn.closure(s) for x in a.words}


def has(v, pid):
    return pid in v["set"] or any(o[0] == pid for o in v["ops"])


def num(v, pid, default=0.0):
    x = v["set"].get(pid, default)
    return x if isinstance(x, (int, float)) else (float("inf") if x == "ABS" else default)


def op_factor(v, pid):
    f = 1.0
    for o in v["ops"]:
        if o[0] == pid and o[1] == "mul":
            f *= o[2]
    return f


def natures_of(w, v, m):
    """The natures of a noun, in order, from class, materials, its own properties and meaning."""
    out = []
    add = lambda n: n not in out and out.append(n)
    s, cls, arch = v["set"], v["class"], v["archetype"]
    anc = m.ancestors(w)
    if (cls, arch) in CLASS_NATURE:
        add(CLASS_NATURE[(cls, arch)])
    elif cls in CLASS_DEFAULT:
        add(CLASS_DEFAULT[cls])
    if cls == "creature" and arch == "invertebrate":
        add("insect" if anc & {"arthropod", "arachnid", "crustacean", "centipede", "millipede"} else "beast")
    # What it is made of.
    # Its first material is what it is mostly made of (a HOSPITAL of concrete, glass and steel is stone).
    for t in (s.get("material") or [])[:1]:
        if t in TAG_NATURE:
            add(TAG_NATURE[t])
    if cls == "material" and not s.get("material"):
        for n, lemmas in (("ice", {"ice", "snow", "frost"}), ("fire", {"fire", "flame", "lava", "magma"}),
                          ("metal", {"metal", "metallic_element", "alloy"}), ("wood", {"wood"}),
                          ("stone", {"rock", "stone", "building_material"}), ("glass", {"glass", "crystal", "gem", "ceramic"}),
                          ("cloth", {"fabric", "textile", "cloth", "fiber", "fibre", "leather"}), ("paper", {"paper"}),
                          ("plastic", {"plastic", "rubber", "elastomer"}), ("water", {"water"})):
            if anc & lemmas:
                add(n)
                break
        fam = {"metal": "metal", "gem": "glass", "mineral": "stone"}.get(arch)
        if fam and not out:
            add(fam)
    # What its properties say it is.
    temp = s.get("temperature", 20) if isinstance(s.get("temperature", 20), (int, float)) else 20
    dmg = {k[4:]: x for k, x in s.items() if k.startswith("dmg_") and isinstance(x, (int, float)) and x > 0}
    top = max(dmg, key=dmg.get) if dmg else None
    res = lambda t: s.get(f"res_{t}", 0) if isinstance(s.get(f"res_{t}", 0), (int, float)) else 1.0
    supernatural = arch == "supernatural"
    if s.get("phase") is True or (supernatural and s.get("mass", 1) == 0 and s.get("alive") is not True):
        add("spirit")
    if cls == "creature" and dmg.get("holy", 0) > 0:
        add("holy")
    if cls == "creature" and (dmg.get("unholy", 0) > 0 and res("holy") < 0.5 or res("unholy") >= 0.9 and res("holy") < 0):
        add("demon")
    if temp >= 300 or (top == "fire" and res("fire") >= 0.9):
        add("fire")
    if temp <= -20 or (top == "cold" and res("cold") >= 0.9):
        add("ice")
    if supernatural and s.get("alive") is False and "spirit" not in out and not s.get("material") and res("holy") < 0:
        add("undead")
    if cls == "terrain" and arch == "water":
        add("water")
    if s.get("diet") == "power" or cls == "artifact" and arch == "machine":
        add("machine")
    for n, lemmas in ANCESTOR_NATURE:
        if not anc & lemmas:
            continue
        if cls == "creature" and n not in ("machine", "plant") or n == "machine" and cls == "artifact" or n in ("plant", "fungus") and cls == "flora":
            add(n)
    if supernatural and not out:
        add("beast" if s.get("alive") is not False else "spirit")
    return out


# --- price ---------------------------------------------------------------------------------------
# A grand word (shared inspect.ts `grandeur`, GRAND_FROM 1000) costs more than its own letters: each
# order of magnitude of grandeur adds the next of its `price_letters`, letters that are earned, not
# foraged (shared inspect.ts `surcharge`). Which letters, by what it is: legends are paid for in
# kills and boss drops, beasts in the hunt, machines in machine letters and won fights, weapons in
# victories, weather and disasters in wind and exploring. A word gets them from a tenth of
# GRAND_FROM, so an adjective that makes it grand finds them there.
PRICED_FROM = 100
LEGEND = {"spirit", "demon", "holy", "undead", "fae"}
MACHINE_ARCH = {"vehicle_land", "vehicle_air", "vehicle_water", "machine", "robot"}

def grandeur(v):
    """The same as shared inspect.ts `grandeur`, over a word's own properties."""
    s = v["set"]
    def n(pid):
        x = s.get(pid, 0)
        return 1e12 if x == "ABS" else x if isinstance(x, (int, float)) else 0
    hit = sum(max(0, n(k)) for k in s if k.startswith("dmg_"))
    if v["role"] != "noun":
        return 0
    seconds = (n("field_duration") or n("event_duration")) * 60
    if v["class"] in ("event", "world_state", "spell", "aura"):
        tiles = (n("field_radius") or n("event_radius")) / 4
        reach = min(1, (tiles / 8) ** 2)
        if hit > 0 and n("attack_rate") > 0 and 0 < seconds < 1e9:
            hit *= max(1, n("attack_rate") * seconds * reach)
        return hit
    moves = n("speed_land") > 0 or n("speed_air") > 0 or n("speed_water") > 0 or s.get("mountable") is True
    body = n("integrity") / 5 if hit > 0 or moves else 0
    return max(hit, body)

def price_of(cls, arch, s, anc):
    natures = set(s.get("nature") or [])
    if cls in ("creature", "person") and (natures & LEGEND or arch == "supernatural"):
        return "kzxq"
    if cls in ("creature", "person", "flora"):
        return "hkvz"
    if arch in MACHINE_ARCH or "machine" in natures:
        return "mvxz"
    if arch == "weapon" or s.get("single_use") is True:
        return "vkxz"
    if cls in ("event", "world_state", "spell", "aura"):
        return "wjxq"
    return "kvxq"

def derive(out, dict_dir, audit=False):
    wn = load_wordnet(dict_dir)
    lex = {}
    for line in list(open(os.path.join(D, "lexicon.tsv")))[1:]:
        t = line.rstrip("\n").split("\t")
        lex[t[0]] = t[6]
    m = Meaning(wn, lex)
    hooked = collections.defaultdict(list)

    def give(rule, w, v, pid=None, value=None, op=None):
        if pid is not None:
            if pid in v["set"]:
                return False
            v["set"][pid] = value
        if op is not None:
            if any(o[0] == op[0] for o in v["ops"]):
                return False
            v["ops"].append(list(op))
        hooked[rule].append(w)
        return True

    for w, v in out.items():
        role, cls, arch, s = v["role"], v["class"], v["archetype"], v["set"]
        # What a thing is made of decides how it burns, carries lightning, shatters and melts: a wooden
        # FENCE takes the flammability of WOOD, a steel SWORD the conductivity of STEEL (shared material.ts).
        made = (s.get("material") or [None])[0]
        if role == "noun" and made and made in out and made != w and out[made]["class"] == "material":
            for pid in MADE_OF:
                x = out[made]["set"].get(pid)
                if isinstance(x, (int, float)) and pid not in s:
                    s[pid] = x
                    hooked[f"made of:{pid}"].append(w)
        gloss = m.gloss(w)
        anc = m.ancestors(w)
        # Natures.
        if role == "noun" and "nature" not in s and cls not in ("aura", "event", "knowledge", "institution", "measure", "world_state", "affliction"):
            n = natures_of(w, v, m)
            if n:
                s["nature"] = n
                for x in n:
                    hooked[f"nature:{x}"].append(w)
        if role == "adjective" and "nature" not in s and not s.get("material"):
            n = [x for x, rx in ADJ_NATURE if re.search(rx, gloss)]
            if n:
                s["nature"] = n
                hooked["nature:adjective"].append(w)
        if cls == "aura" and (s.get("field_radius") or arch in ("attribute", "feeling")):
            for pid, amount, rx in AURA_RES:
                if re.search(rx, gloss) and not has(v, pid):
                    give(f"aura:{pid}", w, v, op=(pid, "add", amount))
        # Size: whatever scales a body's height, length or mass scales its size alike.
        if not has(v, "size") and v["ops"]:
            h, l, ms = op_factor(v, "height"), op_factor(v, "length"), op_factor(v, "mass")
            f = h if h != 1 else l if l != 1 else ms ** (1 / 3) if ms != 1 else 1
            if f > 0 and abs(f - 1) >= 0.1:
                give("size:grow" if f > 1 else "size:shrink", w, v, op=("size", "mul", round(f, 3)))
        # Luck.
        if not has(v, "luck") and cls not in ("person", "creature") and role in ("noun", "adjective"):
            if anc & CHARMS and cls == "artifact":
                give("luck:charm", w, v, op=("luck", "add", 3.0))
            elif re.search(BAD_LUCK, gloss):
                give("luck:bad", w, v, op=("luck", "add", -3.0))
            elif re.search(GOOD_LUCK, gloss):
                give("luck:good", w, v, op=("luck", "add", 3.0))
        if anc & CHANCE or re.search(CHANCE_GLOSS, gloss):
            if role == "noun" and cls == "artifact" and not has(v, "rerolls"):
                give("luck:rerolls", w, v, op=("rerolls", "add", 1.0))
            elif (role == "verb" or cls == "event") and not has(v, "gamble") and not s.get("stakes"):
                give("luck:gamble", w, v, pid="gamble", value=6.0)
        # Control.
        if arch == "drink" and anc & ALCOHOL and not has(v, "wobble"):
            potency = num(v, "potency", 3)
            give("control:wobble-drink", w, v, op=("wobble", "add", round(min(5.0, max(1.5, potency * 0.6)), 1)))
        if role == "adjective" and re.search(DRUNK, gloss) and not has(v, "wobble"):
            give("control:wobble-adjective", w, v, op=("wobble", "add", 4.0))
        confuses = num(v, "inflict_confuse") > 0
        if confuses and re.search(SPIN, gloss + " " + w) and not has(v, "inflict_drunk"):
            give("control:drunk", w, v, pid="inflict_drunk", value=num(v, "inflict_confuse"))
        if confuses and re.search(REVERSE, gloss + " " + w) and not has(v, "inflict_reverse"):
            give("control:reverse", w, v, pid="inflict_reverse", value=max(4.0, num(v, "inflict_confuse")))
        if role == "adjective" and re.search(REVERSE, gloss) and re.search(r"\b(direction|order|position|way|backward|upside)", gloss) and not has(v, "reversed"):
            give("control:reversed-adjective", w, v, op=("reversed", "add", 1.0))
        if num(v, "inflict_charm") > 0 and re.search(MIND, gloss + " " + w) and not has(v, "inflict_hypnosis"):
            give("control:hypnosis", w, v, pid="inflict_hypnosis", value=max(3.0, num(v, "inflict_charm") * 0.6))
        if re.search(r"\b(puppet|marionette)", w + " " + gloss) and (num(v, "inflict_charm") > 0 or num(v, "inflict_hypnosis") > 0) and not has(v, "inflict_leash"):
            give("control:leash-puppet", w, v, pid="inflict_leash", value=8.0)
        if num(v, "inflict_root") > 0 and re.search(CORD, gloss + " " + w) and not has(v, "inflict_leash") and cls in ("artifact", "creature", "flora"):
            # A rope or a tentacle that catches you ties you to whoever threw it: led, not rooted.
            give("control:leash", w, v, pid="inflict_leash", value=max(6.0, num(v, "inflict_root") * 2))
            if v["set"].pop("inflict_root", None) is not None:
                hooked["control:leash-not-root"].append(w)
        if role == "noun" and cls in ("artifact", "material") and re.search(MAGNET, gloss) and not has(v, "magnetism"):
            give("control:magnet", w, v, pid="magnetism", value=6.0)
        # Cures, by meaning.
        cures = s.get("effect_status") or []
        if (re.search(SOBER, gloss + " " + w) or "confuse" in cures and arch == "drink") and "drunk" not in cures:
            s["effect_status"] = cures = list(cures) + ["drunk"]
            hooked["cure:drunk"].append(w)
        if (re.search(WAKE, gloss) and role in ("verb", "adjective") or any(c in cures for c in ("sleep", "charm"))) and "hypnosis" not in cures:
            s["effect_status"] = cures = list(cures) + ["hypnosis"]
            hooked["cure:hypnosis"].append(w)
        cuts = s.get("counters") or []
        if (set(cuts) & CORDS and num(v, "sharpness") >= 5) or (num(v, "severs") > 0 and role == "verb"):
            if "leash" not in cures:
                s["effect_status"] = cures = list(cures) + ["leash"]
                hooked["cure:leash"].append(w)
        # Price: what a grand word's scale is paid in (shared inspect.ts `surcharge`), by what it is.
        if role == "noun" and not has(v, "price_letters") and grandeur(v) >= PRICED_FROM:
            give("price:" + (seq := price_of(cls, arch, s, anc)), w, v, pid="price_letters", value=seq)
    if audit:
        for rule in sorted(hooked):
            ws = hooked[rule]
            print(f"{rule}: {len(ws)}  {' '.join(ws[:40])}{' ...' if len(ws) > 40 else ''}")
    return hooked


if __name__ == "__main__":
    # The audit: what each rule hooked in, over the words as written (build_demo.py --audit runs it).
    os.execvp(sys.executable, [sys.executable, os.path.join(HERE, "build_demo.py"), *sys.argv[1:], "--audit"])
