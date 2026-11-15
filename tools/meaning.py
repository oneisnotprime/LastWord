"""Meaning rules: give screen, knowledge and communication properties to every word whose meaning
calls for them (shared screen.ts, knowledge.ts, comms.ts), across the whole dictionary.

Each rule picks words by meaning: the WordNet sense the lexicon chose for the word (its
hypernym ancestors, `under`) and that sense's gloss (`gloss`), plus properties the word already
has (`has`). What a rule adds depends on how the word acts (`shape`): a weapon, creature, event or
field inflicts a status, an adjective adds it to what it describes, something carried, a field or
a verb in force restores panels, and so on. A rule never overwrites a property the word already
sets: hand-written and generated values win. build_demo.py calls `apply` after reading both
word files; `report` counts the words that hook into each dimension.
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wn import WordNet

# Seconds a word gives each status (shared status.ts stretches them about six times).
SECONDS = {"amnesia": 4, "illiterate": 4, "censor": 6, "gag": 5, "blind": 3}

# Panels each kind of restorer gives back (shared screen.ts PANELS).
RESTORE = {
    "sight": (["minimap", "bars"], "blind"),
    "map": (["minimap"], None),
    "letters": (["cards", "rack", "trade", "preview"], "illiterate"),
    "memory": (["preview", "best", "inventory", "intel"], "amnesia"),
    "news": (["chips", "feed"], "censor"),
    "speech": (["feed"], "gag"),
}

def R(pattern):
    return re.compile(pattern, re.I)

# Glosses that undo what restorers and knowledge give: ERASE is not a memory, nor CENSOR news.
UNDOING = re.compile(r"\b(eras\w*|effac\w*|forget\w*|delet\w*|obliterat\w*|censor\w*|block\w* out|suspension of|remove from memory)\b", re.I)

def _unused(pattern):
    return re.compile(pattern, re.I)

# The rules. kind: harm (inflict a status), restore (panels back), know (insight), dull (insight
# lost), hear (hearing_range), lie (decoys). Each picks by `under` (WordNet ancestors), `gloss`
# (a pattern on the sense's gloss) or `words`; `only` limits the shapes it applies to.
RULES = [
    # Screen and HUD access.
    dict(dim="screen", kind="harm", status="amnesia", under=["club.n.3", "hammer.n.2", "bludgeon.n.1", "sedative.n.1"],
         gloss=R(r"\b(forget\w*|amnesia|concussion|stupor|daze[ds]?|dazing|unconscious\w*|knock(ed|s)? out|lethe|brainwash\w*|memory loss)\b"), only=("strikes", "event", "field")),
    dict(dim="screen", kind="harm", status="amnesia", has=lambda v: num(v, "inflict_stun") > 0 and num(v, "dmg_blunt") > 0),
    dict(dim="screen", kind="harm", status="illiterate", under=["nonsense.n.1", "gibberish.n.1", "jargon.n.1"],
         gloss=R(r"\b(gibberish|nonsense|unintelligible|illegible|jargon|babbl\w*|garbl\w*|scrambl\w*|jumbl\w*|dyslexi\w*|illitera\w*|incomprehensib\w*|unreadable|scrawl\w*)\b"), only=("event", "field", "adj")),
    dict(dim="screen", kind="harm", status="censor", under=["censoring.n.1", "suppression.n.2"],
         gloss=R(r"\b(censor\w*|redact\w*|cover-?up|blackout|propaganda|ban(s|ning|ned)? (on|of) (news|speech|information)|withhold\w* information|suppress\w* (news|information|speech|dissent|publication))\b"), only=("event", "field")),
    dict(dim="screen", kind="harm", status="censor", has=lambda v: bool(v["set"].get("jams"))),
    dict(dim="screen", kind="harm", status="gag", under=["gag.n.2", "muzzle.n.3"],
         gloss=R(r"\b(gag(s|ged|ging)?|silenc\w*|mute[ds]?|speechless|tongue-?tied|shut up|keep quiet|stifl\w*|prevent\w* (speaking|speech))\b"), only=("event", "field", "strikes")),
    dict(dim="screen", kind="harm", status="gag", has=lambda v: num(v, "silences") > 0),
    dict(dim="screen", kind="harm", status="blind", gloss=R(r"\b(blind(s|ed|ing)?|blindfold\w*|glare|smokescreen|soot|squirt\w* ink|eye-?goug\w*|dazzling light)\b"), only=("strikes", "event", "field")),
    dict(dim="screen", kind="restore", what="sight", under=["spectacles.n.1", "optical_instrument.n.1", "lens.n.1"],
         gloss=R(r"\b(eyeglass\w*|spectacle\w*|lens(es)?|goggles|monocle|telescop\w*|binocular\w*|periscope|keen sight|eyesight|perceive by sight|correct\w* (vision|sight))\b")),
    dict(dim="screen", kind="restore", what="map", under=["map.n.1", "chart.n.1", "navigational_instrument.n.1", "globe.n.1"],
         gloss=R(r"\b(maps?|atlas|navigat\w*|compass\w*|cartograph\w*|wayfind\w*|signpost\w*|find (your|one's|the) way)\b")),
    dict(dim="screen", kind="restore", what="letters", under=["publication.n.1", "reference_book.n.1", "book.n.2", "educational_institution.n.1", "library.n.1", "school.n.1", "school.n.2", "alphabet.n.1"],
         gloss=R(r"\b(read(s|ing)?|literacy|literate|alphabet\w*|spelling|grammar|dictionar\w*|vocabular\w*|lexicon|glossary|textbook|decipher\w*|decod\w*)\b"), only=("carried", "field", "verb")),
    dict(dim="screen", kind="restore", what="memory", under=["memory.n.1", "memory.n.2", "memory.n.3", "book.n.2", "reminder.n.1"],
         gloss=R(r"\b(remember\w*|reminder\w*|recall\w*|recollect\w*|diar(y|ies)|journal|notebook|souvenir\w*|keepsake\w*|mnemonic\w*|memento\w*|memoir\w*|memory|memories)\b")),
    dict(dim="screen", kind="restore", what="news", under=["news.n.1", "broadcasting.n.1", "journalism.n.1", "newspaper.n.1", "magazine.n.1"],
         gloss=R(r"\b(news\w*|journalis\w*|the press|bulletin\w*|headline\w*|gazette|broadcast(s|ing|er)?|televis\w*|town crier)\b")),
    dict(dim="screen", kind="restore", what="speech", under=["megaphone.n.1", "loudspeaker.n.1", "microphone.n.1"], gloss=R(r"\b(freedom of speech|free speech|outcry|speak(s|ing)? out|right to speak)\b")),
    # Knowledge: insight (read_properties).
    dict(dim="knowledge", kind="know", level=3, under=["publication.n.1", "book.n.1", "book.n.2", "document.n.1", "reference_book.n.1"],
         gloss=R(r"\b(knowledge|learn(ed|ing)?|wisdom|insight\w*|scholar\w*|erudit\w*|lore|research\w*)\b"), only=("carried", "being", "field", "verb")),
    dict(dim="knowledge", kind="know", level=5, under=["educational_institution.n.1", "school.n.1", "school.n.2", "library.n.1", "university.n.1", "college.n.1", "scholar.n.1", "intellectual.n.1", "educator.n.1"],
         gloss=R(r"\b(scholarly|genius|professor\w*|academ\w*|universit\w*|librar\w*|encyclopedi\w*)\b"), only=("carried", "being", "field", "verb")),
    dict(dim="knowledge", kind="know", level=6, under=["spy.n.1", "detective.n.1", "informant.n.1", "espionage.n.1", "reconnaissance.n.1"],
         gloss=R(r"\b(spy|spies|spying|espionage|secret agent|informer|informant|intelligence (agent|service|gathering)|reconnaissance|snoop\w*|eavesdrop\w*|surveil\w*|wiretap\w*|detective\w*)\b"), only=("carried", "being", "field", "verb", "event")),
    dict(dim="knowledge", kind="know", level=9, under=["oracle.n.1", "seer.n.1", "prophet.n.1", "forecaster.n.1", "divination.n.1", "prophecy.n.1"],
         gloss=R(r"\b(foresee\w*|foretell\w*|foretold|prophe\w*|predict(s|ing|ion)?|divination|diviner|clairvoy\w*|soothsay\w*|omens?|augur\w*|fortune-?tell\w*|oracle\w*|crystal ball|second sight|omniscien\w*|all-knowing|telepath\w*|mind-?read\w*)\b"), only=("carried", "being", "field", "verb")),
    dict(dim="knowledge", kind="dull", gloss=R(r"\b(ignoran\w*|stupid\w*|dull-?witted|illitera\w*|uninformed|unlearned|uneducated|misinform\w*|befuddl\w*|baffl\w*)\b")),
    # Communication: hearing_range, and lies.
    dict(dim="comms", kind="hear", meters=1500, under=["telecommunication.n.1", "telephone.n.1", "radio.n.1", "radio_receiver.n.1", "receiver.n.1", "transmitter.n.1", "communication_system.n.1", "telegraph.n.1", "microphone.n.1"],
         gloss=R(r"\b(radio\w*|telephon\w*|phones?|transmitter\w*|receiv(er|ing) (signals|messages|broadcasts)|eavesdrop\w*|wiretap\w*|telegra\w*|intercom|antenna\w*|microphone\w*|walkie|hearing aid|ear trumpet)\b"), only=("carried", "being", "verb")),
    dict(dim="comms", kind="hear", meters=5000, gloss=R(r"\b(telepath\w*|mind-?read\w*|clairaudi\w*|extrasensory|hive mind)\b")),
    dict(dim="comms", kind="lie", gloss=R(r"\b(rumou?rs?|lies|liars?|deceiv\w*|deception|falsehood\w*|hoax\w*|mislead\w*|bluff\w*|disinformation|misinformation|slander\w*|gossip\w*|fabricat\w* (stories|lies|evidence)|deceit\w*|ruse|false (report|statement|information|alarm|rumou?r)|propaganda)\b"), only=("event", "field")),
]

def num(v, pid):
    x = v["set"].get(pid, 0)
    return x if isinstance(x, (int, float)) else (1e9 if x == "ABS" else 0)

def has_prop(v, pid):
    return pid in v["set"] or any(o[0] == pid for o in v["ops"])

def shape(v):
    """How a word acts, for what a rule adds: adj, verb, field, event, strikes, carried, being, other."""
    s = v["set"]
    if v["role"] == "adjective":
        return "adj"
    if v["role"] == "adverb":
        return "other"
    if v["role"] == "verb":
        return "verb"
    if num(v, "field_radius") > 0:
        return "field"
    if v["class"] == "event" or s.get("event_target") in ("character", "creature", "faction") or (s.get("placement") == "target" and v["class"] not in ("person", "creature")):
        return "event"
    if s.get("alive") or v["class"] in ("person", "creature"):
        return "being" if not any(k.startswith("dmg_") and num(v, k) > 0 for k in s) else "strikes"
    if any(k.startswith("dmg_") and num(v, k) > 0 for k in s):
        return "strikes"
    if v["class"] in ("artifact", "consumable", "bodypart", "material", "knowledge") and s.get("portable", True) is not False and num(v, "mass") <= 50:
        return "carried"
    return "other"

def add_set(v, pid, val):
    if has_prop(v, pid):
        return False
    v["set"][pid] = val
    return True

def add_op(v, pid, amount):
    if has_prop(v, pid):
        return False
    v["ops"].append([pid, "add", float(amount)])
    return True

def add_tags(v, pid, tags):
    have = v["set"].get(pid)
    have = list(have) if isinstance(have, list) else []
    new = [t for t in tags if t not in have]
    if not new:
        return False
    v["set"][pid] = have + new
    return True

def act(rule, v):
    """Adds what a rule gives a word of its shape. True if anything was added."""
    sh, k = shape(v), rule["kind"]
    if k == "harm":
        pid, n = f"inflict_{rule['status']}", SECONDS[rule["status"]]
        if sh in ("strikes", "event", "field"):
            return add_set(v, pid, n)
        if sh == "adj":
            return add_op(v, pid, n)
        return False
    if k == "restore":
        panels, status = RESTORE[rule["what"]]
        # A word that takes the panel away never also gives it back (a JAMMER is not news).
        if v["set"].get("jams") or any(num(v, f"inflict_{x}") > 0 for x in ("amnesia", "illiterate", "censor", "gag", "blind")):
            return False
        if sh in ("carried", "field", "verb"):
            done = add_tags(v, "restores_panels", panels)
            if status:
                done = add_set(v, f"immune_{status}", True) or done
            return done
        if sh == "event" and status:
            return add_tags(v, "effect_status", [status])
        return False
    if k == "know":
        lv = rule["level"]
        if sh in ("carried", "being"):
            if num(v, "read_properties") >= lv:
                return False
            if any(o[0] == "read_properties" for o in v["ops"]):
                return False
            v["set"]["read_properties"] = float(lv)
            return True
        if sh in ("field", "verb", "adj"):
            return add_op(v, "read_properties", lv)
        return False
    if k == "dull":
        if sh in ("field", "verb", "adj"):
            return add_op(v, "read_properties", -4)
        if sh == "event":
            return add_set(v, "inflict_amnesia", SECONDS["amnesia"])
        return False
    if k == "hear":
        m = rule["meters"]
        if sh in ("carried", "field", "verb", "adj"):
            return add_op(v, "hearing_range", m)
        if sh == "being":
            return add_set(v, "hearing_range", float(m))
        return False
    if k == "lie":
        if sh in ("field", "event"):
            return add_set(v, "decoys", 2.0)
        return False
    return False

class Meaning:
    def __init__(self, wn_dir, lex):
        self.W = WordNet(wn_dir)
        self.lex = lex
        self.keys = {}

    def synset(self, key):
        lemma, pos, n = key.rsplit(".", 2)
        senses = self.W.senses(lemma, pos)
        return senses[int(n) - 1] if len(senses) >= int(n) else None

    def offsets(self, keys):
        out = set()
        for k in keys:
            s = self.synset(k)
            if s:
                out.add(s.offset)
        return out

    def sense(self, w):
        code = self.lex.get(w, [None] * 6)[5] if w in self.lex else None
        if not code or code == "-":
            return None
        return self.W.syn.get((code[0], code[1:]))

def apply(out, lex, wn_dir):
    """Adds every rule's properties to the words it picks. Returns {dim: set of words hooked by the rules}."""
    m = Meaning(wn_dir, lex)
    hooked = {}
    for rule in RULES:
        targets = m.offsets(rule.get("under", []))
        for w, v in out.items():
            if rule.get("only") and shape(v) not in rule["only"]:
                continue
            s = m.sense(w)
            hit = False
            if targets and s is not None and s.pos == "n":
                anc = {s.offset} | {a.offset for a in m.W.closure(s)}
                hit = bool(anc & targets)
            if not hit and rule.get("gloss") is not None and s is not None:
                hit = bool(rule["gloss"].search(s.gloss.split(";")[0]))
            if not hit and rule.get("has") is not None:
                hit = rule["has"](v)
            if hit and rule["kind"] in ("restore", "know") and (UNDOING.search(w) or (s is not None and UNDOING.search(s.gloss.split(";")[0]))):
                hit = False
            if hit and act(rule, v):
                hooked.setdefault(rule["dim"], set()).add(w)
                if os.environ.get("MEANING_DEBUG"):
                    print("RULE", rule["kind"], rule.get("status") or rule.get("what") or rule.get("level") or rule.get("meters") or "", shape(v), w)
    return hooked

# Properties that put a word in each dimension, the rules' and the ones words already had.
DIMENSIONS = {
    "screen": lambda v: any(has_prop(v, p) for p in ("restores_panels", "inflict_amnesia", "inflict_illiterate", "inflict_censor", "inflict_blind",
                                                    "inflict_confuse", "inflict_sleep", "inflict_chaos", "immune_blind", "immune_amnesia",
                                                    "immune_illiterate", "immune_censor", "jams"))
                        or any(t in ("blind", "amnesia", "illiterate", "censor", "confuse", "sleep") for t in (v["set"].get("effect_status") or [])),
    "knowledge": lambda v: has_prop(v, "read_properties") or bool(v["set"].get("read_inventory")) or bool(v["set"].get("immune_expose")),
    "comms": lambda v: any(has_prop(v, p) for p in ("hearing_range", "decoys", "inflict_gag", "immune_gag", "inflict_silence", "inflict_deaf", "silences", "loudness"))
                       or any(t in ("gag", "silence", "deaf") for t in (v["set"].get("effect_status") or [])),
}

def report(out):
    return {d: sum(1 for v in out.values() if f(v)) for d, f in DIMENSIONS.items()}
