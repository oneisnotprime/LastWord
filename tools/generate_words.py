#!/usr/bin/env python3
"""Give property values to more of the dictionary with Claude, through the Message Batches API.

    generate_words.py prepare [count=3000] <wordnet dict dir>   pick words, write the requests
    generate_words.py pilot [n=2]                                send the first n requests now, to check
    generate_words.py submit                                     send them as one batch
    generate_words.py status                                     show the batch's progress
    generate_words.py collect                                    write generated_words.txt
    generate_words.py merge                                      or: join hand-made chunk files

The model sees the property schema and every hand-written line of demo_words.txt as examples,
and answers in the same line format. Its lines are checked by build_demo.py, which drops any
property that does not exist or has the wrong type, so nothing it writes can break the build.
Needs ANTHROPIC_API_KEY (or another credential the Anthropic SDK can find) for submit onward.
"""
import json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
WORK = os.path.join(HERE, "..", ".generate")      # requests, batch id, raw results; not committed
MODEL = "claude-opus-5-5"
WORDS_PER_REQUEST = 12
ROLES = ["noun", "verb", "adjective", "adverb"]

# Grammar words: they are in WordNet by accident of spelling (ARE as a unit of area, CAN as a tin)
# and would only waste the batch. They stay in the lexicon for a later, deliberate ruling.
GRAMMAR = set("""
are have not but all one can will just like about out more there time also some what when only
other into than then them these they this those very well even back here where which while who
whom whose why how any each few many much most such own same both either neither nor yet still
ever never always often again once now soon already almost quite rather really too so just do does
did done doing has had having was were been being get got gets getting make made makes say said
says go goes went gone see seen know knew known think thought take took taken come came give gave
given use used find found tell told ask asked seem seemed feel felt try tried leave left call
called keep kept let put mean meant become became show showed shown hear heard want wanted need
needed look looked may might must shall should would could upon over under after before since
until because though although however therefore thus hence perhaps maybe yes yeah okay please
thing things way ways lot lots kind sort part case point fact number whole else instead indeed
first second third last next new old good bad great little big long high low right left sure
able less least more most per via etc
""".split())

# Kept out of the generated dictionary until the user rules on them: groups of people
# (nationalities, religions, ethnicities, sexuality, disability) and sexual violence, self-harm
# and hate. Giving these words stats in a combat game would turn real people into game pieces.
EXCLUDED = set("""
american english british french european chinese russian german indian african christian
japanese spanish canadian asian christ muslim italian jewish catholic irish korean islamic
mexican gay disabled suicide rape racist racism nazi slave abortion
""".split())


def demo_words():
    return {m.group(1) for m in re.finditer(r"^([a-z]+):", open(os.path.join(HERE, "demo_words.txt")).read(), re.M)}


def by_role():
    """Archetypes each role may take, from the lexicon's own classes."""
    groups = {r: set() for r in ROLES}
    for a in json.load(open(os.path.join(DATA, "archetypes.json"))):
        role = {"modifier": "adjective", "spell": "verb", "verb_modifier": "adverb"}.get(a["class"], "noun")
        groups[role].add(a["archetype"])
    groups["adjective"].add("absolute")
    return {r: sorted(v) for r, v in groups.items()}


def archetypes():
    return sorted({a for v in by_role().values() for a in v})


def system_prompt():
    props = json.load(open(os.path.join(DATA, "properties.json")))
    lines = []
    for p in props["properties"]:
        kind = p["type"] + (":" + "|".join(p["values"]) if p.get("values") else "")
        unit = f" [{p['unit']}]" if p.get("unit") else ""
        lines.append(f"{p['id']} ({kind}, default {json.dumps(p['default'])}){unit}: {p['desc']}")
    examples = open(os.path.join(HERE, "demo_words.txt")).read()
    return f"""You are filling in the word data for Last Word, a multiplayer game. Players spend letters to spell
words, and every word does what it means: a noun becomes an object, creature, terrain or event in the
world; an adjective modifies the noun it is spelled with; a verb is cast on the speller for a while;
an adverb modifies a verb. All words act only through the shared properties listed below, so that
words interact (rain puts out fire, a dog smells a thief). Balance comes from what words mean and
from counter-words, not from caps, and when a word could have a modest effect or a dramatic one,
choose the dramatic one that is still true to the word.

For each word you are given, write one entry:
- word: exactly as given.
- role: noun, verb, adjective or adverb: the use most useful in play. Concrete things beat abstract
  senses; prefer an object over a verb when the word is commonly both (hammer is a noun, fly a verb).
- archetype: one from the allowed list, the closest fit for the role you chose. The hint you are
  given comes from WordNet's first sense and is often wrong (chair is furniture, not a person).
- properties: a list of tokens in exactly the format of the examples:
    p=v   sets the word's own property (an object's own mass, a creature's speed)
    p*x   multiplies that property on whatever the word modifies (adjective -> its noun,
          verb -> the caster, aura/weather/event -> things in its reach)
    p+x   adds to that property on whatever the word modifies
  Values: numbers in the property's unit, "true"/"false" for bools, one listed value for enums,
  comma-separated words for tags, ABS for an absolute (only for words that literally mean
  absolute: infinite, invincible, eternal). Use real-world units and magnitudes. Only list
  properties that differ from their default; most words need 5 to 20 tokens. Never invent a
  property name.

Word classes and what they usually set, by example below:
- objects: mass, size, integrity, material, equip_slot, damage (dmg_*)
- letters: never set produce_* (p=v or p+x): which things make letters is written by hand in
  producers.txt (a TOILET makes no J). Areas, weather and events may only scale what is earned
  inside them (WAR: produce_K*3), and only when the word is about that letter's source
- creatures: alive, diet, speeds, integrity, damage, senses; ridable ones mountable and seats
- terrain: tile_type and radius; sky words placement=sky and their field
- events: placement, event_target, contest_with and contested_by, damage, durations
- adjectives and adverbs: * and + operations
- verbs: duration and * or + operations on the caster

PROPERTIES (id (type, default) [unit]: meaning)
{chr(10).join(lines)}

ALLOWED ARCHETYPES, by role (the archetype must belong to the role you chose)
{chr(10).join(f"{r}: {', '.join(v)}" for r, v in by_role().items())}

EXAMPLES: the hand-written demo dictionary. Sections start "# role archetype"; each line is
"word: tokens".
{examples}"""


def schema():
    return {
        "type": "object",
        "properties": {
            "entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "word": {"type": "string"},
                        "role": {"type": "string", "enum": ROLES},
                        "archetype": {"type": "string", "enum": archetypes()},
                        "properties": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["word", "role", "archetype", "properties"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["entries"],
        "additionalProperties": False,
    }


def glosses(dict_dir):
    sys.path.insert(0, HERE)
    from wn import WordNet
    wn = WordNet(dict_dir)
    out = {}
    for (pos, off), s in wn.syn.items():
        out[pos + off] = s.gloss.split(";")[0].strip()
    return out


def prepare(count, dict_dir):
    have = demo_words()
    rows = [l.rstrip("\n").split("\t") for l in list(open(os.path.join(DATA, "lexicon.tsv")))[1:]]
    picked = [r for r in rows if r[0] not in have and r[0] not in GRAMMAR and len(r[0]) >= 3 and r[1] in ROLES]
    picked.sort(key=lambda r: -float(r[4]))
    picked = picked[:count]
    gloss = glosses(dict_dir)
    os.makedirs(WORK, exist_ok=True)
    system = system_prompt()
    requests = []
    for i in range(0, len(picked), WORDS_PER_REQUEST):
        chunk = picked[i:i + WORDS_PER_REQUEST]
        listing = "\n".join(
            f"- {r[0]} (hint: {r[1]}, {r[3]}; other uses: {r[7]}; sense: {gloss.get(r[6], '')})" for r in chunk)
        requests.append({
            "custom_id": f"w{i // WORDS_PER_REQUEST:04d}",
            "params": {
                "model": MODEL,
                "max_tokens": 16000,
                "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": schema()}},
                "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
                "messages": [{"role": "user", "content": f"Write an entry for each of these {len(chunk)} words:\n{listing}"}],
            },
            "words": [r[0] for r in chunk],
        })
    with open(os.path.join(WORK, "requests.jsonl"), "w") as f:
        for r in requests:
            f.write(json.dumps(r) + "\n")
    tokens = len(system) // 4
    print(f"{len(picked)} words in {len(requests)} requests; shared prompt about {tokens:,} tokens")
    print("hints by role:", dict(collections.Counter(r[1] for r in picked)))
    print("first:", " ".join(r[0] for r in picked[:15]), "… last:", " ".join(r[0] for r in picked[-8:]))


def merge():
    """Joins the chunk files written by hand or by subagents into generated_words.txt. Words already
    in generated_words.txt are kept unless a chunk writes them again; a chunk's line wins."""
    import glob
    sections = collections.defaultdict(list)
    left_out = []
    chunked = set()
    for path in glob.glob(os.path.join(WORK, "chunks", "out_*.txt")):
        chunked |= {m.group(1) for m in re.finditer(r"^([a-z]+):", open(path).read(), re.M)}
    old = os.path.join(HERE, "generated_words.txt")
    role = arch = None
    for line in open(old) if os.path.exists(old) else []:
        line = line.strip()
        m = re.fullmatch(r"# (noun|verb|adjective|adverb) (\w+)", line)
        if m:
            role, arch = m.groups()
        elif line and not line.startswith("#") and role and line.partition(":")[0].strip() not in chunked:
            sections[(role, arch)].append(line)
    for path in sorted(glob.glob(os.path.join(WORK, "chunks", "out_*.txt"))):
        role = arch = None
        for line in open(path):
            line = line.strip()
            m = re.fullmatch(r"# (noun|verb|adjective|adverb) (\w+)", line)
            if m:
                role, arch = m.groups()
            elif line and not line.startswith("#") and role:
                word = line.partition(":")[0].strip()
                if word in EXCLUDED:
                    left_out.append(word)
                else:
                    sections[(role, arch)].append(line)
    with open(os.path.join(HERE, "generated_words.txt"), "w") as f:
        f.write(f"# Generated with {MODEL} by generate_words.py. Do not edit by hand: fix demo_words.txt\n"
                "# examples or the prompt and generate again. Checked leniently by build_demo.py.\n")
        for (role, arch), lines in sorted(sections.items()):
            f.write(f"\n# {role} {arch}\n" + "\n".join(sorted(lines)) + "\n")
    print(f"{sum(map(len, sections.values()))} words merged; {len(left_out)} left out: {' '.join(sorted(left_out))}")


def client():
    import anthropic
    return anthropic.Anthropic()


def pilot(n):
    """Send the first n requests one by one, at full price, to check the prompt before a batch."""
    reqs = [json.loads(l) for l in open(os.path.join(WORK, "requests.jsonl"))][:n]
    for r in reqs:
        msg = client().messages.create(**r["params"])
        text = next((b.text for b in msg.content if b.type == "text"), "")
        print(f"--- {r['custom_id']}: {msg.stop_reason}, {msg.usage.input_tokens} in "
              f"({msg.usage.cache_read_input_tokens or 0} cached), {msg.usage.output_tokens} out")
        for e in json.loads(text)["entries"] if msg.stop_reason == "end_turn" else []:
            print(f"{e['word']} [{e['role']} {e['archetype']}]: {' '.join(e['properties'])}")


def submit():
    path = os.path.join(WORK, "batch_id")
    if os.path.exists(path):
        sys.exit(f"Already submitted: {open(path).read().strip()}. Delete {path} to send again.")
    reqs = [json.loads(l) for l in open(os.path.join(WORK, "requests.jsonl"))]
    batch = client().messages.batches.create(
        requests=[{"custom_id": r["custom_id"], "params": r["params"]} for r in reqs])
    open(path, "w").write(batch.id)
    print(f"Batch {batch.id}: {len(reqs)} requests, status {batch.processing_status}")


def status():
    batch = client().messages.batches.retrieve(open(os.path.join(WORK, "batch_id")).read().strip())
    c = batch.request_counts
    print(f"{batch.processing_status}: {c.succeeded} succeeded, {c.errored} errored, {c.processing} processing, "
          f"{c.expired} expired, {c.canceled} canceled")
    return batch.processing_status


def collect():
    bid = open(os.path.join(WORK, "batch_id")).read().strip()
    asked = {json.loads(l)["custom_id"]: json.loads(l)["words"] for l in open(os.path.join(WORK, "requests.jsonl"))}
    entries, failed, usage = {}, [], collections.Counter()
    raw = open(os.path.join(WORK, "results.jsonl"), "w")
    for res in client().messages.batches.results(bid):
        if res.result.type != "succeeded":
            failed.append((res.custom_id, res.result.type))
            continue
        msg = res.result.message
        for k in ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"):
            usage[k] += getattr(msg.usage, k, 0) or 0
        if msg.stop_reason != "end_turn":
            failed.append((res.custom_id, msg.stop_reason))
            continue
        text = next(b.text for b in msg.content if b.type == "text")
        raw.write(json.dumps({"custom_id": res.custom_id, "text": text}) + "\n")
        wanted = set(asked[res.custom_id])
        for e in json.loads(text)["entries"]:
            if e["word"] in wanted and e["word"] not in entries:
                entries[e["word"]] = e
    missing = sorted(w for ws in asked.values() for w in ws if w not in entries)
    sections = collections.defaultdict(list)
    allowed = by_role()
    wrong = []
    for w, e in list(entries.items()):
        if e["archetype"] not in allowed[e["role"]]:
            wrong.append(f"{w} ({e['role']} {e['archetype']})")
            del entries[w]
    for e in entries.values():
        tokens = [t for t in e["properties"] if re.fullmatch(r"\w+[=*+]\S+", t)]
        sections[(e["role"], e["archetype"])].append(f"{e['word']}: {' '.join(tokens)}")
    with open(os.path.join(HERE, "generated_words.txt"), "w") as f:
        f.write(f"# Generated by generate_words.py with {MODEL}. Do not edit by hand: fix demo_words.txt\n"
                "# examples or the prompt and generate again. Checked leniently by build_demo.py.\n")
        for (role, arch), lines in sorted(sections.items()):
            f.write(f"\n# {role} {arch}\n" + "\n".join(sorted(lines)) + "\n")
    print(f"{len(entries)} words written; {len(missing)} missing; {len(wrong)} with an archetype that does not "
          f"fit their role; {len(failed)} requests failed {failed[:5]}")
    if wrong:
        print("role and archetype mismatched:", ", ".join(wrong[:20]))
    print("usage:", dict(usage))
    if missing:
        print("missing:", " ".join(missing[:40]))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "prepare":
        prepare(int(sys.argv[2]), sys.argv[3])
    elif cmd == "merge":
        merge()
    elif cmd == "pilot":
        pilot(int(sys.argv[2]) if len(sys.argv) > 2 else 2)
    elif cmd in ("submit", "status", "collect"):
        globals()[cmd]()
    else:
        sys.exit(__doc__)
